const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clawslap', {
  // Overlay events
  onSlap: (fn) => ipcRenderer.on('slap', (_e, d) => fn(d)),
  onSoothe: (fn) => ipcRenderer.on('soothe', () => fn()),
  onState: (fn) => ipcRenderer.on('state', (_, s) => fn(s)),
  onOpenStats: (fn) => ipcRenderer.on('open-stats', () => fn()),

  // Actions
  toggle: () => ipcRenderer.send('toggle'),
  recordSoothe: () => ipcRenderer.send('record-soothe'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  movePet: (dx, dy) => ipcRenderer.send('move-pet', { dx, dy }),
  openStats: () => ipcRenderer.send('open-stats'),
});

console.log('[ClawSlap] preload loaded');
