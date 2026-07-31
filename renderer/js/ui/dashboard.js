import { state, getDeviceStatus } from '../store.js';

const dashEls = {
  grid: document.getElementById('dashboard-grid'),
  gridControls: document.getElementById('dash-grid-controls')
};

let gridRows = 0;
let dashboardInterval = null;

function applyGridLayout() {
  if (gridRows > 0 && dashEls.grid) {
    const totalHeight = dashEls.grid.clientHeight;
    const gap = 16;
    const padding = 20;
    const cardHeight = (totalHeight - (gridRows - 1) * gap - padding * 2) / gridRows;
    const cards = dashEls.grid.querySelectorAll('.dash-card');
    cards.forEach(c => {
      c.style.height = `${cardHeight}px`;
    });
  }
}

export function renderDashboard() {
  const activeDevices = state.devices.filter(d => d.status === 'device' && (getDeviceStatus(d.serial).isMirroring || getDeviceStatus(d.serial).isRecording));
  
  if (activeDevices.length === 0) {
    if (dashEls.grid) dashEls.grid.innerHTML = '<div class="empty-state">Không có thiết bị nào đang kết nối.</div>';
    return;
  }

  if (dashEls.grid) {
    dashEls.grid.innerHTML = activeDevices.map(d => `
      <div class="dash-card" data-serial="${d.serial}">
        <div class="dash-card-header">
          <span>${[d.manufacturer, d.model].filter(Boolean).join(' ') || d.serial}</span>
          <small style="color:var(--text-dim);font-weight:normal;">${d.serial}</small>
        </div>
        <div class="dash-card-preview" id="dash-preview-${d.serial}">
          <div class="dash-preview-overlay">Đang tải...</div>
          <img src="" id="dash-img-${d.serial}" style="display:none;" />
        </div>
        <div class="dash-card-controls">
          <button class="dash-btn btn-send-key" data-key="4" title="Trở lại (Back)">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button class="dash-btn btn-send-key" data-key="3" title="Màn hình chính (Home)">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="5"></circle></svg>
          </button>
          <button class="dash-btn btn-send-key" data-key="187" title="Đa nhiệm (Recents)">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect></svg>
          </button>
          <button class="dash-btn btn-send-key" data-key="24" title="Tăng âm lượng">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
          </button>
          <button class="dash-btn btn-send-key" data-key="25" title="Giảm âm lượng">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="15.54" y1="12" x2="21" y2="12"></line></svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  applyGridLayout();

  if (dashEls.grid) {
    const keys = dashEls.grid.querySelectorAll('.btn-send-key');
    keys.forEach(btn => {
      btn.addEventListener('click', () => {
        const serial = btn.closest('.dash-card').dataset.serial;
        const key = btn.dataset.key;
        if (window.dex) window.dex.sendKeyEvent(serial, key);
      });
    });
  }
}

export function initDashboard() {
  if (dashEls.gridControls) {
    dashEls.gridControls.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        Array.from(dashEls.gridControls.children).forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        const layout = e.target.dataset.layout;
        
        if (layout === 'auto') {
          dashEls.grid.className = 'dashboard-grid';
          gridRows = 0;
          dashEls.grid.querySelectorAll('.dash-card').forEach(c => c.style.height = 'auto');
        } else {
          const rows = parseInt(layout.split('x')[0]);
          const cols = parseInt(layout.split('x')[1]);
          dashEls.grid.className = 'dashboard-grid';
          dashEls.grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
          gridRows = rows;
          applyGridLayout();
        }
      }
    });
  }

  window.addEventListener('resize', () => {
    if (gridRows > 0) applyGridLayout();
  });

  // Setup dashboard preview stream
  if (dashboardInterval) clearInterval(dashboardInterval);
  dashboardInterval = setInterval(async () => {
    if (document.getElementById('view-dashboard') && !document.getElementById('view-dashboard').classList.contains('active')) {
      return;
    }
    const cards = document.querySelectorAll('.dash-card');
    for (const card of cards) {
      const serial = card.dataset.serial;
      try {
        const frameData = await window.dex.getPreviewFrame(serial);
        const img = document.getElementById(`dash-img-${serial}`);
        const overlay = card.querySelector('.dash-preview-overlay');
        if (frameData && img) {
          img.src = `data:image/jpeg;base64,${frameData}`;
          img.style.display = 'block';
          if (overlay) overlay.style.display = 'none';
        }
      } catch (e) {
        // ignore preview errors
      }
    }
  }, 1000);
}
