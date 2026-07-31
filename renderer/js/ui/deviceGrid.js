import { state, getDeviceStatus } from '../store.js';
import { els } from '../elements.js';
import { startMirror, stopMirror, takeScreenshot, turnScreenOff, startRecording, stopRecording, enableTcpIp, rebootDevice } from '../actions/deviceActions.js';

export function getFilteredDevices() {
  return state.devices.filter(d => {
    // Text search
    const query = state.searchQuery.toLowerCase();
    const matchesSearch = !query || 
      ((d.manufacturer + ' ' + d.model).toLowerCase().includes(query)) ||
      (d.manufacturer && d.manufacturer.toLowerCase().includes(query)) ||
      (d.serial && d.serial.toLowerCase().includes(query));
    
    // Connection filter
    const matchesConnection = state.filterConnection === 'all' || 
      (d.connectionType && d.connectionType.toLowerCase() === state.filterConnection.toLowerCase());

    // Status filter
    const status = getDeviceStatus(d.serial);
    const matchesStatus = state.filterStatus === 'all' || status.state === state.filterStatus;

    return matchesSearch && matchesConnection && matchesStatus;
  });
}

function updateStats(filtered) {
  if (els.statTotal) els.statTotal.textContent = filtered.length;
  if (els.statMirroring) {
    const mirroring = filtered.filter(d => getDeviceStatus(d.serial).isMirroring).length;
    els.statMirroring.textContent = mirroring;
  }
}

export function updateSelectionUI() {
  const filtered = getFilteredDevices();
  if (els.selectAllCheckbox) {
    els.selectAllCheckbox.checked = filtered.length > 0 && state.selectedSerials.size === filtered.length;
  }
  
  const hasSelected = state.selectedSerials.size > 0;
  let hasRunningSelected = false;
  state.selectedSerials.forEach(serial => {
    if (getDeviceStatus(serial).isMirroring) {
      hasRunningSelected = true;
    }
  });

  // Sidebar buttons visually disabled logic
  if (els.btnMirrorAll) {
    els.btnMirrorAll.disabled = !hasSelected;
    els.btnMirrorAll.style.opacity = hasSelected ? '1' : '0.5';
    els.btnMirrorAll.style.cursor = hasSelected ? 'pointer' : 'not-allowed';
  }

  const runningRequiredBtns = [els.btnStopAll, els.btnScreenshotAll, els.btnRecordAll];
  runningRequiredBtns.forEach(btn => {
    if (btn) {
      btn.disabled = !(hasSelected && hasRunningSelected);
      btn.style.opacity = (hasSelected && hasRunningSelected) ? '1' : '0.5';
      btn.style.cursor = (hasSelected && hasRunningSelected) ? 'pointer' : 'not-allowed';
    }
  });

  if (els.bulkActions) {
    if (hasSelected) {
      els.bulkActions.style.display = 'flex';
      els.bulkActions.classList.add('show');
      if (els.bulkCount) els.bulkCount.textContent = `Đã chọn: ${state.selectedSerials.size}`;
    } else {
      els.bulkActions.style.display = 'none';
      els.bulkActions.classList.remove('show');
    }
  }
}

