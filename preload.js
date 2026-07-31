const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dex', {
  getDevices: () => ipcRenderer.invoke('devices:get'),
  startMirror: (serial, options) => ipcRenderer.invoke('mirror:start', { serial, options }),
  stopMirror: (serial) => ipcRenderer.invoke('mirror:stop', serial),
  startRecording: (serial, options) => ipcRenderer.invoke('record:start', { serial, options }),
  stopRecording: (serial) => ipcRenderer.invoke('record:stop', serial),
  takeScreenshot: (serial) => ipcRenderer.invoke('device:screenshot', serial),
  rebootDevice: (serial) => ipcRenderer.invoke('device:reboot', serial),
  enableTcpIp: (serial, port) => ipcRenderer.invoke('device:tcpip', { serial, port }),
  connectWifi: (ip, port) => ipcRenderer.invoke('wifi:connect', { ip, port }),
  setProxy: (serial, proxyStr) => ipcRenderer.invoke('device:setProxy', { serial, proxyStr }),
  clearProxy: (serial) => ipcRenderer.invoke('device:clearProxy', serial),
  turnScreenOff: (serial) => ipcRenderer.invoke('device:turnScreenOff', serial),
  toggleScreenPower: (serial, turnOff) => ipcRenderer.invoke('device:toggleScreenPower', { serial, turnOff }),
  runShell: (serial, command) => ipcRenderer.invoke('device:shell', { serial, command }),
  localTerminal: (command) => ipcRenderer.invoke('system:localTerminal', command),
  onDevicesUpdated: (callback) => {
    ipcRenderer.on('devices:updated', (event, data) => callback(data));
  },
  onSystemLog: (callback) => {
    ipcRenderer.on('system:log', (event, logEntry) => callback(logEntry));
  },
  getMediaList: () => ipcRenderer.invoke('media:getList'),
  openMediaFile: (path) => ipcRenderer.invoke('media:openFile', path),
  openMediaFolder: () => ipcRenderer.invoke('media:openFolder'),
  deleteMediaFile: (path) => ipcRenderer.invoke('media:deleteFile', path),
  renameMediaFile: (oldPath, newName) => ipcRenderer.invoke('media:renameFile', { oldPath, newName }),
  sendKeyEvent: (serial, keycode) => ipcRenderer.invoke('device:sendKeyEvent', { serial, keycode }),
  sendTap: (serial, x, y) => ipcRenderer.invoke('device:sendTap', { serial, x, y }),
  getLivePreview: (serial) => ipcRenderer.invoke('device:getLivePreview', serial)
});
