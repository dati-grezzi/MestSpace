'use strict';

/* ---------- utilità ---------- */
const STORE = 'mestspace-v1';
const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [a, b, c] = s.split('-').map(Number); return new Date(a, b - 1, c); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const mondayOf = s => { const d = parseISO(s); const w = d.getDay(); d.setDate(d.getDate() + (w === 0 ? -6 : 1 - w)); return iso(d); };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const overlap = (a, b) => toMin(a.dalle) < toMin(b.alle) && toMin(b.dalle) < toMin(a.alle);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const colorOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 70% 82%)`; };

/* ---------- preferenze di visualizzazione (solo questo dispositivo) ---------- */
const UI_KEY = 'mestspace-ui';
let UI = { big: false, day: 0 };
try { Object.assign(UI, JSON.parse(localStorage.getItem(UI_KEY)) || {}); } catch (e) {}
const saveUI = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(UI)); } catch (e) {} };
const isNarrow = () => window.matchMedia('(max-width: 600px)').matches;

/* ---------- aule di partenza (da planimetrie) ---------- */
const SEED = [
  ['terra', 1, 'Biblioteca', 'biblioteca', ''],
  ['terra', 2, 'Aula professori', 'aula', ''],
  ['terra', 3, 'Aula 3A', 'classe', ''],
  ['terra', 4, 'Aula 3C', 'classe', ''],
  ['terra', 5, 'Aula 3B', 'classe', ''],
  ['terra', 6, 'Laboratorio idee', 'laboratorio', 'usato da sostegno'],
  ['terra', 7, 'Aula pianoforte', 'strumento', ''],
  ['terra', 8, 'Aula 3D', 'classe', ''],
  ['terra', 9, 'Aula francese / lab info PC', 'classe', 'verificare'],
  ['terra', 10, 'Lab multimediale S.T.C.', 'laboratorio', ''],
  ['terra', null, 'Presidenza', 'ufficio', ''],
  ['terra', null, 'Segreteria', 'ufficio', ''],
  ['terra', null, 'Ufficio collaboratori DS', 'ufficio', ''],
  ['terra', null, 'Sicurezza', 'ufficio', ''],
  ['terra', null, 'Ufficio protocollo', 'ufficio', ''],
  ['terra', null, 'Ufficio contabilità', 'ufficio', ''],
  ['terra', null, 'Ufficio personale', 'ufficio', ''],
  ['terra', null, 'DSGA', 'ufficio', ''],
  ['terra', null, 'Magazzino', 'deposito', ''],
  ['terra', null, 'Archivio', 'deposito', ''],
  ['terra', null, 'Aula tecnici', 'laboratorio', ''],
  ['terra', null, 'Palestra', 'palestra', ''],
  ['terra', null, 'Spogliatoi', 'servizi', ''],
  ['terra', null, 'Settore A', 'spazio comune', ''],
  ['primo', 11, 'Aula 2D', 'classe', ''],
  ['primo', 12, 'Aula francese sax', 'strumento', ''],
  ['primo', 13, 'Aula 2A', 'classe', ''],
  ['primo', 14, 'Aula tromba lab info', 'strumento', ''],
  ['primo', 15, 'Aula 2B', 'classe', ''],
  ['primo', 16, 'Aula fisarmonica 2C', 'strumento', ''],
  ['primo', 17, 'Aula musica piano M. Insieme', 'strumento', ''],
  ['primo', 18, 'Lab informatica', 'laboratorio', 'ex 1C'],
  ['primo', 19, 'Aula spagnolo lab info', 'laboratorio', ''],
  ['primo', 20, 'Lab scienze', 'laboratorio', ''],
  ['primo', 21, 'Lab arte', 'laboratorio', ''],
  ['primo', 22, 'Magazzino sedie/banchi', 'deposito', ''],
  ['primo', 23, 'Aula 1A', 'classe', 'settimana corta'],
  ['primo', 24, 'Aula 1D', 'classe', ''],
  ['primo', 25, 'Aula 1B', 'classe', ''],
  ['primo', 26, 'Lab informatica', 'laboratorio', ''],
  ['primo', 27, 'Lab informatica', 'laboratorio', '']
];
const roomKey = (piano, num, nome) => piano + '-' + (num ?? nome.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

/* ---------- stato e persistenza ---------- */
function fresh() {
  return {
    v: 1,
    rooms: SEED.map(([piano, numero, nome, tipo, note]) => ({ id: roomKey(piano, numero, nome), piano, numero, nome, tipo, note })),
    std: [],          // assegnazioni standard (settimana tipo)
    var: [],          // variazioni con periodo dal/al
    corta: ['1A', '1C'],
    plans: { terra: { rot: 0, points: {} }, primo: { rot: 0, points: {} } }
  };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(STORE)); return s && s.v ? s : fresh(); }
  catch (e) { return fresh(); }
}
let S = load();
let weekDate = iso(new Date());
const save = () => localStorage.setItem(STORE, JSON.stringify(S));
const room = id => S.rooms.find(r => r.id === id);
const roomName = id => { const r = room(id); if (!r) return '?'; return (r.numero != null ? r.numero + ' · ' : '') + r.nome; };

/* ---------- calcolo occupazioni ---------- */
// Una variazione attiva in una data sostituisce l'intera giornata dell'aula per quella data.
function dayItems(date) {
  const w = parseISO(date).getDay();
  if (!w) return [];
  const act = S.var.filter(v => v.giorno === w && v.dal <= date && (!v.al || v.al >= date));
  const over = new Set(act.map(v => v.roomId));
  return [
    ...S.std.filter(a => a.giorno === w && !over.has(a.roomId)).map(a => ({ ...a, date, src: 'std' })),
    ...act.map(a => ({ ...a, date, src: 'var' }))
  ];
}
function weekItems(mon) {
  const out = [];
  for (let i = 0; i < 6; i++) out.push(...dayItems(addDays(mon, i)));
  return out;
}
function conflicts(mon) {
  const msgs = [];
  for (let i = 0; i < 6; i++) {
    const date = addDays(mon, i);
    const items = dayItems(date);
    for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
      const x = items[a], y = items[b];
      if (!overlap(x, y)) continue;
      if (x.roomId === y.roomId)
        msgs.push(`${date}: ${roomName(x.roomId)} occupata due volte (${x.etichetta} / ${y.etichetta}) ${x.dalle}–${x.alle}`);
      else if (x.docente && x.docente === y.docente)
        msgs.push(`${date}: docente ${x.docente} in due aule (${roomName(x.roomId)} / ${roomName(y.roomId)})`);
    }
  }
  return msgs;
}

/* ---------- tab Settimana ---------- */
function renderDayTabs(all, narrow) {
  const el = $('#dayTabs');
  el.hidden = !narrow;
  if (!narrow) { el.innerHTML = ''; return; }
  el.innerHTML = all.map((d, i) => `<button data-day="${i}" class="${i === UI.day ? 'on' : ''}">${DAYS[i + 1]} ${parseISO(d).getDate()}</button>`).join('');
}
function renderGrid() {
  const piano = $('#pianoSel').value;
  const mon = mondayOf(weekDate);
  const all = [0, 1, 2, 3, 4, 5].map(i => addDays(mon, i));
  const narrow = isNarrow();
  const dayIdx = Math.min(Math.max(UI.day, 0), 5);
  const dates = narrow ? [all[dayIdx]] : all;
  const dayNames = narrow ? [DAYS[dayIdx + 1]] : DAYS.slice(1, 7);
  renderDayTabs(all, narrow);
  const items = weekItems(mon).filter(i => dates.includes(i.date));
  const rows = S.rooms.filter(r => r.piano === piano && items.some(i => i.roomId === r.id));

  if (!rows.length) {
    $('#grid').innerHTML = '<p>Nessuna assegnazione per questo piano in questa settimana.</p>';
  } else {
    let html = '<table class="grid"><thead><tr><th>Aula</th>' +
      dates.map((d, i) => { const dt = parseISO(d); return `<th>${dayNames[i]} ${dt.getDate()}/${dt.getMonth() + 1}</th>`; }).join('') +
      '</tr></thead><tbody>';
    for (const r of rows) {
      html += `<tr><th>${esc(roomName(r.id))}</th>`;
      for (const d of dates) {
        const cell = items.filter(i => i.roomId === r.id && i.date === d).sort((a, b) => toMin(a.dalle) - toMin(b.dalle));
        html += '<td>' + cell.map(i =>
          `<div class="ev ${i.src}" style="background:${colorOf(i.etichetta)}">` +
          `<b>${i.dalle}–${i.alle}</b> ${esc(i.etichetta)}` +
          (S.corta.includes(i.etichetta) ? ' <i>(corta)</i>' : '') +
          (i.src === 'var' ? ' <span class="vtag">var.</span>' : '') +
          (i.docente ? `<br><small>${esc(i.docente)}</small>` : '') +
          '</div>').join('') + '</td>';
      }
      html += '</tr>';
    }
    $('#grid').innerHTML = html + '</tbody></table>';
  }

  const labels = [...new Set(items.map(i => i.etichetta))].sort();
  $('#legend').innerHTML = labels.map(l => `<span class="chip" style="background:${colorOf(l)}">${esc(l)}</span>`).join('');

  const c = conflicts(mon);
  $('#conflicts').innerHTML = c.length
    ? `<div class="warn"><b>Conflitti:</b><ul>${c.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>`
    : '<div class="ok">Nessun conflitto questa settimana.</div>';
}

/* ---------- tab Assegnazioni ---------- */
function fillRoomSelects() {
  const opts = S.rooms.map(r => `<option value="${r.id}">${esc(roomName(r.id))} (${r.piano})</option>`).join('');
  $('#fRoom').innerHTML = opts;
}
function renderAss() {
  const list = [...S.std.map(a => ({ ...a, src: 'std' })), ...S.var.map(a => ({ ...a, src: 'var' }))]
    .sort((a, b) => a.giorno - b.giorno || toMin(a.dalle) - toMin(b.dalle));
  $('#listAss').innerHTML = list.length
    ? '<table class="grid"><thead><tr><th>Tipo</th><th>Giorno</th><th>Ora</th><th>Aula</th><th>Etichetta</th><th>Docente</th><th>Periodo</th><th></th></tr></thead><tbody>' +
      list.map(a => `<tr><td>${a.src === 'var' ? 'Variazione' : 'Standard'}</td><td>${DAYS[a.giorno]}</td>` +
        `<td>${a.dalle}–${a.alle}</td><td>${esc(roomName(a.roomId))}</td><td>${esc(a.etichetta)}</td>` +
        `<td>${esc(a.docente || '')}</td><td>${a.src === 'var' ? esc(a.dal) + (a.al ? ' → ' + esc(a.al) : '') : ''}</td>` +
        `<td><button data-del="${a.src}:${a.id}">✕</button></td></tr>`).join('') +
      '</tbody></table>'
    : '<p>Nessuna assegnazione.</p>';
}
$('#formAss').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const a = {
    id: uid(), roomId: f.roomId.value, giorno: +f.giorno.value, dalle: f.dalle.value, alle: f.alle.value,
    etichetta: f.etichetta.value.trim(), tipo: f.tipo.value, docente: f.docente.value.trim(), note: f.note.value.trim()
  };
  if (!a.roomId || !a.dalle || !a.alle || !a.etichetta || toMin(a.alle) <= toMin(a.dalle)) {
    alert('Controlla aula, orari ed etichetta.'); return;
  }
  if (f.variazione.checked) {
    if (!f.dal.value) { alert('Indica la data di inizio della variazione.'); return; }
    a.dal = f.dal.value; a.al = f.al.value || null;
    S.var.push(a);
  } else {
    S.std.push(a);
  }
  save();
  f.etichetta.value = ''; f.docente.value = ''; f.note.value = '';
  renderAll();
});
$('#listAss').addEventListener('click', e => {
  const b = e.target.closest('[data-del]');
  if (!b || !confirm('Eliminare questa assegnazione?')) return;
  const [src, id] = b.dataset.del.split(':');
  if (src === 'var') S.var = S.var.filter(x => x.id !== id);
  else S.std = S.std.filter(x => x.id !== id);
  save(); renderAll();
});

/* ---------- planimetrie ---------- */
const canvas = $('#planCanvas');
const ctx = canvas.getContext('2d');
let img = null, imgPiano = null;

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('mestspace', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(k, v) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const t = db.transaction('files', 'readwrite');
    t.objectStore('files').put(v, k);
    t.oncomplete = res; t.onerror = () => rej(t.error);
  });
}
async function idbGet(k) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const q = db.transaction('files').objectStore('files').get(k);
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
async function loadImg(piano) {
  if (imgPiano === piano && img) return img;
  const blob = await idbGet('plan-' + piano);
  imgPiano = piano;
  if (!blob) { img = null; return null; }
  img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = URL.createObjectURL(blob); });
  return img;
}

// Etichetta: classe → nome della classe; laboratori/attività → "numero · nome o attività"
function labelFor(r, mon) {
  const its = weekItems(mon).filter(i => i.roomId === r.id)
    .sort((a, b) => a.date.localeCompare(b.date) || toMin(a.dalle) - toMin(b.dalle));
  const txt = [...new Set(its.map(i => i.etichetta))].join(' / ');
  if (r.tipo === 'classe') return txt || String(r.numero ?? r.nome);
  return (r.numero != null ? r.numero + ' · ' : '') + (txt || r.nome);
}
function drawLabel(text, x, y) {
  ctx.font = 'bold 14px sans-serif';
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.strokeStyle = '#1d4ed8';
  ctx.fillRect(x - w / 2, y - 11, w, 22);
  ctx.strokeRect(x - w / 2, y - 11, w, 22);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
async function drawPlan() {
  const piano = $('#planPiano').value;
  const p = S.plans[piano];
  const im = await loadImg(piano);
  if (!im) {
    canvas.width = 640; canvas.height = 120;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 640, 120);
    ctx.fillStyle = '#555'; ctx.font = '16px sans-serif';
    ctx.fillText('Carica la planimetria di questo piano.', 20, 60);
    return;
  }
  const rot = p.rot || 0;
  const side = rot % 180 !== 0;
  const rw = side ? im.height : im.width, rh = side ? im.width : im.height;
  const sc = Math.min(1, 1600 / rw);
  const W = Math.round(rw * sc), H = Math.round(rh * sc);
  canvas.width = W; canvas.height = H;

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rot * Math.PI / 180);
  ctx.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc);
  ctx.restore();

  const mon = mondayOf(weekDate);
  const showLabels = $('#showLabels').checked;
  for (const [rid, pt] of Object.entries(p.points)) {
    const r = room(rid);
    if (!r) continue;
    const x = pt.x * W, y = pt.y * H;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    if (showLabels) drawLabel(labelFor(r, mon), x, y - 14);
  }
}
function fillMapRooms() {
  const piano = $('#planPiano').value;
  $('#mapRoom').innerHTML = S.rooms.filter(r => r.piano === piano)
    .map(r => `<option value="${r.id}">${esc(roomName(r.id))}</option>`).join('');
}
canvas.addEventListener('click', e => {
  if (!canvas.width) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  const piano = $('#planPiano').value;
  const rid = $('#mapRoom').value;
  if (!rid) return;
  S.plans[piano].points[rid] = { x, y };
  save();
  drawPlan();
  $('#mapRoom').selectedIndex = Math.min($('#mapRoom').selectedIndex + 1, $('#mapRoom').options.length - 1);
});
$('#planPiano').addEventListener('change', () => { img = null; fillMapRooms(); drawPlan(); });
$('#planFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  await idbPut('plan-' + $('#planPiano').value, f);
  img = null; imgPiano = null;
  drawPlan();
});
$('#rotBtn').addEventListener('click', () => {
  const piano = $('#planPiano').value;
  S.plans[piano].rot = ((S.plans[piano].rot || 0) + 90) % 360;
  save(); drawPlan();
});
$('#remPt').addEventListener('click', () => {
  const piano = $('#planPiano').value;
  delete S.plans[piano].points[$('#mapRoom').value];
  save(); drawPlan();
});
$('#showLabels').addEventListener('change', drawPlan);
$('#pngBtn').addEventListener('click', () => {
  canvas.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `planimetria-${$('#planPiano').value}-${mondayOf(weekDate)}.png`;
    a.click();
  });
});
$('#printPlan').addEventListener('click', () => {
  const w = window.open('');
  w.document.write(`<img src="${canvas.toDataURL()}" style="width:100%">`);
  w.document.close();
  w.onload = () => w.print();
});

/* ---------- tab Settimana: navigazione ---------- */
$('#weekPick').addEventListener('change', e => { weekDate = mondayOf(e.target.value); renderAll(); });
$('#prevW').addEventListener('click', () => { weekDate = addDays(weekDate, -7); renderAll(); });
$('#nextW').addEventListener('click', () => { weekDate = addDays(weekDate, 7); renderAll(); });
$('#pianoSel').addEventListener('change', renderAll);

/* ---------- impostazioni ---------- */
$('#corta').value = S.corta.join(', ');
$('#saveCorta').addEventListener('click', () => {
  S.corta = $('#corta').value.split(',').map(s => s.trim()).filter(Boolean);
  save(); renderAll();
});
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mestspace-backup-${iso(new Date())}.json`;
  a.click();
});
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f || !confirm('Sostituire i dati attuali con il backup?')) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!obj.rooms || !obj.std || !obj.var) throw new Error('formato');
    S = obj; save(); fillRoomSelects(); fillMapRooms(); $('#corta').value = S.corta.join(', '); renderAll();
  } catch (err) { alert('Backup non valido.'); }
});
$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Cancellare tutte le assegnazioni e le posizioni sulle planimetrie?')) return;
  S = fresh(); save(); fillRoomSelects(); fillMapRooms(); $('#corta').value = S.corta.join(', '); renderAll();
});

/* ---------- navigazione tab ---------- */
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'tab-' + b.dataset.tab);
  if (b.dataset.tab === 'planimetrie') drawPlan();
}));

$('#dayTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-day]');
  if (!b) return;
  UI.day = +b.dataset.day; saveUI(); renderGrid();
});
const applyUI = () => {
  document.body.classList.toggle('big', UI.big);
  $('#fontBtn').textContent = UI.big ? 'Carattere: A+ (attivo)' : 'Carattere: A';
};
$('#fontBtn').addEventListener('click', () => { UI.big = !UI.big; saveUI(); applyUI(); });
window.matchMedia('(max-width: 600px)').addEventListener('change', () => renderGrid());

/* ---------- avvio ---------- */
function renderAll() {
  $('#weekPick').value = weekDate;
  renderGrid();
  renderAss();
  drawPlan();
}
if (!localStorage.getItem(UI_KEY)) UI.day = Math.max(0, Math.min(5, new Date().getDay() - 1));
applyUI();
fillRoomSelects();
fillMapRooms();
renderAll();
$('#planPiano').value = 'terra';
fillMapRooms();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
