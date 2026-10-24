-- leave_proof_01: optional proof (e.g. medical certificate) on a leave request.
-- Files are stored in a private Google Drive folder by the Apps Script gateway,
-- not in Supabase Storage. This script only adds the column that holds the
-- Drive file id. Additive only. Run once in the Supabase SQL editor.

alter table public.leave_submissions add column if not exists proof_path text;

-- Verify after running:
--   select column_name, data_type from information_schema.columns
--    where table_name = 'leave_submissions' and column_name = 'proof_path';
