const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {

// ── Stats (persisted to disk) ────────────────────────────────────────────────
const STATS_PATH = path.join(app.getPath('userData'), 'clawslap-stats.json');
let stats = {};

function loadStats() {
  try { stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8')) || {}; }
  catch (_) { stats = {}; }
}
function saveStats() {
  try { fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), 'utf8'); }
  catch (_) {}
}
function today() { return new Date().toISOString().slice(0, 10); }
function trimStats() {
  const keys = Object.keys(stats).sort();
  while (keys.length > 30) { delete stats[keys.shift()]; }
}
loadStats();

// ── Window title detection (Windows / koffi) ────────────────────────────────
let getForegroundWindowTitle = null;
let getForegroundProcessName = null;
if (process.platform === 'win32') {
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');

    const GetForegroundWindow = user32.func('long __stdcall GetForegroundWindow()');
    const GetWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(long hWnd)');
    const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(long hWnd, void* lpString, int nMaxCount)');
    const GetWindowThreadProcessId = user32.func('unsigned long __stdcall GetWindowThreadProcessId(long hWnd, void* lpdwProcessId)');

    // Toolhelp32 snapshot — more reliable than OpenProcess (no admin required)
    const CreateToolhelp32Snapshot = kernel32.func('long __stdcall CreateToolhelp32Snapshot(unsigned long dwFlags, unsigned long th32ProcessID)');
    const Process32FirstW = kernel32.func('int __stdcall Process32FirstW(long hSnapshot, void* lppe)');
    const Process32NextW = kernel32.func('int __stdcall Process32NextW(long hSnapshot, void* lppe)');
    const CloseHandle = kernel32.func('int __stdcall CloseHandle(long hObject)');

    const TH32CS_SNAPPROCESS = 0x00000002;

    getForegroundWindowTitle = () => {
      const hwnd = GetForegroundWindow();
      if (!hwnd) return '';
      const len = GetWindowTextLengthW(hwnd);
      if (len <= 0) return '';
      const buf = Buffer.alloc((len + 1) * 2);
      GetWindowTextW(hwnd, buf, buf.length);
      return buf.toString('utf16le', 0, len * 2).trim();
    };

    getForegroundProcessName = () => {
      const hwnd = GetForegroundWindow();
      if (!hwnd) return '';
      const pidBuf = Buffer.alloc(4);
      GetWindowThreadProcessId(hwnd, pidBuf);
      const pid = pidBuf.readUInt32LE(0);
      if (!pid) return '';

      // Enumerate processes via snapshot to find this PID's exe name
      const snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
      if (snap <= 0) return '';

      // PROCESSENTRY32W: dwSize(4) + padding(4) + cntUsage(4) + th32ProcessID(4) +
      //   th32DefaultHeapID(4) + th32ModuleID(4) + cntThreads(4) +
      //   th32ParentProcessID(4) + pcPriClassBase(4) + dwFlags(4) +
      //   szExeFile(260 * 2)
      const peSize = 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 260 * 2; // 556
      const pe = Buffer.alloc(peSize);
      pe.writeUInt32LE(peSize, 0);

      let found = '';
      if (Process32FirstW(snap, pe)) {
        do {
          const entryPid = pe.readUInt32LE(8);
          if (entryPid === pid) {
            // szExeFile starts at offset 36
            found = pe.toString('utf16le', 36, 36 + 260 * 2).replace(/\0.*$/, '');
            break;
          }
        } while (Process32NextW(snap, pe));
      }
      CloseHandle(snap);
      return found.toLowerCase().replace('.exe', '');
    };
  } catch (e) {
    console.warn('[ClawSlap] koffi not available:', e.message);
  }
}

