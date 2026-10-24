// Docs.gs — Drive uploads and FormCraft templates. Does not touch the timesheet tabs.

function handleUploadDoc(data){
  try{
    if(!data || !data.base64){
      return {error: 'Missing base64 data'};
    }
    const folder = DriveApp.getFolderById(DOCS_FOLDER_ID);

    let bytes;
    try{
      bytes = Utilities.base64Decode(data.base64);
    }catch(e){
      return {error: 'Invalid base64 data: ' + e.message};
    }
    if(!bytes || bytes.length === 0){
      return {error: 'Decoded data is empty'};
    }

    const mime = (data.mime && typeof data.mime === 'string' && data.mime.trim()) ? data.mime : 'application/octet-stream';
    let filename = (data.filename && typeof data.filename === 'string' && data.filename.trim()) ? data.filename : ('upload_' + Date.now());
    filename = filename.replace(/[\\/:*?"<>|]/g, '_');

    const blob = Utilities.newBlob(bytes, mime, filename);
    const file = folder.createFile(blob);
    // SECURITY: files inherit the (private) folder's permissions. Never made public.
    return {ok:true, id: file.getId(), size: bytes.length, mime: mime, filename: filename};
  }catch(e){
    return {error: 'Upload failed: ' + e.message};
  }
}
// ── Leave proof (Drive) ─────────────────────────────────────────────────
// Files go to a private folder owned by the script. Nothing is shared with
// anyone, and it is never the company Documents folder. Each file is tagged
// with the uploader's auth uid in its description. Only the server writes that tag.
function _leaveProofFolder(){
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('LEAVE_PROOF_FOLDER_ID');
  if(id){
    try{ return DriveApp.getFolderById(id); }catch(e){}
  }
  const folder = DriveApp.createFolder('Leave proof (private)');
  props.setProperty('LEAVE_PROOF_FOLDER_ID', folder.getId());
  return folder;
}
function handleUploadLeaveProof(data){
  try{
    const user = _verifySupabaseUser(data.sbAccessToken);
    if(!user || !user.id) return {error: 'sign in required'};
    const bytes = Utilities.base64Decode(data.base64);
    if(!bytes || bytes.length === 0) return {error: 'empty file'};
    if(bytes.length > MAX_LEAVE_PROOF_BYTES) return {error: 'file too large'};
    const ext = LEAVE_PROOF_MIME[data.mime];
    const name = Date.now() + '-' + String(user.id).slice(0, 8) + '.' + ext;
    const file = _leaveProofFolder().createFile(Utilities.newBlob(bytes, data.mime, name));
    file.setDescription('uid:' + user.id);
    return {ok: true, id: file.getId()};
  }catch(e){
    return {error: 'upload failed'};
  }
}
function handleGetLeaveProof(data){
  try{
    const user = _verifySupabaseUser(data.sbAccessToken);
    if(!user || !user.id) return {error: 'sign in required'};
    const file = DriveApp.getFileById(data.fileId);
    const folderId = PropertiesService.getScriptProperties().getProperty('LEAVE_PROOF_FOLDER_ID');
    const parents = file.getParents();
    let inProofFolder = false;
    while(parents.hasNext()){ if(parents.next().getId() === folderId) inProofFolder = true; }
    if(!inProofFolder) return {error: 'not found'};
    const isOwner = file.getDescription() === 'uid:' + user.id;
    if(!isOwner && !_isAdminCaller(data)) return {error: 'forbidden'};
    return {ok: true, mime: file.getMimeType(), base64: Utilities.base64Encode(file.getBlob().getBytes())};
  }catch(e){
    return {error: 'not found'};
  }
}
// Moves a proof file to Drive's trash (recoverable for 30 days). Returns true when the
// file is trashed or already gone, false when it is not one of ours or can't be removed.
function _trashLeaveProof(fileId){
  if(!fileId) return true;
  let file;
  try{ file = DriveApp.getFileById(fileId); }catch(e){ return true; }
  const folderId = PropertiesService.getScriptProperties().getProperty('LEAVE_PROOF_FOLDER_ID');
  const parents = file.getParents();
  let inProofFolder = false;
  while(parents.hasNext()){ if(parents.next().getId() === folderId) inProofFolder = true; }
  if(!inProofFolder) return false;
  file.setTrashed(true);
  return true;
}
function handleDeleteLeaveProof(data){
  try{
    return _trashLeaveProof(data.fileId) ? {ok: true} : {error: 'could not remove proof'};
  }catch(e){
    return {error: 'could not remove proof'};
  }
}
function handleFetchDoc(data){
  try{
    if(!data.id) return {error: 'id required'};
    const file = DriveApp.getFileById(data.id);
    const blob = file.getBlob();
    return {ok:true, name: file.getName(), mime: blob.getContentType(),
            base64: Utilities.base64Encode(blob.getBytes())};
  }catch(e){
    return {error: e.message};
  }
}


// ════════════════════════════════════════════════════════════════
// FORMCRAFT TEMPLATES — stored in Google Drive
// ════════════════════════════════════════════════════════════════
const TEMPLATES_FOLDER_NAME = 'Nexus FormCraft Templates';

function _getTemplatesFolder(){
  const props = PropertiesService.getScriptProperties();
  let cachedId = props.getProperty('TEMPLATES_FOLDER_ID');
  if(cachedId){
    try{ return DriveApp.getFolderById(cachedId); }catch(e){ /* deleted? recreate */ }
  }
  const parent = DriveApp.getFolderById(DOCS_FOLDER_ID);
  const existing = parent.getFoldersByName(TEMPLATES_FOLDER_NAME);
  let folder;
  if(existing.hasNext()){ folder = existing.next(); }
  else { folder = parent.createFolder(TEMPLATES_FOLDER_NAME); }
  props.setProperty('TEMPLATES_FOLDER_ID', folder.getId());
  return folder;
}

function handleListTemplates(data){
  try{
    const folder = _getTemplatesFolder();
    const files = folder.getFilesByType(MimeType.PDF);
    const result = [];
    while(files.hasNext()){
      const f = files.next();
      result.push({ id: f.getId(), name: f.getName().replace(/\.pdf$/i, ''), size: f.getSize(), updated: f.getLastUpdated().toISOString() });
    }
    result.sort(function(a,b){ return b.updated.localeCompare(a.updated); });
    return { ok: true, templates: result };
  }catch(e){ return { ok: false, error: e.message }; }
}

function handleUploadTemplate(data){
  try{
    if(!data.name || !data.pdfBase64) return { ok: false, error: 'name + pdfBase64 required' };
    const folder = _getTemplatesFolder();
    const b64 = String(data.pdfBase64).replace(/^data:application\/pdf;base64,/, '');
    const bytes = Utilities.base64Decode(b64);
    const blob = Utilities.newBlob(bytes, 'application/pdf', data.name + '.pdf');
    const file = folder.createFile(blob);
    // SECURITY: templates inherit the private folder. Fetched back via handleFetchTemplate.
    return { ok: true, id: file.getId(), name: data.name };
  }catch(e){ return { ok: false, error: e.message }; }
}

function handleFetchTemplate(data){
  try{
    if(!data.id) return { ok: false, error: 'id required' };
    const file = DriveApp.getFileById(data.id);
    const blob = file.getBlob();
    const b64 = Utilities.base64Encode(blob.getBytes());
    return { ok: true, name: file.getName(), pdfBase64: b64 };
  }catch(e){ return { ok: false, error: e.message }; }
}

function handleDeleteTemplate(data){
  try{
    if(!data.id) return { ok: false, error: 'id required' };
    DriveApp.getFileById(data.id).setTrashed(true);
    return { ok: true };
  }catch(e){ return { ok: false, error: e.message }; }
}

function handleRenameTemplate(data){
  try{
    if(!data.id || !data.newName) return { ok: false, error: 'id + newName required' };
    const file = DriveApp.getFileById(data.id);
    file.setName(data.newName + '.pdf');
    return { ok: true };
  }catch(e){ return { ok: false, error: e.message }; }
}
