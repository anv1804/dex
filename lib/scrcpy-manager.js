const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ScrcpyManager {
  constructor() {
    this.processes = new Map(); // serial -> { mirrorProc, recordProc, screenOff, mirrorStartTime, recordStartTime, recordPath }
  }

  _getState(serial) {
    if (!this.processes.has(serial)) {
      this.processes.set(serial, {
        mirrorProc: null,
        recordProc: null,
        screenOff: false,
        mirrorStartTime: 0,
        recordStartTime: 0,
        recordPath: null
      });
    }
    return this.processes.get(serial);
  }

  _cleanupState(serial) {
    const s = this.processes.get(serial);
    if (s && !s.mirrorProc && !s.recordProc) {
      this.processes.delete(serial);
    }
  }

  startMirror(serial, options = {}) {
    const state = this._getState(serial);
    if (state.mirrorProc) return { success: true, message: 'Already mirroring' };

    const args = ['-s', serial];
    if (options.title) {
      args.push('--window-title', options.title);
    } else {
      args.push('--window-title', `Dex Mirror: ${serial}`);
    }

    if (options.stayAwake) args.push('--stay-awake');
    if (options.turnScreenOff) args.push('--turn-screen-off');
    if (options.alwaysOnTop) args.push('--always-on-top');
    if (options.maxFps) args.push('--max-fps', String(options.maxFps));
    if (options.maxSize) args.push('-m', String(options.maxSize));

    const scrcpyBin = '/home/anv/Downloads/scrcpy-linux-x86_64-v3.3.4/scrcpy';
    const scrcpyServer = '/home/anv/Downloads/scrcpy-linux-x86_64-v3.3.4/scrcpy-server';
    const env = { 
      ...process.env, 
      ADB: '/usr/bin/adb',
      SCRCPY_SERVER_PATH: scrcpyServer
    };
    
    const proc = spawn(scrcpyBin, args, { env });

    state.mirrorProc = proc;
    state.screenOff = !!options.turnScreenOff;
    state.mirrorStartTime = Date.now();

    proc.stdout?.on('data', (data) => console.log(`[scrcpy stdout ${serial}]: ${data}`));
    proc.stderr?.on('data', (data) => console.error(`[scrcpy stderr ${serial}]: ${data}`));

    proc.on('close', (code) => {
      console.log(`scrcpy mirror for ${serial} exited with code ${code}`);
      const s = this.processes.get(serial);
      if (s && s.mirrorProc === proc) {
        s.mirrorProc = null;
        this._cleanupState(serial);
      }
    });

    proc.on('error', (err) => {
      console.error(`scrcpy mirror error for ${serial}:`, err);
      const s = this.processes.get(serial);
      if (s && s.mirrorProc === proc) {
        s.mirrorProc = null;
        this._cleanupState(serial);
      }
    });

    return { success: true, pid: proc.pid };
  }

  async toggleScreenPower(serial, turnOff) {
    const state = this.processes.get(serial);
    if (!state || !state.mirrorProc) return { success: false, message: 'Not mirroring' };

    try {
      const { exec } = require('child_process');
      const key = turnOff ? 'alt+o' : 'shift+alt+o';
      const cmd = `xdotool search --name "Dex Mirror: ${serial}" | head -n 1 | xargs -I {} xdotool key --window {} ${key}`;
      
      await new Promise((resolve, reject) => {
        exec(cmd, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      state.screenOff = turnOff;
      return { success: true };
    } catch (e) {
      console.error(`Error toggling screen power for ${serial}:`, e);
      return { success: false, message: e.message };
    }
  }

  startRecording(serial, outputDir, options = {}) {
    const state = this._getState(serial);
    if (state.recordProc) return { success: true, message: 'Already recording' };

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const filename = `recording_${serial.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp4`;
    const recordPath = path.join(outputDir, filename);

    // ALWAYS use --no-playback for recording so it doesn't spawn a window and interrupt the mirror
    const args = ['-s', serial, '--no-playback', '--record', recordPath];

    const scrcpyBin = '/home/anv/Downloads/scrcpy-linux-x86_64-v3.3.4/scrcpy';
    const scrcpyServer = '/home/anv/Downloads/scrcpy-linux-x86_64-v3.3.4/scrcpy-server';
    const env = { 
      ...process.env, 
      ADB: '/usr/bin/adb',
      SCRCPY_SERVER_PATH: scrcpyServer
    };
    
    const proc = spawn(scrcpyBin, args, { env });

    state.recordProc = proc;
    state.recordPath = recordPath;
    state.recordStartTime = Date.now();

    proc.on('close', (code) => {
      console.log(`scrcpy recording for ${serial} exited with code ${code}`);
      const s = this.processes.get(serial);
      if (s && s.recordProc === proc) {
        s.recordProc = null;
        s.recordPath = null;
        this._cleanupState(serial);
      }
    });

    proc.on('error', (err) => {
      console.error(`scrcpy record error for ${serial}:`, err);
      const s = this.processes.get(serial);
      if (s && s.recordProc === proc) {
        s.recordProc = null;
        s.recordPath = null;
        this._cleanupState(serial);
      }
    });

    return { success: true, recordPath, pid: proc.pid };
  }

  stopMirror(serial) {
    const state = this.processes.get(serial);
    if (state && state.mirrorProc) {
      try {
        state.mirrorProc.kill('SIGINT');
      } catch (e) {
        state.mirrorProc.kill();
      }
      state.mirrorProc = null;
      this._cleanupState(serial);
      return { success: true };
    }
    return { success: false, message: 'No active mirror session found' };
  }

  stopRecording(serial) {
    const state = this.processes.get(serial);
    if (state && state.recordProc) {
      try {
        state.recordProc.kill('SIGINT');
      } catch (e) {
        state.recordProc.kill();
      }
      state.recordProc = null;
      state.recordPath = null;
      this._cleanupState(serial);
      return { success: true };
    }
    return { success: false, message: 'No active recording session found' };
  }

  getStatus(serial) {
    if (!this.processes.has(serial)) {
      return { active: false, state: 'idle', isMirroring: false, isRecording: false };
    }
    const item = this.processes.get(serial);
    let stateStr = 'idle';
    if (item.mirrorProc) stateStr = 'mirror';
    else if (item.recordProc) stateStr = 'record';

    return {
      active: true,
      state: stateStr,
      isMirroring: !!item.mirrorProc,
      isRecording: !!item.recordProc,
      screenOff: item.screenOff,
      recordPath: item.recordPath || null,
      duration: item.recordProc ? Math.floor((Date.now() - item.recordStartTime) / 1000) : 0
    };
  }

  getAllStatuses() {
    const statuses = {};
    for (const [serial, item] of this.processes.entries()) {
      let stateStr = 'idle';
      if (item.mirrorProc) stateStr = 'mirror';
      else if (item.recordProc) stateStr = 'record';

      statuses[serial] = {
        active: true,
        state: stateStr,
        isMirroring: !!item.mirrorProc,
        isRecording: !!item.recordProc,
        screenOff: item.screenOff,
        recordPath: item.recordPath || null,
        duration: item.recordProc ? Math.floor((Date.now() - item.recordStartTime) / 1000) : 0
      };
    }
    return statuses;
  }
}

module.exports = new ScrcpyManager();

