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
const colorOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 55% 84%)`; };

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
// Capienza scolastica (Ce, cifre in rosso) e superficie in mq dalla tavola "Capienze aule" 2022/23
const CAP = {1:[50,91.18],2:[40,73.36],3:[44,81.82],4:[37,68.03],5:[25,46.30],6:[25,46.71],7:[25,46.78],8:[25,46.65],9:[25,46.71],10:[25,46.16],
  11:[25,46.58],12:[25,46.51],13:[25,46.23],14:[25,47.67],15:[25,46.55],16:[25,47.67],17:[50,91.18],18:[33,61.22],19:[40,73.36],20:[44,81.82],21:[37,68.03],
  22:[25,46.71],23:[25,46.85],24:[25,47.20],25:[25,46.50],26:[25,46.78],27:[25,46.92]};
const roomKey = (piano, num, nome) => piano + '-' + (num ?? nome.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

/* ---------- stato e persistenza ---------- */
function fresh() {
  return {
    v: 1,
    rooms: SEED.map(([piano, numero, nome, tipo, note]) => ({ id: roomKey(piano, numero, nome), piano, numero, nome, tipo, note, cap: CAP[numero]?.[0] ?? null, mq: CAP[numero]?.[1] ?? null })),
    std: [],          // assegnazioni standard (settimana tipo)
    var: [],          // variazioni con periodo dal/al
    perm: [],         // assegnazioni fisse (permanenti), senza giorno né orario
    corta: ['1A', '1C'],
    plans: { terra: { rot: 0, points: {} }, primo: { rot: 0, points: {} } }
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && s.v) {
      s.perm = s.perm || [];
      s.rooms.forEach(r => { if (r.cap === undefined && CAP[r.numero]) { r.cap = CAP[r.numero][0]; r.mq = CAP[r.numero][1]; } });
      return s;
    }
    return fresh();
  } catch (e) { return fresh(); }
}
let S = load();
let weekDate = iso(new Date());
const save = () => localStorage.setItem(STORE, JSON.stringify(S));
const room = id => S.rooms.find(r => r.id === id);
const roomName = id => { const r = room(id); if (!r) return '?'; return r.nome + (r.numero != null ? ` (aula ${r.numero})` : ''); };
const rNum = id => room(id)?.numero ?? '';
const rNome = id => room(id)?.nome ?? '?';
const permOf = id => S.perm.filter(p => p.roomId === id);
const chip = l => `<span class="chip" style="background:${colorOf(l)}">${esc(l)}</span>`;
const fixedTag = id => permOf(id).map(p => `<br><span class="fixed" style="background:${colorOf(p.etichetta)}">${esc(p.etichetta)}${p.docente ? ' · ' + esc(p.docente) : ''}</span>`).join('');

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
  const byRoom = {};
  S.perm.forEach(p => (byRoom[p.roomId] = byRoom[p.roomId] || []).push(p));
  Object.entries(byRoom).forEach(([rid, l]) => {
    if (l.length > 1) msgs.push(`${roomName(rid)}: più assegnazioni fisse (${l.map(p => p.etichetta).join(' / ')})`);
  });
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
  const rows = S.rooms.filter(r => r.piano === piano && (items.some(i => i.roomId === r.id) || permOf(r.id).length));

  if (!rows.length) {
    $('#grid').innerHTML = '<p>Nessuna assegnazione per questo piano in questa settimana.</p>';
  } else {
    let html = '<table class="grid"><thead><tr><th class="rn">N.</th><th>Aula</th>' +
      dates.map((d, i) => { const dt = parseISO(d); return `<th>${dayNames[i]} ${dt.getDate()}/${dt.getMonth() + 1}</th>`; }).join('') +
      '</tr></thead><tbody>';
    for (const r of rows) {
      html += `<tr><th class="rn">${esc(r.numero ?? '')}</th><th>${esc(r.nome)}${fixedTag(r.id)}</th>`;
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

  const labels = [...new Set([...items.map(i => i.etichetta), ...rows.flatMap(r => permOf(r.id).map(p => p.etichetta))])].sort();
  $('#legend').innerHTML = labels.map(chip).join('');

  const c = conflicts(mon);
  $('#conflicts').innerHTML = c.length
    ? `<div class="warn"><b>Conflitti:</b><ul>${c.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>`
    : '<div class="ok">Nessun conflitto questa settimana.</div>';
}

/* ---------- tab Assegnazioni ---------- */
function fillRoomSelects() {
  const opts = S.rooms.map(r => `<option value="${r.id}">${esc(r.numero != null ? r.numero + ' – ' + r.nome : r.nome + ' (' + r.piano + ')')}</option>`).join('');
  $('#fRoom').innerHTML = opts;
}
function renderAss() {
  const list = [...S.perm.map(a => ({ ...a, src: 'perm' })), ...S.std.map(a => ({ ...a, src: 'std' })), ...S.var.map(a => ({ ...a, src: 'var' }))]
    .sort((a, b) => (a.giorno || 0) - (b.giorno || 0) || toMin(a.dalle || '00:00') - toMin(b.dalle || '00:00'));
  $('#listAss').innerHTML = list.length
    ? '<table class="grid"><thead><tr><th>Modalità</th><th>Giorno</th><th>Ora</th><th>N.</th><th>Aula</th><th>Etichetta</th><th>Docente</th><th>Periodo</th><th></th></tr></thead><tbody>' +
      list.map(a => `<tr><td>${a.src === 'perm' ? 'Fissa' : a.src === 'var' ? 'Variazione' : 'Oraria'}</td><td>${a.src === 'perm' ? '—' : DAYS[a.giorno]}</td>` +
        `<td>${a.src === 'perm' ? '—' : a.dalle + '–' + a.alle}</td><td>${esc(rNum(a.roomId))}</td><td>${esc(rNome(a.roomId))}</td><td>${esc(a.etichetta)}</td>` +
        `<td>${esc(a.docente || '')}</td><td>${a.src === 'var' ? esc(a.dal) + (a.al ? ' → ' + esc(a.al) : '') : ''}</td>` +
        `<td><button data-del="${a.src}:${a.id}">✕</button></td></tr>`).join('') +
      '</tbody></table>'
    : '<p>Nessuna assegnazione.</p>';
}
$('#formAss').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const modo = f.modo.value;
  const a = {
    id: uid(), roomId: f.roomId.value,
    etichetta: f.etichetta.value.trim(), tipo: f.tipo.value, docente: f.docente.value.trim(), note: f.note.value.trim()
  };
  if (!a.roomId || !a.etichetta) { alert('Indica aula ed etichetta.'); return; }
  if (modo === 'fissa') {
    S.perm.push(a);
  } else {
    a.giorno = +f.giorno.value; a.dalle = f.dalle.value; a.alle = f.alle.value;
    if (!a.dalle || !a.alle || toMin(a.alle) <= toMin(a.dalle)) { alert('Controlla gli orari.'); return; }
    if (modo === 'variazione') {
      if (!f.dal.value) { alert('Indica la data di inizio della variazione.'); return; }
      a.dal = f.dal.value; a.al = f.al.value || null;
      S.var.push(a);
    } else {
      S.std.push(a);
    }
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
  else if (src === 'perm') S.perm = S.perm.filter(x => x.id !== id);
  else S.std = S.std.filter(x => x.id !== id);
  save(); renderAll();
});

// mostra solo i campi utili per la modalità scelta
function updateModo() {
  const f = $('#formAss');
  const m = f.modo.value;
  const show = (name, on) => {
    const el = f.elements[name];
    el.closest('label').hidden = !on;
    if (name === 'dalle' || name === 'alle') el.required = on;
  };
  show('giorno', m !== 'fissa');
  show('dalle', m !== 'fissa');
  show('alle', m !== 'fissa');
  show('dal', m === 'variazione');
  show('al', m === 'variazione');
}
$('#formAss').modo.addEventListener('change', updateModo);

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

// Etichetta sulla pianta: classe/attività assegnata, altrimenti nome del locale (senza numero)
function labelFor(r, mon) {
  const its = weekItems(mon).filter(i => i.roomId === r.id)
    .sort((a, b) => a.date.localeCompare(b.date) || toMin(a.dalle) - toMin(b.dalle));
  const txt = [...new Set([...permOf(r.id).map(p => p.etichetta), ...its.map(i => i.etichetta)])].join(' / ');
  return txt || r.nome;   // il numero è già sulla planimetria: etichetta = solo nome/classe/attività
}
let labelBoxes = [];   // rettangoli delle etichette disegnate, per trascinarle
function drawLabel(text, x, y, rid, isNum) {
  // la dimensione segue la larghezza del disegno, così resta leggibile anche su immagini grandi
  const fs = Math.max(8, Math.round(Math.max(14, canvas.width / 55) * (S.labelScale || 1)));
  const h = fs * 1.6;
  ctx.font = `bold ${fs}px sans-serif`;
  const w = ctx.measureText(text).width + fs * 0.8;
  const cy = y - h / 2 - 4;
  labelBoxes.push({ rid, x: x - w / 2, y: cy - h / 2, w, h });
  ctx.strokeStyle = '#1F3027';
  ctx.lineWidth = Math.max(1, fs / 12);
  if (isNum) {   // numero aula: pallino scuro con cifra chiara
    ctx.fillStyle = '#1F3027';
    ctx.beginPath(); ctx.roundRect(x - w / 2, cy - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, cy);
    return;
  }
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.fillRect(x - w / 2, cy - h / 2, w, h);
  ctx.strokeRect(x - w / 2, cy - h / 2, w, h);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, cy);
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
  labelBoxes = [];
  const showNums = $('#showNums').checked;
  for (const [key, pt] of Object.entries(p.points)) {
    const isNum = key.startsWith('n:');
    const r = room(isNum ? key.slice(2) : key);
    if (!r) continue;
    const x = pt.x * W, y = pt.y * H;
    if (isNum) { if (showNums && r.numero != null) drawLabel(String(r.numero), x, y + 4, key, true); continue; }
    ctx.fillStyle = '#2E7D4F';
    ctx.beginPath(); ctx.arc(x, y, Math.max(3, W / 400), 0, Math.PI * 2); ctx.fill();
    if (showLabels) drawLabel(labelFor(r, mon), x, y, key);
  }
}
function fillMapRooms() {
  const piano = $('#planPiano').value;
  const rs = S.rooms.filter(r => r.piano === piano);
  // prima i numeri delle aule (1–27), poi le etichette di assegnazione: sono elementi indipendenti sulla pianta
  $('#mapRoom').innerHTML =
    '<optgroup label="Numeri aula">' + rs.filter(r => r.numero != null).map(r => `<option value="n:${r.id}">N° ${r.numero}</option>`).join('') + '</optgroup>' +
    '<optgroup label="Etichette (assegnazioni)">' + rs.map(r => `<option value="${r.id}">${esc(r.numero != null ? r.numero + ' – ' + r.nome : r.nome)}</option>`).join('') + '</optgroup>';
}
/* posizionare e trascinare le etichette */
let drag = null;
const canvasXY = e => {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
};
const labelAt = p => [...labelBoxes].reverse().find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
canvas.addEventListener('pointerdown', e => {
  if (!canvas.width || !Object.keys(S.plans[$('#planPiano').value].points).length && $('#moveMode').checked) return;
  const p = canvasXY(e);
  const piano = $('#planPiano').value;
  const move = $('#moveMode').checked;
  // col mouse si trascina sempre; sul touch serve la modalità "Sposta etichette"
  const b = (move || e.pointerType === 'mouse') ? labelAt(p) : null;
  if (b) {
    const pt = S.plans[piano].points[b.rid];
    drag = { rid: b.rid, piano, dx: p.x - pt.x * canvas.width, dy: p.y - pt.y * canvas.height, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }
  if (move) return;   // in modalità sposta un tocco a vuoto non crea etichette
  const rid = $('#mapRoom').value;
  if (!rid) return;
  S.plans[piano].points[rid] = { x: p.x / canvas.width, y: p.y / canvas.height };
  save();
  drawPlan();
  $('#mapRoom').selectedIndex = Math.min($('#mapRoom').selectedIndex + 1, $('#mapRoom').options.length - 1);
});
canvas.addEventListener('pointermove', e => {
  const p = canvasXY(e);
  if (!drag) {
    if (e.pointerType === 'mouse') canvas.style.cursor = labelAt(p) ? 'grab' : 'crosshair';
    return;
  }
  if (e.pointerId !== drag.id) return;
  const x = Math.min(1, Math.max(0, (p.x - drag.dx) / canvas.width));
  const y = Math.min(1, Math.max(0, (p.y - drag.dy) / canvas.height));
  S.plans[drag.piano].points[drag.rid] = { x, y };
  drawPlan();
});
const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  drag = null;
  canvas.style.cursor = 'crosshair';
  save();
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
$('#moveMode').addEventListener('change', () => {
  // con "Sposta etichette" attivo il tocco sul disegno non fa scorrere la pagina
  canvas.style.touchAction = $('#moveMode').checked ? 'none' : 'auto';
});
$('#labelSize').value = S.labelScale || 1;
$('#labelSize').addEventListener('input', () => {
  S.labelScale = parseFloat($('#labelSize').value);
  save(); drawPlan();
});
$('#clearPts').addEventListener('click', () => {
  const piano = $('#planPiano').value;
  const n = Object.keys(S.plans[piano].points).length;
  if (!n) { alert('Non ci sono etichette posizionate su questo piano.'); return; }
  if (!confirm(`Eliminare tutte le ${n} etichette di questo piano? Le assegnazioni non vengono toccate.`)) return;
  S.plans[piano].points = {};
  save(); drawPlan();
});
$('#planPiano').addEventListener('change', () => {
  img = null; fillMapRooms();
  $('#pdfPage').value = $('#planPiano').value === 'primo' ? 2 : 1;
  drawPlan();
});

// Lettura PDF: pdf.js viene scaricato solo al primo uso (serve connessione), poi resta in cache.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfjsPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsPromise) pdfjsPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => { pdfjsPromise = null; rej(new Error('lettore PDF non raggiungibile: serve la connessione')); };
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}
async function pdfToPng(file, pageNum) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  if (pageNum < 1 || pageNum > doc.numPages) throw new Error(`il PDF ha ${doc.numPages} pagine`);
  const page = await doc.getPage(pageNum);
  const v0 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(3, 2400 / Math.max(v0.width, v0.height)) });
  const c = document.createElement('canvas');
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const cx = c.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: cx, viewport: vp }).promise;
  return new Promise(r => c.toBlob(r, 'image/png'));
}
// SVG → PNG ad alta risoluzione (gestisce anche SVG senza width/height, solo viewBox)
async function svgToPng(file) {
  let t = await file.text();
  const m = t.match(/<svg\b[^>]*>/i);
  if (!m) throw new Error('file SVG non valido');
  let tag = m[0];
  const vb = tag.match(/viewBox\s*=\s*["']\s*([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE.]+)[ ,]+([-\d.eE.]+)/);
  const num = n => { const x = tag.match(new RegExp('\\s' + n + '\\s*=\\s*["\']([\\d.]+)')); return x ? parseFloat(x[1]) : 0; };
  let w = num('width'), h = num('height');
  if (vb) { const vw = parseFloat(vb[3]), vh = parseFloat(vb[4]); if (!w || !h) { w = vw; h = vh; } }
  if (!w || !h) throw new Error('SVG senza dimensioni (manca viewBox)');
  const k = 2400 / Math.max(w, h);
  const W = Math.round(w * k), H = Math.round(h * k);
  const newTag = tag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '').replace(/<svg/i, `<svg width="${W}" height="${H}"` + (vb || !w ? '' : ` viewBox="0 0 ${w} ${h}"`));
  t = t.replace(tag, newTag);
  const url = URL.createObjectURL(new Blob([t], { type: 'image/svg+xml' }));
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('SVG non leggibile')); i.src = url; });
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); cx.drawImage(im, 0, 0, W, H);
  URL.revokeObjectURL(url);
  return new Promise(r => c.toBlob(r, 'image/png'));
}
$('#planFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const isSvg = f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);
    const blob = isPdf ? await pdfToPng(f, +$('#pdfPage').value || 1) : isSvg ? await svgToPng(f) : f;
    await idbPut('plan-' + $('#planPiano').value, blob);
  } catch (err) {
    alert('Impossibile caricare il file: ' + err.message);
    e.target.value = '';
    return;
  }
  e.target.value = '';
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
$('#showNums').addEventListener('change', drawPlan);
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
    obj.perm = obj.perm || [];
    S = obj; save(); $('#labelSize').value = S.labelScale || 1; fillRoomSelects(); fillMapRooms(); $('#corta').value = S.corta.join(', '); renderAll();
  } catch (err) { alert('Backup non valido.'); }
});
$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Cancellare tutte le assegnazioni e le posizioni sulle planimetrie?')) return;
  S = fresh(); save(); $('#labelSize').value = 1; fillRoomSelects(); fillMapRooms(); $('#corta').value = S.corta.join(', '); renderAll();
});

/* ---------- navigazione tab ---------- */
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'tab-' + b.dataset.tab);
  document.body.classList.remove('print-report');
  if (b.dataset.tab === 'planimetrie') drawPlan();
  if (b.dataset.tab === 'report') renderReport();
}));

/* ---------- assegnazioni fisse iniziali (dalle planimetrie) ---------- */
const FISSE = [
  ['terra-3', '3A'], ['terra-4', '3C'], ['terra-5', '3B'], ['terra-8', '3D'], ['terra-9', '1C'],
  ['primo-11', '2D'], ['primo-13', '2A'], ['primo-15', '2B'], ['primo-16', '2C'],
  ['primo-23', '1A'], ['primo-24', '1D'], ['primo-25', '1B']
];
$('#fisseBtn').addEventListener('click', () => {
  const nuove = FISSE.filter(([rid]) => room(rid) && !permOf(rid).length);
  if (!nuove.length) { alert('Queste aule hanno già un\'assegnazione fissa.'); return; }
  if (!confirm(`Aggiungere ${nuove.length} assegnazioni fisse (classi nelle aule indicate dalle planimetrie, 1C in aula 9)?`)) return;
  nuove.forEach(([rid, c]) => S.perm.push({ id: uid(), roomId: rid, etichetta: c, tipo: 'classe', docente: '', note: 'da planimetria' }));
  save(); renderAll();
});

/* ---------- report ---------- */
function reportData() {
  const mon = mondayOf(weekDate);
  const filtro = $('#repPiano').value;
  const showFree = $('#repFree').checked;
  const items = weekItems(mon);
  const rows = S.rooms
    .filter(r => filtro === 'tutti' || r.piano === filtro)
    .map(r => ({
      room: r,
      fisse: permOf(r.id),
      orari: items.filter(i => i.roomId === r.id).sort((a, b) => a.date.localeCompare(b.date) || toMin(a.dalle) - toMin(b.dalle))
    }))
    .filter(x => showFree || x.fisse.length || x.orari.length);
  return { mon, rows };
}
function renderReport() {
  const { mon, rows } = reportData();
  const fmt = s => { const d = parseISO(s); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
  const labels = new Set();
  const section = piano => {
    const rs = rows.filter(x => x.room.piano === piano);
    if (!rs.length) return '';
    return `<h3>${piano === 'terra' ? 'Piano terra' : 'Primo piano'}</h3>` +
      '<table class="grid report"><thead><tr><th class="rn">N.</th><th>Aula</th><th>Tipo</th><th>Cap.</th><th>Assegnazione fissa</th><th>Orario della settimana</th></tr></thead><tbody>' +
      rs.map(x => {
        x.fisse.forEach(p => labels.add(p.etichetta));
        x.orari.forEach(i => labels.add(i.etichetta));
        const fisse = x.fisse.map(p => chip(p.etichetta) + (p.docente ? ' ' + esc(p.docente) : '')).join(' ') || '—';
        const orari = x.orari.map(i =>
          `<div>${DAYS[parseISO(i.date).getDay()]} ${i.dalle}–${i.alle} ${chip(i.etichetta)}` +
          (S.corta.includes(i.etichetta) ? ' <i>(corta)</i>' : '') +
          (i.src === 'var' ? ' <span class="vtag">var.</span>' : '') +
          (i.docente ? ` <small>${esc(i.docente)}</small>` : '') + '</div>').join('') || '—';
        return `<tr><th class="rn">${esc(x.room.numero ?? '')}</th><th>${esc(x.room.nome)}</th><td>${esc(x.room.tipo)}</td><td class="cap">${x.room.cap ?? ''}</td><td>${fisse}</td><td>${orari}</td></tr>`;
      }).join('') + '</tbody></table>';
  };
  $('#reportHead').innerHTML =
    '<h2>Assegnazione locali · Scuola secondaria Mestica</h2>' +
    `<p>Settimana dal ${fmt(mon)} al ${fmt(addDays(mon, 5))}. Per cambiare settimana usa il tab Settimana.</p>`;
  const body = section('terra') + section('primo');
  $('#reportBody').innerHTML = body
    ? body + '<h3>Legenda</h3>' + [...labels].sort().map(chip).join('') + '<p class="hint">Cap. = capienza scolastica (Ce, tavola Capienze aule 2022/23). Bordo tratteggiato / “var.” = variazione. “(corta)” = settimana corta.</p>'
    : '<p>Nessuna assegnazione da mostrare.</p>';
}
$('#repPiano').addEventListener('change', renderReport);
$('#repFree').addEventListener('change', renderReport);
$('#repPrint').addEventListener('click', () => {
  renderReport();
  document.body.classList.add('print-report');
  window.print();
});
window.addEventListener('afterprint', () => document.body.classList.remove('print-report'));
$('#repCsv').addEventListener('click', () => {
  const { mon, rows } = reportData();
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const out = [['piano', 'numero', 'locale', 'tipo', 'capienza', 'assegnazione', 'giorno', 'dalle', 'alle', 'etichetta', 'docente', 'variazione']];
  rows.forEach(x => {
    const base = [x.room.piano, x.room.numero ?? '', x.room.nome, x.room.tipo, x.room.cap ?? ''];
    x.fisse.forEach(p => out.push([...base, 'fissa', '', '', '', p.etichetta, p.docente || '', '']));
    x.orari.forEach(i => out.push([...base, 'oraria', DAYS[parseISO(i.date).getDay()], i.dalle, i.alle, i.etichetta, i.docente || '', i.src === 'var' ? 'sì' : '']));
  });
  const blob = new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `assegnazioni-${mon}.csv`;
  a.click();
});

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

/* ---------- import/export elenco aule (CSV / Excel) ---------- */
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0];
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim()));
}
let xlsxLib;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return xlsxLib || (xlsxLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => res(window.XLSX); s.onerror = () => { xlsxLib = null; rej(new Error('libreria Excel non raggiungibile (serve connessione)')); };
    document.head.appendChild(s);
  }));
}
const HDR = { piano: 'piano', numero: 'numero', n: 'numero', nome: 'nome', locale: 'nome', aula: 'nome', tipo: 'tipo',
  capienza: 'cap', cap: 'cap', ce: 'cap', mq: 'mq', superficie: 'mq', note: 'note',
  etichetta: 'etichetta', assegnazione: 'assegnazione', giorno: 'giorno', dalle: 'dalle', alle: 'alle', dal: 'dal', al: 'al', docente: 'docente' };
const normPiano = v => { v = String(v).toLowerCase(); return /prim|^1$/.test(v) ? 'primo' : /terr|^0$/.test(v) ? 'terra' : ''; };
const numOrNull = v => { v = String(v ?? '').trim().replace(',', '.'); return v === '' || isNaN(+v) ? null : +v; };
// valori da Excel: orari come frazione di giorno, date come numero seriale
const toHHMM = v => { v = String(v ?? '').trim(); if (/^\d+([.,]\d+)?$/.test(v) && +v.replace(',', '.') < 1) { const m = Math.round(+v.replace(',', '.') * 1440); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); } const m = v.match(/^(\d{1,2})[:.](\d{2})/); return m ? pad(+m[1]) + ':' + m[2] : ''; };
const toISODate = v => { v = String(v ?? '').trim(); if (!v) return ''; if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  if (/^\d{5}$/.test(v)) return iso(new Date(Math.round((+v - 25569) * 864e5) + 12 * 36e5)); return ''; };
const toGiorno = v => { v = String(v ?? '').trim().toLowerCase(); if (/^[1-6]$/.test(v)) return +v; const i = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab'].indexOf(v.slice(0, 3)); return i < 0 ? 0 : i + 1; };

/* Il foglio è la sorgente unica. Ogni riga = un'aula (attributi) e/o un'assegnazione.
   Colonna "assegnazione": "fissa" (senza giorno/orario) oppure "temporanea" (giorno, dalle, alle, e facoltativi dal/al). */
function importRooms(rows) {
  const head = rows[0].map(h => HDR[String(h).trim().toLowerCase().replace(/[^a-z]/g, '')] || '');
  if (!head.includes('numero') && !(head.includes('piano') && head.includes('nome'))) throw new Error('serve almeno la colonna «numero» (o «piano» e «nome»)');
  const hasAss = head.includes('assegnazione');
  let add = 0, upd = 0, nPerm = 0, nTemp = 0, skip = [];
  const perm = [], std = [], vr = [];
  rows.slice(1).forEach((r, idx) => {
    const o = {}; head.forEach((k, i) => { if (k) o[k] = String(r[i] ?? '').trim(); });
    let piano = normPiano(o.piano);
    const nTmp = numOrNull(o.numero), known = nTmp != null ? S.rooms.find(x => x.numero === nTmp) : null;
    if (known) { piano = piano || known.piano; o.nome = o.nome || known.nome; }
    if (!piano || !o.nome) return;
    const numero = numOrNull(o.numero);
    // il numero è la chiave: una riga con numero si abbina all'aula con quel numero, qualunque sia il nome
    const byNum = numero != null ? S.rooms.find(x => x.numero === numero) : null;
    const id = byNum ? byNum.id : roomKey(piano, numero, o.nome);
    let ex = room(id);
    const data = { piano, numero, nome: o.nome };
    ['tipo', 'note'].forEach(k => { if (o[k]) data[k] = o[k]; });
    ['cap', 'mq'].forEach(k => { if (o[k]) data[k] = numOrNull(o[k]); });
    const soloAss = hasAss && o.etichetta;
    if (ex) { Object.assign(ex, data); if (!soloAss) upd++; } else { S.rooms.push({ id, tipo: '', note: '', cap: null, mq: null, ...data }); add++; }
    if (!hasAss || !o.etichetta) return;
    const tipoAss = o.assegnazione.toLowerCase();
    const base = { id: uid(), roomId: id, etichetta: o.etichetta, tipo: (room(id).tipo === 'classe') ? 'classe' : 'attivita', docente: o.docente || '', note: '' };
    if (/^fiss/.test(tipoAss)) { perm.push(base); nPerm++; }
    else if (/^temp/.test(tipoAss)) {
      const g = toGiorno(o.giorno), d = toHHMM(o.dalle), al = toHHMM(o.alle);
      if (!g || !d || !al || toMin(al) <= toMin(d)) { skip.push(idx + 2); return; }
      const t = { ...base, giorno: g, dalle: d, alle: al };
      const dal = toISODate(o.dal), fine = toISODate(o.al);
      if (dal) { vr.push({ ...t, dal, al: fine || null }); } else std.push(t);
      nTemp++;
    } else skip.push(idx + 2);
  });
  if (hasAss) { S.perm = perm; S.std = std; S.var = vr; }
  S.rooms.sort((x, y) => (x.piano === y.piano ? 0 : x.piano === 'terra' ? -1 : 1) || (x.numero ?? 999) - (y.numero ?? 999));
  save(); fillRoomSelects(); fillMapRooms(); renderAll();
  return { add, upd, nPerm, nTemp, skip, hasAss };
}
$('#roomsFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    let rows;
    if (/\.xlsx?$/i.test(f.name)) {
      const X = await loadXlsx();
      const wb = X.read(await f.arrayBuffer());
      rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    } else rows = parseCSV(await f.text());
    const hasAss = rows[0].some(h => /assegnazione/i.test(h));
    if (hasAss && (S.perm.length || S.std.length || S.var.length) && !confirm('Il foglio contiene le assegnazioni: sostituiranno tutte quelle attuali dell\'app. Continuare?')) { e.target.value = ''; return; }
    const r = importRooms(rows);
    alert(`Aule: ${r.add} nuove, ${r.upd} aggiornate.` + (r.hasAss ? ` Assegnazioni: ${r.nPerm} fisse, ${r.nTemp} temporanee.` : ' Assegnazioni non toccate.') +
      (r.skip.length ? ` Righe ignorate (dati incompleti): ${r.skip.join(', ')}.` : ''));
  } catch (err) { alert('Importazione non riuscita: ' + err.message); }
  e.target.value = '';
});
$('#roomsCsv').addEventListener('click', () => {
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const out = [['piano', 'numero', 'nome', 'tipo', 'capienza', 'mq', 'note', 'etichetta', 'assegnazione', 'giorno', 'dalle', 'alle', 'dal', 'al', 'docente']];
  // prima l'anagrafica delle aule, poi in coda le assegnazioni (una riga ciascuna)
  S.rooms.forEach(r => out.push([r.piano, r.numero ?? '', r.nome, r.tipo, r.cap ?? '', r.mq ?? '', r.note || '', '', '', '', '', '', '', '', '']));
  const ass = (a, kind) => { const r = room(a.roomId); if (r) out.push([r.numero == null ? r.piano : '', r.numero ?? '', r.numero == null ? r.nome : '', '', '', '', '', a.etichetta,
    kind === 'perm' ? 'fissa' : 'temporanea', kind === 'perm' ? '' : DAYS[a.giorno], a.dalle || '', a.alle || '', a.dal || '', a.al || '', a.docente || '']); };
  S.perm.forEach(a => ass(a, 'perm')); S.std.forEach(a => ass(a, 'std')); S.var.forEach(a => ass(a, 'var'));
  const el = document.createElement('a');
  el.href = URL.createObjectURL(new Blob(['\uFEFF' + out.map(r => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  el.download = 'aule-e-assegnazioni.csv'; el.click();
});

/* ---------- avvio ---------- */
function renderAll() {
  $('#weekPick').value = weekDate;
  renderGrid();
  renderAss();
  renderReport();
  drawPlan();
}
if (!localStorage.getItem(UI_KEY)) UI.day = Math.max(0, Math.min(5, new Date().getDay() - 1));
applyUI();
updateModo();
fillRoomSelects();
fillMapRooms();
renderAll();
$('#planPiano').value = 'terra';
fillMapRooms();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
