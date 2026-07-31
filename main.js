const { app, BrowserWindow, ipcMain, shell, clipboard, nativeImage } = require('electron');
const path = require('path');
const adbManager = require('./lib/adb-manager');
const scrcpyManager = require('./lib/scrcpy-manager');

const fs = require('fs');

let mainWindow;
let devicePollingInterval;

// Intercept console.log and console.error
const originalLog = console.log;
const originalError = console.error;

function sendLogToWindow(type, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    mainWindow.webContents.send('system:log', { type, message: msg, timestamp: new Date().toISOString() });
  }
}

console.log = (...args) => {
  originalLog.apply(console, args);
  sendLogToWindow('info', ...args);
};

console.error = (...args) => {
  originalError.apply(console, args);
  sendLogToWindow('error', ...args);
};

const configFile = path.join(__dirname, '.window-state.json');

function loadWindowState() {
  try {
    if (fs.existsSync(configFile)) {
      const data = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (data && typeof data.width === 'number') return data;
    }
  } catch (e) {
    console.error('Error loading window state:', e);
  }
  return { width: 1240, height: 820 };
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const isMaximized = mainWindow.isMaximized();
    const isMinimized = mainWindow.isMinimized();
    if (isMinimized) return;

    let bounds;
    if (isMaximized && typeof mainWindow.getNormalBounds === 'function') {
      bounds = mainWindow.getNormalBounds();
    } else {
      bounds = mainWindow.getBounds();
    }

    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized
    };
    fs.writeFileSync(configFile, JSON.stringify(state, null, 2));
    console.log('Saved window state:', state);
  } catch (e) {
    console.error('Error saving window state:', e);
  }
}

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0e1a',
    title: 'Dex Device Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('close', saveWindowState);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let isPolling = false;
function startPolling() {
  const poll = async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const devices = await adbManager.getDevices();
        const statuses = scrcpyManager.getAllStatuses();
        mainWindow.webContents.send('devices:updated', { devices, statuses });
      }
    } catch(e) {
      console.error('Error during device polling:', e);
    } finally {
      isPolling = false;
    }
  };

  poll(); // fetch immediately
  devicePollingInterval = setInterval(poll, 3000);
}

app.whenReady().then(() => {
  createWindow();
  startPolling();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (devicePollingInterval) clearInterval(devicePollingInterval);
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('devices:get', async () => {
  const devices = await adbManager.getDevices();
  const statuses = scrcpyManager.getAllStatuses();
  return { devices, statuses };
});

ipcMain.handle('mirror:start', async (event, { serial, options }) => {
  return scrcpyManager.startMirror(serial, options);
});

ipcMain.handle('mirror:stop', async (event, serial) => {
  return scrcpyManager.stopMirror(serial);
});

ipcMain.handle('record:start', async (event, { serial, options }) => {
  const picturesDir = app.getPath('videos') || app.getPath('userData');
  const recordDir = path.join(picturesDir, 'DexRecordings');
  return scrcpyManager.startRecording(serial, recordDir, options);
});

ipcMain.handle('record:stop', async (event, serial) => {
  return scrcpyManager.stopRecording(serial);
});

ipcMain.handle('device:screenshot', async (event, serial) => {
  const picturesDir = app.getPath('pictures') || app.getPath('userData');
  const screenshotDir = path.join(picturesDir, 'DexScreenshots');
  const filePath = await adbManager.takeScreenshot(serial, screenshotDir);
  
  if (filePath) {
    const image = nativeImage.createFromPath(filePath);
    clipboard.writeImage(image);
  }

  return { success: true, filePath };
});

ipcMain.handle('media:getList', async () => {
  const picturesDir = app.getPath('pictures') || app.getPath('userData');
  const videosDir = app.getPath('videos') || app.getPath('userData');
  const screenshotDir = path.join(picturesDir, 'DexScreenshots');
  const recordDir = path.join(videosDir, 'DexRecordings');
  
  const files = [];
  
  const readDir = (dir, type) => {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item.startsWith('.')) continue; // skip hidden
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        // Extract serial from filename assuming format: type_serial_timestamp.ext
        const parts = item.split('_');
        const serial = parts.length >= 2 ? parts[1] : 'unknown';
        files.push({
          name: item,
          path: fullPath,
          url: `file://${fullPath}`,
          type,
          serial,
          mtime: stat.mtimeMs
        });
      }
    }
  };
  
  readDir(screenshotDir, 'image');
  readDir(recordDir, 'video');
  
  // Sort by newest first
  files.sort((a, b) => b.mtime - a.mtime);
  return files;
});

ipcMain.handle('media:openFile', async (event, filePath) => {
  return shell.openPath(filePath);
});

ipcMain.handle('media:openFolder', async () => {
  const picturesDir = app.getPath('pictures') || app.getPath('userData');
  const screenshotDir = path.join(picturesDir, 'DexScreenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  return shell.openPath(screenshotDir);
});

ipcMain.handle('media:deleteFile', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' };
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('media:renameFile', async (event, { oldPath, newName }) => {
  try {
    const dir = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    const safeName = newName.replace(/[<>:"/\\|?*]/g, '_');
    const newPath = path.join(dir, safeName + ext);
    if (fs.existsSync(newPath)) return { success: false, error: 'File with this name already exists' };
    fs.renameSync(oldPath, newPath);
    return { success: true, newPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('device:reboot', async (event, serial) => {
  return adbManager.reboot(serial);
});

ipcMain.handle('device:tcpip', async (event, { serial, port }) => {
  return adbManager.enableTcpIp(serial, port);
});

ipcMain.handle('wifi:connect', async (event, { ip, port }) => {
  return adbManager.connectWifi(ip, port);
});

ipcMain.handle('device:setProxy', async (event, { serial, proxyStr }) => {
  return adbManager.setProxy(serial, proxyStr);
});

ipcMain.handle('device:clearProxy', async (event, serial) => {
  return adbManager.clearProxy(serial);
});

ipcMain.handle('device:turnScreenOff', async (event, serial) => {
  return adbManager.turnScreenOff(serial);
});

ipcMain.handle('device:toggleScreenPower', async (event, { serial, turnOff }) => {
  return scrcpyManager.toggleScreenPower(serial, turnOff);
});

ipcMain.handle('device:shell', async (event, { serial, command }) => {
  return adbManager.runShell(serial, command);
});

ipcMain.handle('system:localTerminal', async (event, command) => {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(command, (error, stdout, stderr) => {
      resolve({
        success: !error,
        output: stdout || stderr || (error ? error.message : '')
      });
    });
  });
});

ipcMain.handle('device:sendKeyEvent', async (event, { serial, keycode }) => {
  return adbManager.sendKeyEvent(serial, keycode);
});

ipcMain.handle('device:getLivePreview', async (event, serial) => {
  return adbManager.getLivePreview(serial);
});

ipcMain.handle('device:sendTap', async (event, { serial, x, y }) => {
  return adbManager.runShell(serial, `input tap ${Math.round(x)} ${Math.round(y)}`);
});
