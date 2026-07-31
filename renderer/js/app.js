import { state, getDeviceStatus } from './store.js';
import { els } from './elements.js';
import { fetchDevices } from './actions/deviceActions.js';
import { renderDevices } from './ui/deviceGrid.js';
import { initSidebar } from './ui/sidebar.js';
import { initTerminal } from './ui/terminal.js';
import { initLogger } from './ui/logger.js';
import { initDashboard } from './ui/dashboard.js';
import { fetchMedia, initMedia } from './ui/media.js';
import { initProxyModal } from './ui/proxyModal.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI modules
  initSidebar();
  initTerminal();
  initLogger();
  initDashboard();
  initMedia();
  initProxyModal();

  // Search and Filter Listeners
  if (els.searchInput) {
    els.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderDevices();
    });
  }

  if (els.filterStatus) {
    els.filterStatus.addEventListener('change', (e) => {
      state.filterStatus = e.target.value;
      renderDevices();
    });
  }

  if (els.filterConnection) {
    els.filterConnection.addEventListener('change', (e) => {
      state.filterConnection = e.target.value;
      renderDevices();
    });
  }

  // Initial Fetch
  fetchDevices();
  fetchMedia(); // also fetch media on load

  // Setup Real-time updates from Backend (IPC)
  if (window.dex && window.dex.onDevicesUpdated) {
    window.dex.onDevicesUpdated((data) => {
      console.log('onDevicesUpdated received:', data);
      state.devices = data.devices || state.devices;
      state.statuses = data.statuses || state.statuses;
      
      // Filter out selected serials that are no longer in devices
      const activeSerials = new Set(state.devices.map(d => d.serial));
      for (const s of state.selectedSerials) {
        if (!activeSerials.has(s)) {
          state.selectedSerials.delete(s);
        }
      }
      renderDevices();
    });
  }

  // Local UI timer for recording durations to prevent 3s jumping and avoid heavy re-rendering
  setInterval(() => {
    let needsUpdate = false;
    for (const serial in state.statuses) {
      if (state.statuses[serial].isRecording) {
        state.statuses[serial].duration++;
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      const cards = document.querySelectorAll('.device-card');
      cards.forEach(card => {
        const serial = card.getAttribute('data-serial');
        if (state.statuses[serial] && state.statuses[serial].isRecording) {
          const min = Math.floor(state.statuses[serial].duration / 60).toString().padStart(2, '0');
          const sec = (state.statuses[serial].duration % 60).toString().padStart(2, '0');
          const statusText = card.querySelector('.status-text');
          if (statusText) statusText.textContent = `Recording ${min}:${sec}`;
        }
      });
    }
  }, 1000);

  // Expose to window for debugging if needed
  window.appState = state;
});