export function renderDevices() {
  if (!els.deviceGrid) return;
  
  const filtered = getFilteredDevices();
  updateStats(filtered);

  if (filtered.length === 0) {
    els.deviceGrid.innerHTML = `
      <div class="empty-state" style="text-align:center; padding: 40px; grid-column: 1 / -1; color: #888;">
        Không tìm thấy thiết bị nào phù hợp.
      </div>`;
    updateSelectionUI();
    return;
  }

  els.deviceGrid.innerHTML = filtered.map(d => {
    const status = getDeviceStatus(d.serial);
    const isSelected = state.selectedSerials.has(d.serial);
    const isMirroring = status.isMirroring;
    const isRecording = status.isRecording;
    
    let statusText = 'Sẵn sàng';
    let statusClass = 'idle';
    if (isMirroring) { statusText = 'Mirroring'; statusClass = 'mirror'; }
    if (isRecording) {
      const min = Math.floor(status.duration / 60).toString().padStart(2, '0');
      const sec = (status.duration % 60).toString().padStart(2, '0');
      statusText = `Recording ${min}:${sec}`;
      statusClass = 'recording';
    }

    return `
      <div class="device-card ${isMirroring ? 'mirroring' : ''} ${isSelected ? 'selected' : ''}" data-serial="${d.serial}">
        ${state.loadingSerials.has(d.serial) ? '<div class="card-loading-overlay"><span class="loader"></span></div>' : ''}
        
        <div class="card-header">
          <div class="device-info">
            <span class="device-icon">📱</span>
            <div>
              <h3 class="device-name">${d.manufacturer || 'Unknown'} ${d.model || ''}</h3>
              <span class="device-serial">${d.serial}</span>
            </div>
          </div>
          <label class="custom-checkbox-container" title="Chọn thiết bị">
            <input type="checkbox" class="device-select" value="${d.serial}" ${isSelected ? 'checked' : ''}>
            <span class="custom-checkmark"></span>
          </label>
        </div>
        
        <div class="card-badges">
          <span class="badge conn-${(d.connectionType || 'usb').toLowerCase()}">${d.connectionType || 'USB'}</span>
          ${d.battery ? `<span class="badge ${d.battery < 20 ? 'tag-danger' : 'tag-success'}">BAT: ${d.battery}%</span>` : ''}
          ${d.androidVersion ? `<span class="badge">Android ${d.androidVersion}</span>` : ''}
        </div>

        <div class="card-metrics">
          <div class="metric">
            <div class="metric-label">BATTERY</div>
            <div class="metric-value">${d.battery ? d.battery + '%' : '--'}</div>
          </div>
          <div class="metric">
            <div class="metric-label">RESOLUTION</div>
            <div class="metric-value">${d.resolution || '--'}</div>
          </div>
          <div class="metric">
            <div class="metric-label">STATUS</div>
            <div class="metric-value status-text ${statusClass}">${statusText}</div>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn btn-sm ${isMirroring ? 'btn-danger action-stop-mirror active' : 'btn-primary action-mirror'}" data-serial="${d.serial}" title="${isMirroring ? 'Dừng chiếu' : 'Chiếu màn hình'}">
            ${isMirroring
              ? '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>'
              : '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
            }
          </button>
          <button class="btn btn-sm action-screen-off ${status.screenOff ? 'btn-primary active' : 'btn-outline'}" data-serial="${d.serial}" title="Tắt màn hình thiết bị" ${!isMirroring ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          </button>
          <button class="btn btn-sm btn-outline action-screenshot" data-serial="${d.serial}" title="Chụp ảnh màn hình" ${!isMirroring ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </button>
          ${isRecording ? 
            `<button class="btn btn-sm btn-danger action-stop-record active" data-serial="${d.serial}" title="Dừng quay video">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>
             </button>`
            :
            `<button class="btn btn-sm btn-outline action-record" data-serial="${d.serial}" title="Quay màn hình ngầm" ${!isMirroring ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg>
            </button>`
          }
          <button class="btn btn-sm btn-outline action-proxy" data-serial="${d.serial}" title="Cấu hình Proxy" ${!isMirroring ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
          </button>
          <div class="dropdown">
            <button class="btn btn-sm btn-ghost action-more" data-serial="${d.serial}" title="Thao tác khác">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
            </button>
            <div class="dropdown-menu" id="dropdown-menu-${d.serial}">
              ${d.connectionType === 'USB' ? `<button class="dropdown-item action-tcpip" data-serial="${d.serial}">📶 Bật kết nối ADB WiFi</button>` : ''}
              <button class="dropdown-item action-reboot" data-serial="${d.serial}">🔄 Khởi động lại máy</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  updateSelectionUI();
  attachCardEvents();
}

function attachCardEvents() {
  const checkboxes = els.deviceGrid.querySelectorAll('.device-select');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const serial = e.target.value;
      if (e.target.checked) state.selectedSerials.add(serial);
      else state.selectedSerials.delete(serial);
      updateSelectionUI();
      // Update card visual
      const card = e.target.closest('.device-card');
      if (card) {
        if (e.target.checked) card.classList.add('selected');
        else card.classList.remove('selected');
      }
    });
  });

  const btnMirrors = els.deviceGrid.querySelectorAll('.action-mirror');
  btnMirrors.forEach(btn => btn.addEventListener('click', () => startMirror(btn.dataset.serial, false)));

  const btnStopMirrors = els.deviceGrid.querySelectorAll('.action-stop-mirror');
  btnStopMirrors.forEach(btn => btn.addEventListener('click', () => stopMirror(btn.dataset.serial)));

  const btnScreenOffs = els.deviceGrid.querySelectorAll('.action-screen-off');
  btnScreenOffs.forEach(btn => btn.addEventListener('click', () => {
    if (!btn.disabled) turnScreenOff(btn.dataset.serial);
  }));

  const btnScreenshots = els.deviceGrid.querySelectorAll('.action-screenshot');
  btnScreenshots.forEach(btn => btn.addEventListener('click', () => {
    if (!btn.disabled) takeScreenshot(btn.dataset.serial);
  }));

  const btnRecords = els.deviceGrid.querySelectorAll('.action-record');
  btnRecords.forEach(btn => btn.addEventListener('click', () => {
    if (!btn.disabled) startRecording(btn.dataset.serial);
  }));

  const btnStopRecords = els.deviceGrid.querySelectorAll('.action-stop-record');
  btnStopRecords.forEach(btn => btn.addEventListener('click', () => stopRecording(btn.dataset.serial)));

  const btnMores = els.deviceGrid.querySelectorAll('.action-more');
  btnMores.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const serial = btn.dataset.serial;
      const menu = document.getElementById(`dropdown-menu-${serial}`);
      document.querySelectorAll('.dropdown-menu').forEach(m => { if(m !== menu) m.classList.remove('show'); });
      if (menu) menu.classList.toggle('show');
    });
  });

  // More menu items
  els.deviceGrid.querySelectorAll('.action-tcpip').forEach(item => {
    item.addEventListener('click', () => enableTcpIp(item.dataset.serial));
  });
  els.deviceGrid.querySelectorAll('.action-reboot').forEach(item => {
    item.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn khởi động lại thiết bị này?')) {
        rebootDevice(item.dataset.serial);
      }
    });
  });
  els.deviceGrid.querySelectorAll('.action-proxy').forEach(item => {
    item.addEventListener('click', () => {
      if (!item.disabled) {
        import('../ui/proxyModal.js').then(m => m.openProxyModal(item.dataset.serial));
      }
    });
  });
}

