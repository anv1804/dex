import { els } from '../elements.js';
import { state } from '../store.js';
import { startMirror, stopMirror, takeScreenshot, startRecording, fetchDevices } from '../actions/deviceActions.js';
import { getFilteredDevices, renderDevices } from './deviceGrid.js';
import { showToast } from './toast.js';

export function initSidebar() {
  // Navigation
  els.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      els.navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      els.viewContainers.forEach(v => v.classList.remove('active'));
      const targetId = btn.getAttribute('data-target');
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.add('active');
    });
  });

  // Select All
  if (els.selectAllCheckbox) {
    els.selectAllCheckbox.addEventListener('change', (e) => {
      const filtered = getFilteredDevices();
      if (e.target.checked) {
        filtered.forEach(d => state.selectedSerials.add(d.serial));
      } else {
        state.selectedSerials.clear();
      }
      renderDevices();
    });
  }

  // Bulk Actions
  if (els.btnBulkMirror) els.btnBulkMirror.addEventListener('click', () => {
    state.selectedSerials.forEach(serial => startMirror(serial));
  });
  if (els.btnBulkStop) els.btnBulkStop.addEventListener('click', () => {
    state.selectedSerials.forEach(serial => stopMirror(serial));
  });
  if (els.btnBulkScreenshot) els.btnBulkScreenshot.addEventListener('click', () => {
    state.selectedSerials.forEach(serial => takeScreenshot(serial));
  });

  // View Toggle
  if (els.viewGridBtn) {
    els.viewGridBtn.addEventListener('click', () => {
      els.deviceGrid.classList.remove('list-view');
      els.viewGridBtn.classList.add('active');
      if(els.viewListBtn) els.viewListBtn.classList.remove('active');
    });
  }
  if (els.viewListBtn) {
    els.viewListBtn.addEventListener('click', () => {
      els.deviceGrid.classList.add('list-view');
      els.viewListBtn.classList.add('active');
      if(els.viewGridBtn) els.viewGridBtn.classList.remove('active');
    });
  }

  // Sidebar Actions
  const getSelectedSerials = () => Array.from(state.selectedSerials);

  const checkSelected = () => {
    if (state.selectedSerials.size === 0) {
      showToast('Vui lòng chọn ít nhất một thiết bị', 'warning');
      return false;
    }
    return true;
  };

  if (els.btnMirrorAll) els.btnMirrorAll.addEventListener('click', () => {
    if (!checkSelected()) return;
    getSelectedSerials().forEach(serial => startMirror(serial, false));
  });

  if (els.btnStopAll) els.btnStopAll.addEventListener('click', () => {
    if (!checkSelected()) return;
    getSelectedSerials().forEach(serial => {
      const { isMirroring } = getDeviceStatus(serial);
      if (isMirroring) stopMirror(serial);
    });
  });

  if (els.btnScreenshotAll) els.btnScreenshotAll.addEventListener('click', () => {
    if (!checkSelected()) return;
    getSelectedSerials().forEach(serial => {
      const { isMirroring } = getDeviceStatus(serial);
      if (isMirroring) takeScreenshot(serial);
    });
  });

  if (els.btnRecordAll) els.btnRecordAll.addEventListener('click', () => {
    if (!checkSelected()) return;
    getSelectedSerials().forEach(serial => {
      const { isMirroring } = getDeviceStatus(serial);
      if (isMirroring) startRecording(serial);
    });
  });

  if (els.btnRefresh) els.btnRefresh.addEventListener('click', fetchDevices);

  // WiFi Connect
  if (els.btnWifiConnect && els.wifiIpInput) {
    els.btnWifiConnect.addEventListener('click', async () => {
      const ip = els.wifiIpInput.value.trim();
      if (!ip) {
        showToast('Enter a valid IP', 'danger');
        return;
      }
      try {
        await window.dex.connectWifi(ip, 5555);
        showToast(`Connected to ${ip}`, 'success');
        els.wifiIpInput.value = '';
      } catch(e) {
        showToast('Failed to connect over WiFi', 'danger');
      }
    });
  }
}
