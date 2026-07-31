import { state, getDeviceStatus } from '../store.js';
import { els } from '../elements.js';
import { showToast } from '../ui/toast.js';
import { renderDevices } from '../ui/deviceGrid.js';

export async function fetchDevices() {
  try {
    if (window.dex && window.dex.getDevices) {
      const data = await window.dex.getDevices();
      if (Array.isArray(data)) {
        state.devices = data;
      } else {
        state.devices = data.devices || [];
        state.statuses = data.statuses || {};
      }
      renderDevices();
    }
  } catch (e) {
    console.error(e);
    showToast('Error loading devices', 'danger');
  }
}

export async function withLoading(serial, fn) {
  state.loadingSerials.add(serial);
  const card = els.deviceGrid.querySelector(`.device-card[data-serial="${serial}"]`);
  if (card && !card.querySelector('.card-loading-overlay')) {
    const overlay = document.createElement('div');
    overlay.className = 'card-loading-overlay';
    overlay.innerHTML = '<span class="loader"></span>';
    card.appendChild(overlay);
  }
  
  try {
    await Promise.all([
      fn(),
      new Promise(r => setTimeout(r, 1200)) // Force minimum 1200ms loader visibility for better UX
    ]);
  } finally {
    state.loadingSerials.delete(serial);
    const activeCard = els.deviceGrid.querySelector(`.device-card[data-serial="${serial}"]`);
    if (activeCard) {
      const overlay = activeCard.querySelector('.card-loading-overlay');
      if (overlay) overlay.remove();
    }
  }
}

export async function startMirror(serial, turnScreenOff = false) {
  await withLoading(serial, async () => {
    try {
      const status = getDeviceStatus(serial);
      if (status.isMirroring) {
        await window.dex.stopMirror(serial);
      }
      const res = await window.dex.startMirror(serial, { turnScreenOff });
      if (res && res.success) showToast(turnScreenOff ? `Đã tắt màn hình thật cho ${serial}` : `Đã bắt đầu chiếu ${serial}`, 'success');
      else showToast(`Không thể khởi chạy mirror cho ${serial}`, 'danger');
    } catch(e) {
      showToast('Lỗi khi chiếu màn hình', 'danger');
    }
  });
}

export async function stopMirror(serial) {
  await withLoading(serial, async () => {
    try {
      const res = await window.dex.stopMirror(serial);
      if (res && res.success) showToast(`Stopped mirror for ${serial}`, 'info');
      else showToast(`Failed to stop mirror for ${serial}`, 'danger');
    } catch(e) {
      showToast('Error stopping mirror', 'danger');
    }
  });
}

export async function turnScreenOff(serial) {
  await withLoading(serial, async () => {
    const status = getDeviceStatus(serial);
    if (status.isMirroring) {
      try {
        await window.dex.toggleScreenPower(serial, !status.screenOff);
        if (state.statuses[serial]) state.statuses[serial].screenOff = !status.screenOff;
        renderDevices();
      } catch(e) {
        showToast('Lỗi khi bật/tắt màn hình', 'danger');
      }
    } else {
      try {
        await window.dex.turnScreenOff(serial);
        showToast(`Đã tắt màn hình thiết bị ${serial}`, 'info');
      } catch(e) {
        showToast('Lỗi khi tắt màn hình điện thoại', 'danger');
      }
    }
  });
}

export async function takeScreenshot(serial) {
  await withLoading(serial, async () => {
    try {
      const res = await window.dex.takeScreenshot(serial);
      if (res && res.success) showToast(`Đã lưu ảnh và copy vào bộ nhớ tạm!`, 'success');
      else showToast(`Failed to screenshot ${serial}`, 'danger');
    } catch(e) {
      showToast('Error taking screenshot', 'danger');
    }
  });
}

export async function startRecording(serial) {
  await withLoading(serial, async () => {
    try {
      const res = await window.dex.startRecording(serial);
      if (res && res.success) showToast(`Started recording ${serial}`, 'success');
      else showToast(`Failed to record ${serial}`, 'danger');
    } catch(e) {
      showToast('Error starting recording', 'danger');
    }
  });
}

export async function stopRecording(serial) {
  await withLoading(serial, async () => {
    try {
      const res = await window.dex.stopRecording(serial);
      if (res && res.success) showToast(`Stopped recording ${serial}`, 'info');
      else showToast(`Failed to stop recording ${serial}`, 'danger');
    } catch(e) {
      showToast('Error stopping recording', 'danger');
    }
  });
}

export async function enableTcpIp(serial) {
  await withLoading(serial, async () => {
    try {
      showToast(`Đang bật TCP/IP trên ${serial}...`, 'info');
      const res = await window.dex.enableTcpIp(serial, 5555);
      if (res && res.ip) {
        showToast(`Đã lấy IP ${res.ip}. Đang kết nối không dây...`, 'info');
        await window.dex.connectWifi(res.ip, res.port || 5555);
        showToast(`Đã kết nối WiFi tới ${res.ip}:${res.port || 5555}. Bạn có thể rút dây USB!`, 'success');
        fetchDevices();
      } else {
        showToast('Không lấy được địa chỉ IP WiFi của điện thoại. Đảm bảo điện thoại cùng mạng WiFi.', 'danger');
      }
    } catch(e) {
      showToast('Lỗi TCP/IP', 'danger');
    }
  });
}

export async function rebootDevice(serial) {
  if (!confirm(`Bạn có chắc muốn khởi động lại ${serial}?`)) return;
  await withLoading(serial, async () => {
    try {
      await window.dex.rebootDevice(serial);
      showToast(`Đang khởi động lại ${serial}...`, 'success');
    } catch(e) {
      showToast('Lỗi reboot', 'danger');
    }
  });
}