function getWindowInfo() {
  const raw = getForegroundWindowTitle ? getForegroundWindowTitle() : '';
  const proc = getForegroundProcessName ? getForegroundProcessName() : '';

  // Detect app by process name first (works for split-screen / windowed mode)
  let app = 'Other';
  const procs = {
    'claude': 'Claude',
    'code': 'VSCode',
    'chrome': 'Chrome',
    'firefox': 'Firefox',
    'msedge': 'Edge',
    'windowsterminal': 'Terminal',
    'cmd': 'Terminal',
    'conhost': 'Terminal',
    'powershell': 'Terminal',
    'bash': 'Terminal',
    'slack': 'Slack',
    'discord': 'Discord',
    'notion': 'Notion',
    'wechat': 'WeChat',
    'weixin': 'WeChat',
    'wps': 'WPS',
    'wpp': 'WPS',
    'et': 'WPS',
    'outlook': 'Outlook',
    'mail': 'Mail',
    'thunderbird': 'Thunderbird',
    'foxmail': 'Foxmail',
  };
  for (const [key, name] of Object.entries(procs)) {
    if (proc === key) { app = name; break; }
  }

  // Fallback: detect by window title substring (catches apps whose
  // process name can't be read or doesn't match the mapping above)
  if (app === 'Other' && raw) {
    const titleDetects = {
      'WPS': 'WPS',
      'wps': 'WPS',
      'Claude': 'Claude', 'claude': 'Claude',
      'Visual Studio Code': 'VSCode', 'VSCode': 'VSCode',
      'Chrome': 'Chrome', 'Google Chrome': 'Chrome',
      'Firefox': 'Firefox',
      'Edge': 'Edge',
      'Terminal': 'Terminal', 'cmd': 'Terminal', 'bash': 'Terminal', 'PowerShell': 'Terminal',
      'Slack': 'Slack', 'Discord': 'Discord', 'Notion': 'Notion',
      '微信': 'WeChat', 'WeChat': 'WeChat',
      'Outlook': 'Outlook',
      'Foxmail': 'Foxmail',
    };
    for (const [key, name] of Object.entries(titleDetects)) {
      if (raw.includes(key)) { app = name; break; }
    }
  }

  // Extract page/section from window title
  // Browsers: "Page Title - Google Chrome" → "Page Title"
  // VSCode: "file.ts - Project - Visual Studio Code" → "file.ts - Project"
  let page = raw;
  const knownSuffixes = [
    ' - Google Chrome', ' - Chrome', ' - Microsoft Edge', ' - Edge',
    ' - Mozilla Firefox', ' - Firefox', ' - Visual Studio Code', ' - VSCode',
    ' - Slack', ' - Discord', ' - Notion',
  ];
  for (const suffix of knownSuffixes) {
    if (raw.endsWith(suffix)) {
      page = raw.slice(0, -suffix.length).trim();
      break;
    }
  }

  return { app, title: raw, page };
}

function getCurrentAppName() {
  return getWindowInfo().app;
}

function recordSlap() {
  loadStats();
  const d = today();
  if (!stats[d]) stats[d] = { slaps: [], soothes: [] };
  const now = new Date();
  const info = getWindowInfo();
  stats[d].slaps.push({ h: now.getHours(), m: now.getMinutes(), app: info.app, page: info.page });
  trimStats(); saveStats();
}
function recordSoothe() {
  loadStats();
  const d = today();
  if (!stats[d]) stats[d] = { slaps: [], soothes: [] };
  const now = new Date();
  const info = getWindowInfo();
  stats[d].soothes.push({ h: now.getHours(), m: now.getMinutes(), app: info.app, page: info.page });
  trimStats(); saveStats();
}

// ── QWERTY key map ──────────────────────────────────────────────────────────
const KEY_MAP = new Map();
['qwertyuiop','asdfghjkl','zxcvbnm'].forEach((row, y) => {
  const ox = (10 - row.length) * 0.5;
  [...row].forEach((ch, x) => KEY_MAP.set(ch, [x + ox, y]));
});

