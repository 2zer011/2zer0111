'use strict';

/* ═══════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════ */
const IS_MOB = window.innerWidth <= 768;
const PRESETS = ['🐺','🦊','🐱','🐼','🦁','🐸','👾','💀','🤖','⚡','🔥','💎'];
const ICE = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80',           username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:global.relay.metered.ca:443',          username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:global.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
], iceCandidatePoolSize: 10 };

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
let peer = null, myId = null, myNick = '', isHost = false, roomCode = '', cKey = null;
let peers = {}, nicks = {}, avatars = {}, msgCount = 0;
let lastAuth = null, lastGrp = null, typTm = null;
let myAvatar = '';
let pendingImg = null;

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const se = (id, v) => { const e = $(id); if (e) e.textContent = v; };
const san = s => (s || '').replace(/[<>"'&\\]/g, '').slice(0, 24).trim();
const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rndNick = () => {
  const a = ['void','null','ghost','sigma','delta','rogue','echo','cipher','zero','hex','apex','nexus','vex','ion','wraith'];
  return a[Math.floor(Math.random() * a.length)] + (1000 + Math.floor(Math.random() * 8999));
};

let lbTm;
function lbar(p) {
  const el = $('lbar'); if (!el) return;
  el.style.transform = `scaleX(${p})`;
  if (p >= 1) { clearTimeout(lbTm); lbTm = setTimeout(() => el.style.transform = 'scaleX(0)', 700); }
}

let toastTm;
function toast(msg) {
  const el = $('toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTm); toastTm = setTimeout(() => el.classList.remove('show'), 2500);
}

function copyToClipboard(text, label = 'COPIED') {
  navigator.clipboard.writeText(text).then(() => toast(label)).catch(() => {
    const t = document.createElement('textarea'); t.value = text;
    t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t);
    t.select(); document.execCommand('copy'); document.body.removeChild(t); toast(label);
  });
}

/* ═══════════════════════════════════════════════
   MATRIX RAIN (desktop only)
═══════════════════════════════════════════════ */
function initRain() {
  const cv = $('bgCanvas'); if (!cv) return;
  const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
  let W, H, cols, drops, spd, isR;
  const CH = 'ABCDEF0123456789アイウエカキクコサシスセタ<>[]|/-_=?#@';
  const FS = 14, GAP = 20;

  function init() {
    W = cv.width = innerWidth; H = cv.height = innerHeight;
    cols = Math.floor(W / GAP);
    drops = new Float32Array(cols).map(() => Math.random() * (-H / FS));
    spd   = new Float32Array(cols).map(() => 0.22 + Math.random() * .5);
    isR   = new Uint8Array(cols).map(() => Math.random() < .12 ? 1 : 0);
    cx.fillStyle = '#03030f'; cx.fillRect(0, 0, W, H);
  }
  init(); addEventListener('resize', init);

  let last = 0;
  (function draw(ts) {
    requestAnimationFrame(draw);
    if (ts - last < 1000 / 28) return; last = ts;
    cx.fillStyle = 'rgba(3,3,15,.065)'; cx.fillRect(0, 0, W, H);
    cx.font = `${FS}px "Share Tech Mono",monospace`; cx.shadowBlur = 0;
    for (let i = 0; i < cols; i++) {
      const y = drops[i] * FS, r = isR[i];
      cx.fillStyle = r ? 'rgba(255,55,55,.86)' : 'rgba(40,195,255,.86)';
      cx.fillText(CH[Math.floor(Math.random() * CH.length)], i * GAP, y);
      cx.fillStyle = r ? 'rgba(130,12,12,.35)' : 'rgba(0,90,170,.35)';
      cx.fillText(CH[Math.floor(Math.random() * CH.length)], i * GAP, y - FS * 2.2);
      drops[i] += spd[i];
      if (y > H && Math.random() < .016) {
        drops[i] = -Math.random() * 18;
        if (Math.random() < .04) isR[i] = isR[i] ? 0 : 1;
      }
    }
  })(0);
}

/* ═══════════════════════════════════════════════
   BOOT TERMINAL (desktop)
═══════════════════════════════════════════════ */
function runBootTerminal() {
  const lines = [
    ['> INIT CRYPTO ENGINE AES-256-GCM ', 'ok', '[OK]'],
    ['> DERIVE KEY PBKDF2 SHA-256 x100K ', 'ok', '[READY]'],
    ['> PEER NODE HANDSHAKE DTLS/SRTP ',   'ok', '[ACTIVE]'],
  ];
  let i = 0;
  (function next() {
    if (i >= lines.length) return;
    const [txt, cls, suf] = lines[i];
    const el = $('tl' + (i + 1)); if (!el) { i++; return next(); }
    let j = 0;
    const iv = setInterval(() => {
      if (j >= txt.length) { clearInterval(iv); el.innerHTML = txt + `<span class="${cls}">${suf}</span>`; i++; setTimeout(next, 160); }
      else { el.innerHTML = txt.slice(0, j) + `<span style="color:#00aaff66">${txt[j]}</span>`; j++; }
    }, 18);
  })();
}

/* ═══════════════════════════════════════════════
   HEX STREAMS (desktop)
═══════════════════════════════════════════════ */
function initHexStreams() {
  const HC = '0123456789ABCDEF';
  const rh = n => Array.from({ length: n }, () => HC[Math.floor(Math.random() * 16)]).join('');
  const rhex = () => Array.from({ length: 20 }, () => rh(2)).join(' ');
  setInterval(() => { ['d-hexb','d-hexs'].forEach(id => { const e = $(id); if (e) e.textContent = rhex(); }); }, 2200);
}

/* ═══════════════════════════════════════════════
   UPTIME
═══════════════════════════════════════════════ */
let ustart = null;
function startUptime() {
  ustart = Date.now();
  setInterval(() => {
    const el = $('supt'); if (!el || !ustart) return;
    const s = Math.floor((Date.now() - ustart) / 1000), m = Math.floor(s / 60), ss = s % 60;
    el.textContent = `${m}`.padStart(2,'0') + ':' + `${ss}`.padStart(2,'0');
  }, 1000);
}

/* ═══════════════════════════════════════════════
   AVATAR
═══════════════════════════════════════════════ */
function buildPresets() {
  [['d-presets','d-preset'], ['m-avpresets','m-avpreset']].forEach(([cid, cls]) => {
    const c = $(cid); if (!c) return;
    c.innerHTML = PRESETS.map(e =>
      `<div class="${cls}" data-emoji="${e}" onclick="pickPreset(this)">${e}</div>`
    ).join('');
  });
}

function pickPreset(el) {
  myAvatar = el.dataset.emoji;
  document.querySelectorAll('.d-preset.sel,.m-avpreset.sel').forEach(e => e.classList.remove('sel'));
  el.classList.add('sel');
  updateAvUI();
}

function handleAvFile(inp) {
  const f = inp.files[0]; if (!f || !f.type.startsWith('image/')) { toast('IMAGE FILES ONLY'); return; }
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 80; cv.height = 80;
      const ctx = cv.getContext('2d');
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 80, 80);
      myAvatar = cv.toDataURL('image/jpeg', .78);
      document.querySelectorAll('.d-preset.sel,.m-avpreset.sel').forEach(e => e.classList.remove('sel'));
      updateAvUI(); toast('AVATAR UPDATED');
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(f); inp.value = '';
}

function updateAvUI() {
  const av = myAvatar;
  const nick = myNick || ($('nic') || $('m-nic') || {}).value || '?';
  const ini = (nick || '?').slice(0, 1).toUpperCase() || '?';

  function applyToCircle(circleId, initId) {
    const circle = $(circleId), init = $(initId); if (!circle || !init) return;
    let img = circle.querySelector('img');
    if (av && av.startsWith('data:')) {
      init.style.display = 'none';
      if (!img) { img = document.createElement('img'); circle.insertBefore(img, circle.firstChild); }
      img.src = av; img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block';
    } else {
      if (img) img.remove(); init.style.display = '';
      init.textContent = av && av.length <= 8 ? av : ini;
      init.style.fontSize = av && av.length <= 8 ? '22px' : '14px';
    }
  }
  applyToCircle('d-avcircle', 'd-avinit');
  applyToCircle('m-avcircle', 'm-avinit');
}

function applyAvToEl(el, av, nick, size) {
  const ini = (nick || '?').slice(0, 2).toUpperCase();
  if (av && av.startsWith('data:')) {
    el.innerHTML = `<img src="${av}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    el.style.padding = '0'; el.style.background = 'none'; el.style.border = 'none';
  } else if (av && av.length <= 8) {
    el.textContent = av; el.style.fontSize = `${Math.round(size * .55)}px`;
    el.style.background = 'none'; el.style.border = 'none';
  } else {
    el.textContent = ini;
  }
}

/* ═══════════════════════════════════════════════
   CRYPTO
═══════════════════════════════════════════════ */
const SALT = new TextEncoder().encode('2ZER011-v2-salt');

async function deriveKey(code) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encMsg(key, txt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(txt));
  const b = new Uint8Array(iv.byteLength + ct.byteLength); b.set(iv); b.set(new Uint8Array(ct), 12);
  return btoa(String.fromCharCode(...b));
}

async function decMsg(key, b64) {
  try {
    const b = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12));
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

/* ═══════════════════════════════════════════════
   PEER
═══════════════════════════════════════════════ */
function initPeer(target) {
  setStat('Connecting...', false); lbar(.3);
  peer = new Peer({ debug: 0, config: ICE });

  peer.on('open', id => {
    myId = id; lbar(.7);
    if (target) {
      roomCode = target;
      deriveKey(roomCode).then(k => { cKey = k; connectToHost(target); });
    } else {
      roomCode = id;
      deriveKey(roomCode).then(k => { cKey = k; lbar(1); setStat('Node active', true); openChat(); });
    }
  });

  peer.on('connection', conn => setupConn(conn, false));
  peer.on('error', err => {
    const m = (err.message || '').toLowerCase();
    const notFound = m.includes('unavailable') || m.includes('not found');
    setStat(notFound ? 'Room not found' : 'Connection error', false, 'e');
    if (notFound) toast('ROOM NOT FOUND');
    lbar(0);
  });
}

function connectToHost(hid) {
  setStat('Connecting to room...', false);
  const conn = peer.connect(hid, { reliable: true, serialization: 'json' });
  conn.on('open', () => {
    lbar(1);
    conn.send({ type: 'join', nick: myNick, pid: myId, av: myAvatar });
    setupConn(conn, true); openChat();
  });
  conn.on('error', () => { setStat('Failed to reach room', false, 'e'); lbar(0); });
}

function setupConn(conn, outgoing) {
  peers[conn.peer] = conn;
  conn.on('open', () => {
    if (!outgoing) {
      const um = {}, avm = {};
      um[myId] = myNick; avm[myId] = myAvatar;
      Object.entries(nicks).forEach(([p, n]) => { um[p] = n; });
      Object.entries(avatars).forEach(([p, a]) => { avm[p] = a; });
      conn.send({ type: 'welcome', users: um, avs: avm });
    }
    refresh();
  });
  conn.on('data', d => handleData(conn.peer, d));
  conn.on('close', () => {
    const n = nicks[conn.peer] || conn.peer.slice(0, 8);
    delete peers[conn.peer]; delete nicks[conn.peer]; delete avatars[conn.peer];
    sysmsg(n + ' disconnected'); refresh();
    if (isHost) bcast({ type: 'left', pid: conn.peer }, conn.peer);
  });
  conn.on('error', () => { delete peers[conn.peer]; delete nicks[conn.peer]; refresh(); });
}

async function handleData(from, d) {
  switch (d.type) {
    case 'join':
      nicks[from] = san(d.nick);
      if (d.av !== undefined) avatars[from] = d.av;
      sysmsg(nicks[from] + ' joined'); refresh();
      if (isHost) bcast({ type: 'pj', pid: from, nick: d.nick, av: d.av }, from);
      break;
    case 'welcome':
      Object.entries(d.users).forEach(([p, n]) => { if (p !== myId) nicks[p] = san(n); });
      if (d.avs) Object.entries(d.avs).forEach(([p, a]) => { if (p !== myId) avatars[p] = a; });
      refresh();
      if (peers[from]) peers[from].send({ type: 'join', nick: myNick, pid: myId, av: myAvatar });
      break;
    case 'pj':
      nicks[d.pid] = san(d.nick);
      if (d.av !== undefined) avatars[d.pid] = d.av;
      sysmsg(nicks[d.pid] + ' joined'); refresh();
      break;
    case 'left': {
      const n = nicks[d.pid] || '???';
      delete nicks[d.pid]; delete avatars[d.pid];
      sysmsg(n + ' left'); refresh(); break;
    }
    case 'msg': {
      if (isHost) bcast(d, from);   // relay before reassemble
      const assembled = tryReassemble(d);
      if (!assembled) break;        // still waiting for more chunks
      const senderId = assembled.from || from;
      const pt = await decMsg(cKey, assembled.enc);
      if (pt !== null) { addMsg(nicks[senderId] || senderId.slice(0, 8), senderId, pt, false, assembled.ts); incMsg(); }
      break;
    }
    case 'typ':
      if (isHost) bcast(d, from); showTyping(nicks[d.from] || '...'); break;
    case 'styp':
      if (isHost) bcast(d, from); clearTyping(); break;
  }
}

function bcast(data, skip = null) {
  Object.entries(peers).forEach(([id, c]) => {
    if (id !== skip && c.open) { try { c.send(data); } catch(e) {} }
  });
}

/* ═══════════════════════════════════════════════
   ROOM ACTIONS
═══════════════════════════════════════════════ */
function createRoom() {
  myNick = san($('nic').value) || rndNick();
  isHost = true; initPeer(null);
}
function joinRoom() {
  const code = ($('rcode').value || '').trim();
  if (!code) { toast('ENTER ROOM CODE'); return; }
  myNick = san($('nic').value) || rndNick();
  isHost = false; initPeer(code);
}
function mCreateRoom() {
  myNick = san($('m-nic').value) || rndNick();
  isHost = true; initPeer(null);
}
function mJoinRoom() {
  const code = ($('m-rcode').value || '').trim();
  if (!code) { toast('ENTER ROOM CODE'); return; }
  myNick = san($('m-nic').value) || rndNick();
  isHost = false; initPeer(code);
}

function openChat() {
  $('boot').classList.remove('active');
  $('chat').classList.add('active');

  // Desktop fields
  se('hrv', roomCode); se('sbrc', roomCode); se('hnv', myNick);
  const smyid = $('smyid'); if (smyid) smyid.textContent = myId ? myId.slice(0, 12) + '...' : '—';

  // Desktop header avatar
  const dhav = $('d-hdr-av');
  if (dhav) applyAvToEl(dhav, myAvatar, myNick, 28);

  // Mobile fields
  se('m-panel-code', roomCode);
  const mtav = $('m-topbar-av');
  if (mtav) applyAvToEl(mtav, myAvatar, myNick, 38);

  nicks[myId] = myNick; avatars[myId] = myAvatar; refresh();
  sysmsg(isHost ? 'Room created — share the code to invite peers' : 'Connected to encrypted channel');
  if (isHost) setTimeout(showRoomModal, 450);

  // Setup inputs
  if (IS_MOB) {
    const inp = $('mMsgInp');
    if (inp) {
      inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
      inp.oninput = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 108) + 'px'; bcastTyping(); clearTimeout(typTm); typTm = setTimeout(clearTypingBcast, 2200); };
      setTimeout(() => inp.focus(), 300);
    }
  } else {
    const inp = $('msgInp');
    if (inp) {
      inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
      inp.oninput = () => { bcastTyping(); clearTimeout(typTm); typTm = setTimeout(clearTypingBcast, 2200); };
      inp.focus();
    }
    startUptime();
  }
}

function leaveRoom() {
  Object.values(peers).forEach(c => { try { c.close(); } catch(e) {} });
  if (peer) peer.destroy();
  peers = {}; nicks = {}; avatars = {}; msgCount = 0; cKey = null;
  lastAuth = null; lastGrp = null;
  $('chat').classList.remove('active');
  $('boot').classList.add('active');
  $('msgs').innerHTML = '';
  mClosePanel();
  setStat('Disconnected', false);
}

function copyCode() { copyToClipboard(roomCode, 'CODE COPIED'); }

/* ═══════════════════════════════════════════════
   MESSAGING
═══════════════════════════════════════════════ */
function sendMsg() {
  if (!cKey) return;
  if (pendingImg) {
    const { url, name, dev } = pendingImg;
    const captInp = $(dev === 'd' ? 'msgInp' : 'mMsgInp');
    const cap = captInp ? captInp.value.trim() : '';
    cancelImg(dev); if (captInp) captInp.value = '';
    const payload = '__IMG__' + url + (cap ? '__CAP__' + cap : '');
    encMsg(cKey, payload).then(e => {
      const p = { type: 'msg', enc: e, from: myId, ts: Date.now() };
      if (isHost) bcast(p); else { const h = peers[roomCode]; if (h && h.open) h.send(p); }
      addMsg(myNick, myId, payload, true, Date.now()); incMsg();
    });
    return;
  }
  const inp = $(IS_MOB ? 'mMsgInp' : 'msgInp');
  const txt = inp.value.trim(); if (!txt) return;
  inp.value = ''; if (IS_MOB) inp.style.height = 'auto'; clearTypingBcast();
  encMsg(cKey, txt).then(e => {
    const p = { type: 'msg', enc: e, from: myId, ts: Date.now() };
    sendLargeMsg(p);
    addMsg(myNick, myId, txt, true, Date.now()); incMsg();
  });
}

function bcastTyping() {
  const p = { type: 'typ', from: myId };
  if (isHost) bcast(p); else { const h = peers[roomCode]; if (h && h.open) h.send(p); }
}
function clearTypingBcast() {
  clearTimeout(typTm);
  const p = { type: 'styp', from: myId };
  if (isHost) bcast(p); else { const h = peers[roomCode]; if (h && h.open) h.send(p); }
}

let typT2;
function showTyping(nick) {
  const el = $(IS_MOB ? 'm-tbar' : 'd-tbar'); if (!el) return;
  if (IS_MOB) {
    el.textContent = nick + ' is typing...';
  } else {
    el.innerHTML = `<span style="color:var(--tx3)">${nick}</span>&nbsp;<span class="tdots"><span></span><span></span><span></span></span>&nbsp;TRANSMITTING`;
  }
  clearTimeout(typT2); typT2 = setTimeout(clearTyping, 3000);
}
function clearTyping() {
  const el = $(IS_MOB ? 'm-tbar' : 'd-tbar'); if (el) el.innerHTML = '';
}

/* ═══════════════════════════════════════════════
   IMAGE SEND  (max 480px JPEG 0.62 → ~40-100KB base64)
═══════════════════════════════════════════════ */
const IMG_MAX = 480, IMG_Q = 0.62, CHUNK_SIZE = 180000;
const chunkBuf = {};

function sendPayload(p) {
  if (isHost) bcast(p);
  else { const h = peers[roomCode]; if (h && h.open) h.send(p); }
}

function sendLargeMsg(payload) {
  const enc = payload.enc;
  if (enc.length <= CHUNK_SIZE) { sendPayload(payload); return; }
  const id = Math.random().toString(36).slice(2);
  const chunks = [];
  for (let i = 0; i < enc.length; i += CHUNK_SIZE) chunks.push(enc.slice(i, i + CHUNK_SIZE));
  chunks.forEach((chunk, idx) => sendPayload({ ...payload, enc: chunk, _ck: { id, idx, total: chunks.length } }));
}

function tryReassemble(d) {
  if (!d._ck) return d;
  const { id, idx, total } = d._ck;
  if (!chunkBuf[id]) chunkBuf[id] = { chunks: new Array(total), n: 0, base: { ...d, enc: '' } };
  chunkBuf[id].chunks[idx] = d.enc;
  chunkBuf[id].n++;
  if (chunkBuf[id].n === total) {
    const r = { ...chunkBuf[id].base, enc: chunkBuf[id].chunks.join('') };
    delete r._ck; delete chunkBuf[id]; return r;
  }
  return null;
}

function handleChatImg(inp, dev) {
  const f = inp.files[0]; if (!f || !f.type.startsWith('image/')) { toast('IMAGE FILES ONLY'); return; }
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > IMG_MAX || h > IMG_MAX) { if (w > h) { h = Math.round(h * IMG_MAX / w); w = IMG_MAX; } else { w = Math.round(w * IMG_MAX / h); h = IMG_MAX; } }
      cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const url = cv.toDataURL('image/jpeg', IMG_Q);
      pendingImg = { url, name: f.name || 'image.jpg', dev };
      if (dev === 'd') {
        $('d-imgpre-thumb').src = url; se('d-imgpre-name', f.name || 'image.jpg');
        $('d-imgpre').classList.add('show');
        $('msgInp').placeholder = 'Add caption... (optional)'; $('msgInp').focus();
      } else {
        $('m-imgpre-thumb').src = url; se('m-imgpre-name', f.name || 'image.jpg');
        $('m-imgpre').classList.add('show');
        $('mMsgInp').placeholder = 'Caption...'; $('mMsgInp').focus();
      }
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(f); inp.value = '';
}

function cancelImg(dev) {
  pendingImg = null;
  if (dev === 'd') { $('d-imgpre').classList.remove('show'); $('msgInp').placeholder = 'type message — enter to send...'; }
  else { $('m-imgpre').classList.remove('show'); $('mMsgInp').placeholder = 'Message...'; }
}

function openImgViewer(src) { $('ivImg').src = src; $('imgViewer').classList.add('show'); }
function closeImgViewer() { $('imgViewer').classList.remove('show'); $('ivImg').src = ''; }

/* ═══════════════════════════════════════════════
   DOM — MESSAGES
═══════════════════════════════════════════════ */
function avHtml(pid, size) {
  const av = pid === myId ? myAvatar : (avatars[pid] || '');
  const nick = pid === myId ? myNick : (nicks[pid] || '?');
  const ini = (nick || '?').slice(0, 2).toUpperCase();
  const cls = IS_MOB ? 'm-mg-av' : 'd-mg-av';
  const st = `width:${size}px;height:${size}px`;
  if (av && av.startsWith('data:')) return `<div class="${cls}" style="${st};padding:0;background:none;border:none"><img src="${av}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`;
  if (av && av.length <= 8) return `<div class="${cls}" style="${st};background:none;border:none;font-size:${Math.round(size*.55)}px">${av}</div>`;
  return `<div class="${cls}" style="${st}">${ini}</div>`;
}

function addMsg(auth, pid, txt, self, ts) {
  const msgs = $('msgs');
  const time = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const key = (pid || auth) + (self ? '~' : '');
  const isImg = txt.startsWith('__IMG__');

  if (lastAuth !== key) {
    lastGrp = document.createElement('div');
    lastGrp.className = (IS_MOB ? 'm-mg' : 'd-mg') + (self ? ' self' : '');

    const hdr = document.createElement('div');
    hdr.className = IS_MOB ? 'm-mg-hdr' : 'd-mg-hdr';
    hdr.innerHTML = avHtml(pid || auth, IS_MOB ? 25 : 22)
      + `<span class="${IS_MOB ? 'm-mg-name' : 'd-mg-author'}">${esc(auth)}</span>`
      + `<span class="${IS_MOB ? 'm-mg-time' : 'd-mg-time'}">${time}</span>`;
    lastGrp.appendChild(hdr);

    if (IS_MOB) { const bc = document.createElement('div'); bc.className = 'm-bubbles'; lastGrp.appendChild(bc); }
    msgs.appendChild(lastGrp); lastAuth = key;
  }

  const container = IS_MOB ? (lastGrp.querySelector('.m-bubbles') || lastGrp) : lastGrp;

  if (isImg) {
    const parts = txt.slice(7).split('__CAP__');
    const src = parts[0], cap = parts[1] || '';
    const wrap = document.createElement('div');
    wrap.className = (IS_MOB ? 'm-img-wrap' : 'd-img-wrap') + (self ? ' self' : '');
    const img = document.createElement('img');
    img.src = src; img.alt = ''; img.onclick = () => openImgViewer(src);
    if (IS_MOB) img.style.borderRadius = self ? '14px 4px 10px 10px' : '4px 14px 10px 10px';
    wrap.appendChild(img);
    if (cap) {
      const c = document.createElement('div'); c.className = IS_MOB ? 'm-img-cap' : 'd-img-cap'; c.textContent = cap; wrap.appendChild(c);
    }
    container.appendChild(wrap);
  } else {
    const b = document.createElement('div');
    b.className = (IS_MOB ? 'm-bubble' : 'd-bubble') + (self ? ' self' : '');
    b.textContent = txt; container.appendChild(b);
  }
  msgs.scrollTop = msgs.scrollHeight;
}

function sysmsg(txt) {
  lastAuth = null; lastGrp = null;
  const el = document.createElement('div'); el.className = IS_MOB ? 'm-sys' : 'd-sys';
  el.innerHTML = `<span>${esc(txt)}</span>`;
  $('msgs').appendChild(el); $('msgs').scrollTop = 99999;
}

function incMsg() {
  msgCount++; se('tmsgs', msgCount); se('sbmc', msgCount);
}

/* ═══════════════════════════════════════════════
   REFRESH UI
═══════════════════════════════════════════════ */
function refresh() {
  const pc = Object.keys(peers).length;
  se('tpeers', pc); se('pcount', pc);

  const mps = $('m-peer-st'); if (mps) mps.textContent = pc === 0 ? 'Waiting for peers...' : `${pc} peer${pc > 1 ? 's' : ''} connected`;

  const all = [[myId, myNick, true], ...Object.entries(nicks).filter(([id]) => id !== myId).map(([id, n]) => [id, n, false])];

  // Desktop user list
  const ul = $('ulist');
  if (ul) {
    ul.innerHTML = '';
    all.forEach(([id, nick, isMe]) => {
      const av = isMe ? myAvatar : (avatars[id] || '');
      const ini = (nick || '?').slice(0, 2).toUpperCase();
      let avEl;
      if (av && av.startsWith('data:')) avEl = `<div class="d-uav" style="padding:0;background:none;border:none"><img src="${av}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`;
      else if (av && av.length <= 8) avEl = `<div class="d-uav" style="background:none;border:none;font-size:14px">${av}</div>`;
      else avEl = `<div class="d-uav${isMe ? ' me' : ''}">${ini}</div>`;
      const item = document.createElement('div'); item.className = 'd-ui' + (isMe ? ' me' : '');
      item.innerHTML = avEl + `<div class="d-uname">${esc(nick)}</div><div class="d-utag">${isMe ? 'YOU' : 'PEER'}</div><div class="d-uonl"></div>`;
      ul.appendChild(item);
    });
  }

  // Mobile peer list
  const mpl = $('m-peer-list');
  if (mpl) {
    mpl.innerHTML = '';
    all.forEach(([id, nick, isMe]) => {
      const av = isMe ? myAvatar : (avatars[id] || '');
      const ini = (nick || '?').slice(0, 2).toUpperCase();
      let avEl;
      if (av && av.startsWith('data:')) avEl = `<div class="m-peer-av" style="padding:0"><img src="${av}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`;
      else if (av && av.length <= 8) avEl = `<div class="m-peer-av" style="background:none;border-color:rgba(20,20,80,.4);font-size:18px">${av}</div>`;
      else avEl = `<div class="m-peer-av${isMe ? ' me' : ''}">${ini}</div>`;
      const item = document.createElement('div'); item.className = 'm-peer-item' + (isMe ? ' me' : '');
      item.innerHTML = avEl + `<div class="m-peer-name">${esc(nick)}</div><div class="m-peer-tag">${isMe ? 'You' : 'Peer'}</div>`;
      mpl.appendChild(item);
    });
  }

  // Desktop alert
  const da = $('d-alert'), dd = $('d-adot'), dt = $('d-atxt');
  if (da && dd && dt) {
    if (pc === 0) { da.className = 'd-alert w'; dd.className = 'pulse warn'; dt.textContent = 'SHARE CODE TO BEGIN ENCRYPTED SESSION'; }
    else { da.className = 'd-alert k'; dd.className = 'pulse on'; dt.textContent = `${pc} PEER${pc > 1 ? 'S' : ''} CONNECTED — E2E ENCRYPTED`; setTimeout(() => { if (da.className.includes('k')) da.className = 'd-alert'; }, 3500); }
  }

  // Mobile alert
  const ma = $('m-alert');
  if (ma) {
    if (pc === 0) { ma.className = 'm-alert w'; ma.textContent = 'Share room code to invite peers'; }
    else { ma.className = 'm-alert k'; ma.textContent = `${pc} peer${pc > 1 ? 's' : ''} connected — encrypted`; setTimeout(() => { if (ma.className.includes('k')) ma.className = 'm-alert'; }, 3500); }
  }
}

function setStat(txt, ok, m = '') {
  const dot = $('bdot'), label = $('bstxt');
  if (dot) dot.className = 'pulse' + (ok ? ' on' : m === 'e' ? ' err' : '');
  if (label) label.textContent = txt.toUpperCase();
  const mdot = $('m-bdot'), mlabel = $('m-bstxt');
  if (mdot) mdot.className = 'pulse' + (ok ? ' on' : m === 'e' ? ' err' : '');
  if (mlabel) mlabel.textContent = txt;
}

/* ═══════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════ */
function showRoomModal() { se('rcm-code', roomCode); $('rcmodal').classList.add('show'); }
function rcmClose() { $('rcmodal').classList.remove('show'); }
function rcmCopy() {
  copyToClipboard(roomCode, 'CODE COPIED');
  const b = document.querySelector('.rcm-copy'); if (!b) return;
  b.textContent = 'COPIED!'; b.style.background = '#00cc66';
  setTimeout(() => { b.textContent = 'COPY CODE'; b.style.background = ''; }, 1800);
}

/* ═══════════════════════════════════════════════
   MOBILE PANEL
═══════════════════════════════════════════════ */
function mOpenPanel() { $('m-panel').classList.add('open'); $('m-panel-ov').classList.add('show'); }
function mClosePanel() { const p = $('m-panel'), o = $('m-panel-ov'); if (p) p.classList.remove('open'); if (o) o.classList.remove('show'); }
function mCopyCode() { copyToClipboard(roomCode, 'CODE COPIED'); mClosePanel(); }

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  buildPresets();

  if (!IS_MOB) {
    initRain();
    initHexStreams();
    runBootTerminal();
  }

  setTimeout(() => setStat('Ready — create or join a room', true), IS_MOB ? 300 : 1500);

  // Desktop inputs
  const ni = $('nic');
  if (ni) { ni.placeholder = rndNick() + '...'; ni.oninput = updateAvUI; ni.onkeydown = e => { if (e.key === 'Enter') createRoom(); }; }
  const ri = $('rcode');
  if (ri) ri.onkeydown = e => { if (e.key === 'Enter') joinRoom(); };

  // Mobile inputs
  const mni = $('m-nic');
  if (mni) { mni.placeholder = rndNick() + '...'; mni.oninput = updateAvUI; mni.onkeydown = e => { if (e.key === 'Enter') mCreateRoom(); }; }
  const mri = $('m-rcode');
  if (mri) mri.onkeydown = e => { if (e.key === 'Enter') mJoinRoom(); };

  // Paste image (desktop)
  document.addEventListener('paste', e => {
    if (!cKey) return;
    const items = e.clipboardData && e.clipboardData.items; if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const f = item.getAsFile(); if (!f) break;
        const dt = new DataTransfer(); dt.items.add(f);
        const inp = $('d-img-inp'); inp.files = dt.files; handleChatImg(inp, 'd'); break;
      }
    }
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImgViewer(); });
});
