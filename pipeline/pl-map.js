'use strict';
/* pl-map.js · YatraLine · Map of the aged care facilities (Placement > Facilities > Map).
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope.
   The map library (Leaflet, in vendor/) is only downloaded the first time someone opens the map.
   Tiles come from OpenStreetMap (allowed in the page's Content-Security-Policy: img-src). Pins are stored on nex_facilities (lat, lng, geo_exact). */

/* "-33.8688, 151.2093" (as copied from Google Maps or OpenStreetMap) -> [lat, lng], or null when it is not a place in Australia. */
function plParsePin(s) {
  const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(String(s || ''));
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  if (!(lat >= -45 && lat <= -9 && lng >= 110 && lng <= 155)) return null;
  return [lat, lng];
}

/* Download Leaflet once, on demand. The stylesheet ships as a JS string because connect-src does not allow fetching a .css file. */
let PL_LEAFLET = null;
function plLoadLeaflet() {
  if (window.L && window.L.map) return Promise.resolve();
  if (PL_LEAFLET) return PL_LEAFLET;
  const m = (location.search || '').match(/[?&]v=([^&]*)/), v = m ? m[1] : '0';
  const add = src => new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src + '?v=' + encodeURIComponent(v);
    s.onload = ok; s.onerror = () => no(new Error('Could not load the map. Refresh the page and try again.')); document.head.appendChild(s);
  });
  PL_LEAFLET = add('vendor/leaflet.js').then(() => add('vendor/leaflet-css.js')).then(() => {
    const st = document.createElement('style'); st.textContent = window.__LEAFLET_CSS || ''; document.head.appendChild(st);
  }).catch(e => { PL_LEAFLET = null; throw e; });
  return PL_LEAFLET;
}

function plProvider(notes) { const m = /Provider:\s*([^.]+)\./.exec(notes || ''); return m ? m[1].trim() : ''; }

let PL_MAP = null;   /* the map currently on screen, so a redraw can throw the old one away */

/* Draw the facilities into host (an element already in the page). rows = nex_facilities rows. onEdit(row) opens the edit form. */
async function plDrawFacilityMap(host, rows, onEdit) {
  if (PL_MAP) { try { PL_MAP.remove(); } catch (e) { /* the old container is already gone */ } PL_MAP = null; }
  const pins = rows.filter(r => r.lat != null && r.lng != null), missing = rows.filter(r => r.lat == null || r.lng == null);
  const cur = pins.filter(r => r.active !== false).length;
  host.innerHTML = '<div class="nx-card-b" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between">' +
    '<div class="nx-btnrow"><button class="nx-btn sm" id="plmSyd">Sydney</button><button class="nx-btn sm" id="plmAll">All sites</button></div>' +
    '<div class="nx-muted" style="font-size:12px"><span style="color:#2F86FF">●</span> Current &nbsp; <span style="color:#8A94A6">●</span> Not current</div></div>' +
    '<div id="plmEl" style="isolation:isolate;position:relative;z-index:0;height:min(68vh,620px);min-height:340px;margin:0 14px;border-radius:12px;overflow:hidden;background:#e8eef5"></div>' +
    '<div class="nx-card-b nx-muted" style="font-size:12.5px">' + pins.length + ' on the map: ' + cur + ' current, ' + (pins.length - cur) + ' not current. "Current" means Still placing students here is ticked on the facility.' +
    (missing.length ? '<div style="margin-top:6px"><b>No pin yet:</b> ' + missing.map(r => '<a href="#" data-pm="' + esc(r.id) + '">' + esc(r.name) + '</a>').join(', ') + '</div>' : '') + '</div>';
  $$('[data-pm]', host).forEach(a => a.onclick = e => { e.preventDefault(); const r = rows.find(x => x.id === a.dataset.pm); if (r) onEdit(r); });
  const el = $('#plmEl', host);
  try { await plLoadLeaflet(); } catch (e) { el.innerHTML = '<div class="nx-err" style="padding:16px">' + esc(e.message) + '</div>'; return; }
  if (!el.isConnected) return;   /* they switched tab while the library was loading */
  const L = window.L;
  const map = PL_MAP = L.map(el, { zoomControl: true, attributionControl: false, scrollWheelZoom: false }).setView([-33.86, 151.05], 10);
  L.control.attribution({ prefix: false }).addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors').addTo(map);
  /* referrerPolicy: this page sends no referrer, but OpenStreetMap's tile servers ask for one; "origin" sends only the site address. */
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, referrerPolicy: 'origin' }).addTo(map);
  map.on('click', () => map.scrollWheelZoom.enable()); map.on('mouseout', () => map.scrollWheelZoom.disable());   /* the page still scrolls until the map is clicked */
  const pts = [];
  pins.forEach(r => {
    const ll = [Number(r.lat), Number(r.lng)]; pts.push(ll);
    const mk = L.circleMarker(ll, r.active !== false ? { radius: 8, color: '#fff', weight: 2, fillColor: '#2F86FF', fillOpacity: 0.95 } : { radius: 7, color: '#fff', weight: 2, fillColor: '#8A94A6', fillOpacity: 0.9 }).addTo(map);
    mk.bindTooltip(r.name, { direction: 'top', offset: [0, -6] });
    const box = document.createElement('div'); box.style.cssText = 'color:#111;font:13px/1.45 system-ui,sans-serif;min-width:170px';
    const prov = plProvider(r.notes), addr = [r.address, r.suburb].filter(Boolean).join(', ');
    box.innerHTML = '<b>' + esc(r.name) + '</b>' + (prov ? '<div>' + esc(prov) + '</div>' : '') + (addr ? '<div>' + esc(addr) + '</div>' : '') +
      (r.phone ? '<div><a href="tel:' + esc(String(r.phone).replace(/[^\d+]/g, '')) + '">' + esc(r.phone) + '</a></div>' : '') +
      '<div style="color:#667;font-size:12px">' + (r.active !== false ? 'Current' : 'Not current') + '</div>' + '<div style="margin-top:6px"><button type="button" class="nx-btn sm">Edit</button></div>';
    $('button', box).onclick = () => { map.closePopup(); onEdit(r); };
    mk.bindPopup(box);
  });
  $('#plmSyd', host).onclick = () => map.setView([-33.86, 151.05], 10);
  $('#plmAll', host).onclick = () => { if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] }); };
  setTimeout(() => { if (PL_MAP === map) map.invalidateSize(); }, 0);
}