// ── Win32 keyboard / cursor hook ─────────────────────────────────────────────
let GetAsyncKeyState, GetCursorPosFn;
const user32Lib = (() => {
  if (process.platform === 'win32') {
    try {
      const koffi = require('koffi');
      const u32 = koffi.load('user32.dll');
      return u32;
    } catch (e) { console.warn('[ClawSlap] koffi unavailable:', e.message); }
  }
  return null;
})();
if (user32Lib) {
  GetAsyncKeyState = user32Lib.func('int16_t __stdcall GetAsyncKeyState(int vKey)');
  // POINT is an 8-byte struct (x: i32, y: i32)
  GetCursorPosFn = user32Lib.func('int __stdcall GetCursorPos(void* lpPoint)');
}

// ── Globals ──────────────────────────────────────────────────────────────────
let tray, overlay, petWin;
let overlayReady = false, petReady = false;
let enabled = true;
let overlayBounds = null;

function createFallbackIcon() {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = x - size / 2, cy = y - size / 2;
      const r = Math.sqrt(cx * cx + cy * cy);
      if (r < size / 2 - 2 && r > size / 2 - 5) {
        buf[i] = 0x4A; buf[i+1] = 0x6A; buf[i+2] = 0x9A; buf[i+3] = 255;
      } else if (r < size / 3) {
        buf[i] = 0x7B; buf[i+1] = 0xA3; buf[i+2] = 0xD9; buf[i+3] = 255;
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

async function getTrayIcon() {
  for (const p of ['icon/icon.ico', 'icon/Template.png']) {
    const fp = path.join(__dirname, p);
    if (fs.existsSync(fp)) {
      const img = nativeImage.createFromPath(fp);
      if (!img.isEmpty()) return img;
    }
  }
  return createFallbackIcon();
}

// ── Overlay window (effects only, transparent & mouse-through) ──────────────
function createOverlay() {
  const { bounds } = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlayBounds = bounds;
  overlayReady = false;
  overlay.loadFile('overlay.html');
  overlay.webContents.on('did-finish-load', () => {
    overlayReady = true;
  });
  overlay.on('closed', () => { overlay = null; overlayReady = false; });
}

// ── Pet window (interactive, movable, bottom-right corner) ──────────────────
function createPetWindow() {
  const { bounds } = screen.getPrimaryDisplay();
  petWin = new BrowserWindow({
    x: bounds.x + bounds.width - 140,
    y: bounds.y + bounds.height - 140,
    width: 140,
    height: 140,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  petWin.setAlwaysOnTop(true, 'screen-saver');
  petReady = false;
  petWin.loadFile('pet.html');
  petWin.webContents.on('did-finish-load', () => {
    petReady = true;
  });
  petWin.on('closed', () => { petWin = null; petReady = false; });
}

function showAll() {
  if (!overlay) createOverlay();
  if (!petWin) createPetWindow();
  overlay.showInactive();
  petWin.showInactive();
}

function hideAll() {
  if (overlay) overlay.hide();
  if (petWin) petWin.hide();
}

function toggleAll() {
  if (overlay && overlay.isVisible()) hideAll();
  else showAll();
}

// ── Mouse fast-swipe detection (hand-slap gesture) ───────────────────────────
let lastCursorPos = null;
let lastCursorTime = 0;
let mouseSwipeCooldown = 0;

// ── Triple-click detection (RIGHT mouse button) ────────────────────────────
let clickTimestamps = [];
const TRIPLE_CLICK_WINDOW = 600;   // 3 clicks within 600ms total
const MAX_CLICK_GAP = 250;         // max 250ms between consecutive clicks
const VK_RBUTTON = 0x02;           // right mouse button virtual key
let mouseBtnPrev = false;

function pollMouseSwipe() {
  if (!enabled || !GetCursorPosFn) return;

  const buf = Buffer.alloc(8);
  GetCursorPosFn(buf);
  const x = buf.readInt32LE(0);
  const y = buf.readInt32LE(4);
  const now = Date.now();

  // ── Triple-click detection (edge-triggered, RIGHT button) ─────────────────
  const mouseDown = (GetAsyncKeyState(VK_RBUTTON) & 0x8000) !== 0;
  if (mouseDown && !mouseBtnPrev) {
    clickTimestamps.push(now);
    // Purge clicks outside the detection window
    while (clickTimestamps.length > 0 && clickTimestamps[0] < now - TRIPLE_CLICK_WINDOW) {
      clickTimestamps.shift();
    }
    // Check for triple-click with tight gaps
    if (clickTimestamps.length >= 3) {
      let maxGap = 0;
      for (let i = 1; i < clickTimestamps.length; i++) {
        maxGap = Math.max(maxGap, clickTimestamps[i] - clickTimestamps[i - 1]);
      }
      if (maxGap <= MAX_CLICK_GAP) {
        triggerTripleClickSlap(now);
        clickTimestamps = [];
      }
    }
  }
  mouseBtnPrev = mouseDown;

  if (lastCursorPos && now < mouseSwipeCooldown + 1000) {
    lastCursorPos = { x, y }; lastCursorTime = now;
    return;
  }

  if (lastCursorPos && lastCursorTime > 0) {
    const dt = now - lastCursorTime;
    const dist = Math.hypot(x - lastCursorPos.x, y - lastCursorPos.y);
    const speed = dist / Math.max(dt, 1); // px/ms

    // Fast swipe: >800px within 300ms (~3px/ms) — a "slap" gesture
    if (speed > 9.23 && dist > 630 && dt < 350) {
      const dir = x - lastCursorPos.x > 0 ? 'right' : 'left';
      mouseSwipeCooldown = now;
      lastSlap = now;
      recordSlap();
      console.log('[ClawSlap] SLAP via mouse swipe! speed:', speed.toFixed(1), 'dist:', dist.toFixed(0), 'dir:', dir);

      // Use Electron's DPI-aware screen API for accurate overlay coordinates
      const spt = screen.getCursorScreenPoint();
      const sx = spt.x - (overlayBounds ? overlayBounds.x : 0);
      const sy = spt.y - (overlayBounds ? overlayBounds.y : 0);
      if (overlayReady && overlay && overlay.isVisible()) {
        overlay.webContents.send('slap', { direction: dir, x: sx, y: sy });
      }
      if (petReady && petWin && petWin.isVisible()) {
        petWin.webContents.send('slap');
      }
    }
  }

  lastCursorPos = { x, y };
  lastCursorTime = now;
}

// Triple-click slap trigger (right mouse button) — instant 👋 at cursor
function triggerTripleClickSlap(now) {
  lastSlap = now;
  mouseSwipeCooldown = now;
  recordSlap();
  // Use Electron's screen API for DPI-aware (DIP) coordinates
  const pt = screen.getCursorScreenPoint();
  const cx = pt.x - (overlayBounds ? overlayBounds.x : 0);
  const cy = pt.y - (overlayBounds ? overlayBounds.y : 0);
  const dir = Math.random() > 0.5 ? 'left' : 'right';
  console.log('[ClawSlap] SLAP via right-triple-click! x:', cx, 'y:', cy);
  if (overlayReady && overlay && overlay.isVisible()) {
    // "instant" type: no swoop, just pop at cursor
    overlay.webContents.send('slap', { direction: dir, x: cx, y: cy, instant: true });
  }
  if (petReady && petWin && petWin.isVisible()) {
    petWin.webContents.send('slap');
  }
}

// ── Keyboard polling ────────────────────────────────────────────────────────
let lastSlap = 0;
const VK_MAP = {};
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((ch, i) => { VK_MAP[ch] = 0x41 + i; });

function isKeyDown(vk) {
  if (!GetAsyncKeyState) return false;
  return (GetAsyncKeyState(vk) & 0x8000) !== 0;
}

function pollKeyboard() {
  if (!enabled) return;

  const active = [];
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
    const vk = VK_MAP[ch.toUpperCase()];
    if (vk && isKeyDown(vk)) active.push(ch);
  }
  if (active.length < 3) return;

  const now = Date.now();
  if (now < lastSlap + 480) return;

  const pts = active.map(ch => ({ ch, pos: KEY_MAP.get(ch) })).filter(x => x.pos);

  // Build adjacency graph: 8-directional neighbors on QWERTY grid
  const adj = new Map();
  for (const a of pts) {
    const set = new Set();
    for (const b of pts) {
      if (a === b) continue;
      const dx = Math.abs(a.pos[0] - b.pos[0]);
      const dy = Math.abs(a.pos[1] - b.pos[1]);
      if (dx <= 1 && dy <= 1) set.add(b.ch);
    }
    adj.set(a.ch, set);
  }

  // BFS to find largest connected component
  const visited = new Set();
  let best = 1;
  for (const { ch } of pts) {
    if (visited.has(ch)) continue;
    let size = 0;
    const queue = [ch];
    visited.add(ch);
    while (queue.length) {
      const cur = queue.shift();
      size++;
      for (const nb of (adj.get(cur) || [])) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }
    best = Math.max(best, size);
  }

  if (best >= 3) {
    lastSlap = now;
    recordSlap();
    console.log('[ClawSlap] SLAP! keys:', active.join(''), 'cluster:', best);

    if (overlayReady && overlay && overlay.isVisible()) {
      // Use Electron's DPI-aware screen API for accurate overlay coordinates
      const kpt = screen.getCursorScreenPoint();
      const kx = kpt.x - (overlayBounds ? overlayBounds.x : 0);
      const ky = kpt.y - (overlayBounds ? overlayBounds.y : 0);
      overlay.webContents.send('slap', { direction: 'left', x: kx, y: ky });
    }
    // Send to pet for reaction
    if (petReady && petWin && petWin.isVisible()) {
      petWin.webContents.send('slap');
    }
  }
}

// ── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.on('toggle', () => { enabled = !enabled; });
ipcMain.handle('get-stats', () => { loadStats(); return stats; });
ipcMain.on('record-soothe', () => { recordSoothe(); });

// Pet movement
ipcMain.on('move-pet', (_e, { dx, dy }) => {
  if (!petWin) return;
  const [wx, wy] = petWin.getPosition();
  petWin.setPosition(wx + Math.round(dx), wy + Math.round(dy));
});

// Open stats (from pet right-click)
ipcMain.on('open-stats', () => {
  loadStats();
  if (overlayReady && overlay) overlay.webContents.send('open-stats');
});

// ── Start ────────────────────────────────────────────────────────────────────
tray = new Tray(await getTrayIcon());
tray.setToolTip('ClawSlap');
tray.setContextMenu(Menu.buildFromTemplate([
  { label: 'Enable ClawSlap', type: 'checkbox', checked: true, click: (mi) => { enabled = mi.checked; } },
  { label: 'Stats (30 days)', click: () => { if (overlayReady && overlay) { loadStats(); overlay.webContents.send('open-stats'); } } },
  { label: 'Reset Pet Position', click: () => { if (petWin) { const { bounds } = screen.getPrimaryDisplay(); petWin.setPosition(bounds.x + bounds.width - 140, bounds.y + bounds.height - 140); } } },
  { type: 'separator' },
  { label: 'Quit', click: () => app.quit() },
]));
tray.on('click', toggleAll);
tray.on('double-click', toggleAll);
showAll();
console.log('[ClawSlap] Started! Polling keyboard + mouse every 60ms...');
setInterval(pollKeyboard, 100);
setInterval(pollMouseSwipe, 60);

}); // end app.whenReady()

app.on('window-all-closed', e => e.preventDefault());

// ── Pet window drag IPC (needs to bypass mouse-ignore temporarily) ───────────
ipcMain.on('start-drag', () => {
  // The pet window handles its own drag via -webkit-app-region
  // This is just a placeholder — actual drag is done in pet.html
});
