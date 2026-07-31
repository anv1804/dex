const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class AdbManager {
  constructor() {
    this.adbPath = 'adb';
  }

  execCmd(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      });
    });
  }

  async getDevices() {
    try {
      const output = await this.execCmd(`${this.adbPath} devices -l`);
      const lines = output.split('\n').slice(1);
      const devices = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        const serial = parts[0];
        const status = parts[1];

        if (status === 'device') {
          let model = 'Unknown Device';
          let product = '';
          for (const part of parts.slice(2)) {
            if (part.startsWith('model:')) model = part.replace('model:', '').replace(/_/g, ' ');
            if (part.startsWith('product:')) product = part.replace('product:', '');
          }
          devices.push({ serial, status, model, product });
        }
      }

      // Populate extra device details concurrently
      const detailedDevices = await Promise.all(
        devices.map(async (dev) => {
          const details = await this.getDeviceInfo(dev.serial);
          return { ...dev, ...details };
        })
      );

      return detailedDevices;
    } catch (e) {
      console.error('Error fetching devices:', e);
      return [];
    }
  }

  async getDeviceInfo(serial) {
    try {
      const getCmdWithTimeout = (cmd) => {
        return new Promise((resolve) => {
          exec(cmd, { timeout: 1500 }, (err, stdout) => {
            if (err || !stdout) resolve('');
            else resolve(stdout.trim());
          });
        });
      };

      const [manufacturer, androidVersion, sdk, batteryRaw, resolution] = await Promise.all([
        getCmdWithTimeout(`${this.adbPath} -s ${serial} shell getprop ro.product.manufacturer`),
        getCmdWithTimeout(`${this.adbPath} -s ${serial} shell getprop ro.build.version.release`),
        getCmdWithTimeout(`${this.adbPath} -s ${serial} shell getprop ro.build.version.sdk`),
        getCmdWithTimeout(`${this.adbPath} -s ${serial} shell dumpsys battery`),
        getCmdWithTimeout(`${this.adbPath} -s ${serial} shell wm size`)
      ]);

      let battery = 100;
      const levelMatch = batteryRaw.match(/level:\s*(\d+)/);
      if (levelMatch) battery = parseInt(levelMatch[1], 10);

      let res = '1080x1920';
      const resMatch = resolution.match(/Override size:\s*(\d+x\d+)/) || resolution.match(/Physical size:\s*(\d+x\d+)/);
      if (resMatch) res = resMatch[1];

      const isWifi = serial.includes(':');

      return {
        manufacturer,
        androidVersion,
        sdk,
        battery,
        resolution: res,
        connectionType: isWifi ? 'WiFi' : 'USB'
      };
    } catch (e) {
      return {
        manufacturer: 'Unknown',
        androidVersion: '?',
        sdk: '?',
        battery: 100,
        resolution: 'Unknown',
        connectionType: 'USB'
      };
    }
  }

  async takeScreenshot(serial, destDir) {
    try {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      const filename = `screenshot_${serial.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
      const filePath = path.join(destDir, filename);

      await this.execCmd(`${this.adbPath} -s ${serial} exec-out screencap -p > "${filePath}"`);
      return filePath;
    } catch (e) {
      throw new Error(`Failed to take screenshot: ${e.message}`);
    }
  }

  async reboot(serial) {
    return this.execCmd(`${this.adbPath} -s ${serial} reboot`);
  }

  async getIpAddress(serial) {
    try {
      // Method 1: ip route (most reliable on modern Android)
      const routeOut = await this.execCmd(`${this.adbPath} -s ${serial} shell ip route`).catch(() => '');
      const routeMatch = routeOut.match(/dev\s+wlan0\b.*?\bsrc\s+(\d+\.\d+\.\d+\.\d+)/) || routeOut.match(/src\s+(\d+\.\d+\.\d+\.\d+)/);
      if (routeMatch) return routeMatch[1];

      // Method 2: ip addr show wlan0
      const addrOut = await this.execCmd(`${this.adbPath} -s ${serial} shell ip addr show wlan0`).catch(() => '');
      const addrMatch = addrOut.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
      if (addrMatch) return addrMatch[1];

      // Method 3: ifconfig wlan0
      const ifOut = await this.execCmd(`${this.adbPath} -s ${serial} shell ifconfig wlan0`).catch(() => '');
      const ifMatch = ifOut.match(/inet\s+addr:(\d+\.\d+\.\d+\.\d+)/) || ifOut.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
      if (ifMatch) return ifMatch[1];

      return null;
    } catch (e) {
      return null;
    }
  }

  async enableTcpIp(serial, port = 5555) {
    await this.execCmd(`${this.adbPath} -s ${serial} tcpip ${port}`);
    await new Promise((r) => setTimeout(r, 1000));
    const ip = await this.getIpAddress(serial);
    return { ip, port };
  }

  async connectWifi(ip, port = 5555) {
    return this.execCmd(`${this.adbPath} connect ${ip}:${port}`);
  }

  async setProxy(serial, proxyStr) {
    // proxyStr format: "ip:port" or "ip:port:user:pass"
    if (!proxyStr || !proxyStr.trim()) {
      return this.clearProxy(serial);
    }

    const parts = proxyStr.trim().split(':');
    const host = parts[0];
    const port = parts[1] || '8080';
    const user = parts[2];
    const pass = parts[3];

    // Standard Android global HTTP proxy setting
    if (user && pass) {
      // With Auth
      await this.execCmd(`${this.adbPath} -s ${serial} shell settings put global http_proxy ${user}:${pass}@${host}:${port}`);
    } else {
      // Without Auth
      await this.execCmd(`${this.adbPath} -s ${serial} shell settings put global http_proxy ${host}:${port}`);
    }
    return { success: true, host, port, user };
  }

  async clearProxy(serial) {
    await this.execCmd(`${this.adbPath} -s ${serial} shell settings put global http_proxy :5555`);
    await this.execCmd(`${this.adbPath} -s ${serial} shell settings delete global http_proxy`);
    await this.execCmd(`${this.adbPath} -s ${serial} shell settings delete global global_http_proxy_host`);
    await this.execCmd(`${this.adbPath} -s ${serial} shell settings delete global global_http_proxy_port`);
    return { success: true };
  }

  async turnScreenOff(serial) {
    // If scrcpy is active, using keyevent 26 puts Android to lock screen which turns mirror black too.
    // We send keyevent 223 or keyevent 224 to control display state cleanly
    return this.execCmd(`${this.adbPath} -s ${serial} shell input keyevent 224`);
  }

  async runShell(serial, command) {
    return this.execCmd(`${this.adbPath} -s ${serial} shell "${command}"`);
  }

  async sendKeyEvent(serial, keycode) {
    return this.execCmd(`${this.adbPath} -s ${serial} shell input keyevent ${keycode}`);
  }

  getLivePreview(serial) {
    return new Promise((resolve, reject) => {
      // Capture screen as PNG and return as base64 string
      // Note: for older devices, we might need a lower res or jpg, but standard is -p (PNG)
      exec(`${this.adbPath} -s ${serial} exec-out screencap -p`, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
        if (err) return reject(err);
        resolve(`data:image/png;base64,${stdout.toString('base64')}`);
      });
    });
  }
}

module.exports = new AdbManager();
