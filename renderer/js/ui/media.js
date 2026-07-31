import { showToast } from './toast.js';

const mediaEls = {
  grid: document.getElementById('media-grid'),
  btnRefresh: document.getElementById('btn-refresh-media'),
  filterType: document.getElementById('media-type-filter'),
  filterDevice: document.getElementById('media-filter'),
  selectAll: document.getElementById('media-select-all'),
  bulkActions: document.getElementById('media-bulk-actions'),
  btnDeleteSelected: document.getElementById('btn-bulk-delete-media'),
  btnOpenFolder: document.getElementById('btn-open-media-folder'),
  emptyState: document.getElementById('media-empty-state'),
  selectedCount: document.getElementById('media-bulk-count')
};

let mediaList = [];
let selectedMedia = new Set();
let fileToDelete = null;
let fileToRename = null;

export async function fetchMedia() {
  if (!window.dex) return;
  try {
    const res = await window.dex.getMediaList();
    if (res && res.success) {
      mediaList = res.files;
      selectedMedia.clear();
      renderMedia();
    }
  } catch(e) {
    showToast('Lỗi khi tải danh sách Media', 'danger');
  }
}

function renderMedia() {
  if (!mediaEls.grid) return;
  
  let filtered = mediaList;
  if (mediaEls.filterType && mediaEls.filterType.value !== 'all') {
    filtered = filtered.filter(m => m.type === mediaEls.filterType.value);
  }
  if (mediaEls.filterDevice && mediaEls.filterDevice.value !== 'all') {
    filtered = filtered.filter(m => m.serial === mediaEls.filterDevice.value);
  }

  if (filtered.length === 0) {
    mediaEls.grid.innerHTML = '';
    if (mediaEls.emptyState) mediaEls.emptyState.style.display = 'flex';
  } else {
    if (mediaEls.emptyState) mediaEls.emptyState.style.display = 'none';
    mediaEls.grid.innerHTML = filtered.map(m => {
      const isSelected = selectedMedia.has(m.path);
      let thumbHtml = '';
      if (m.type === 'video') {
        thumbHtml = `
          <div class="media-thumb-placeholder">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>`;
      } else {
        thumbHtml = `<img src="file://${m.path}" class="media-thumb" loading="lazy">`;
      }

      return `
        <div class="media-item ${isSelected ? 'selected' : ''}" data-path="${m.path}">
          <label class="custom-checkbox-container media-checkbox" style="position: absolute; top: 8px; left: 8px; z-index: 10;">
            <input type="checkbox" class="media-select-cb" value="${m.path}" ${isSelected ? 'checked' : ''}>
            <span class="custom-checkmark"></span>
          </label>
          <div class="media-thumb-wrap">
            ${thumbHtml}
            <div class="media-overlay">
              <button class="media-action-btn action-open-media" data-path="${m.path}" title="Mở">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </button>
              <button class="media-action-btn action-rename-media" data-path="${m.path}" title="Đổi tên">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg>
              </button>
              <button class="media-action-btn danger action-delete-media" data-path="${m.path}" title="Xóa">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
            ${m.type === 'video' ? '<div class="media-type-badge">VIDEO</div>' : ''}
          </div>
          <div class="media-info">
            <div class="media-name" style="font-size: 13px; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${m.name}">${m.name}</div>
            <div class="media-meta" style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">
              <span>${m.sizeStr}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  updateMediaSelectionUI();
  attachMediaEvents();
}

function updateMediaSelectionUI() {
  let filtered = mediaList;
  if (mediaEls.filterType && mediaEls.filterType.value !== 'all') {
    filtered = filtered.filter(m => m.type === mediaEls.filterType.value);
  }
  if (mediaEls.filterDevice && mediaEls.filterDevice.value !== 'all') {
    filtered = filtered.filter(m => m.serial === mediaEls.filterDevice.value);
  }

  if (mediaEls.selectAll) {
    mediaEls.selectAll.checked = filtered.length > 0 && selectedMedia.size === filtered.length;
  }
  
  if (mediaEls.bulkActions) {
    if (selectedMedia.size > 0) {
      mediaEls.bulkActions.classList.add('show');
      if (mediaEls.selectedCount) mediaEls.selectedCount.textContent = `Đã chọn: ${selectedMedia.size}`;
    } else {
      mediaEls.bulkActions.classList.remove('show');
    }
  }
}

function attachMediaEvents() {
  const cbs = mediaEls.grid.querySelectorAll('.media-select-cb');
  cbs.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const p = e.target.value;
      if (e.target.checked) selectedMedia.add(p);
      else selectedMedia.delete(p);
      
      const card = e.target.closest('.media-item');
      if (e.target.checked) card.classList.add('selected');
      else card.classList.remove('selected');
      
      updateMediaSelectionUI();
    });
  });

  const cards = mediaEls.grid.querySelectorAll('.media-item');
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.media-checkbox') || e.target.closest('.media-action-btn')) return;
      const p = card.dataset.path;
      if (window.dex) window.dex.openMediaFile(p);
    });
  });

  const openBtns = mediaEls.grid.querySelectorAll('.action-open-media');
  openBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.path;
      if (window.dex) window.dex.openMediaFile(p);
    });
  });

  const renameBtns = mediaEls.grid.querySelectorAll('.action-rename-media');
  renameBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      fileToRename = btn.dataset.path;
      const parts = fileToRename.split(/[\/\\]/);
      const oldName = parts[parts.length - 1];
      const baseName = oldName.substring(0, oldName.lastIndexOf('.'));
      const ext = oldName.substring(oldName.lastIndexOf('.'));
      
      const modal = document.getElementById('rename-modal');
      const input = document.getElementById('input-rename-file');
      const hint = document.getElementById('rename-ext-hint');
      
      if (input) input.value = baseName;
      if (hint) hint.textContent = `Đuôi file: ${ext}`;
      if (modal) modal.style.display = 'flex';
    });
  });

  const deleteBtns = mediaEls.grid.querySelectorAll('.action-delete-media');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      fileToDelete = btn.dataset.path;
      const modal = document.getElementById('delete-modal');
      const nameEl = document.getElementById('delete-file-name');
      if (nameEl) nameEl.textContent = fileToDelete;
      if (modal) modal.style.display = 'flex';
    });
  });
}

export function initMedia() {
  if (mediaEls.btnRefresh) {
    mediaEls.btnRefresh.addEventListener('click', fetchMedia);
  }
  if (mediaEls.btnOpenFolder) {
    mediaEls.btnOpenFolder.addEventListener('click', () => {
      if (window.dex) window.dex.openMediaFolder();
    });
  }
  if (mediaEls.filterType) {
    mediaEls.filterType.addEventListener('change', renderMedia);
  }
  if (mediaEls.filterDevice) {
    mediaEls.filterDevice.addEventListener('change', renderMedia);
  }
  
  // Populate device filter
  if (window.dex) {
    window.dex.getDevices().then(res => {
      if (res && res.devices && mediaEls.filterDevice) {
        mediaEls.filterDevice.innerHTML = '<option value="all">Tất cả thiết bị</option>';
        res.devices.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.serial;
          opt.textContent = `${d.model || 'Thiết bị'} (${d.serial})`;
          mediaEls.filterDevice.appendChild(opt);
        });
      }
    });
  }

  if (mediaEls.selectAll) {
    mediaEls.selectAll.addEventListener('change', (e) => {
      let filtered = mediaList;
      if (mediaEls.filterType && mediaEls.filterType.value !== 'all') {
        filtered = filtered.filter(m => m.type === mediaEls.filterType.value);
      }
      if (mediaEls.filterDevice && mediaEls.filterDevice.value !== 'all') {
        filtered = filtered.filter(m => m.serial === mediaEls.filterDevice.value);
      }
      
      if (e.target.checked) {
        filtered.forEach(m => selectedMedia.add(m.path));
      } else {
        selectedMedia.clear();
      }
      renderMedia();
    });
  }

  if (mediaEls.btnDeleteSelected) {
    mediaEls.btnDeleteSelected.addEventListener('click', async () => {
      if (selectedMedia.size === 0) return;
      if (confirm(`Bạn có chắc muốn xóa ${selectedMedia.size} file đã chọn?`)) {
        for (const p of selectedMedia) {
          await window.dex.deleteMediaFile(p);
        }
        showToast(`Đã xóa ${selectedMedia.size} file`, 'success');
        fetchMedia();
      }
    });
  }

  const modal = document.getElementById('delete-modal');
  const btnCancel = document.getElementById('btn-cancel-delete');
  const btnConfirm = document.getElementById('btn-confirm-delete');

  if (btnCancel) btnCancel.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
    fileToDelete = null;
  });

  if (btnConfirm) btnConfirm.addEventListener('click', async () => {
    if (fileToDelete) {
      await window.dex.deleteMediaFile(fileToDelete);
      showToast('Đã xóa file', 'success');
      if (modal) modal.style.display = 'none';
      fileToDelete = null;
      fetchMedia();
    }
  });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
        fileToDelete = null;
      }
    });
  }

  // Rename modal logic
  const renameModal = document.getElementById('rename-modal');
  const btnCancelRename = document.getElementById('btn-cancel-rename');
  const btnConfirmRename = document.getElementById('btn-confirm-rename');
  const renameInput = document.getElementById('input-rename-file');

  if (btnCancelRename) btnCancelRename.addEventListener('click', () => {
    if (renameModal) renameModal.style.display = 'none';
    fileToRename = null;
  });

  if (btnConfirmRename) btnConfirmRename.addEventListener('click', async () => {
    if (fileToRename && renameInput && renameInput.value.trim() !== '') {
      const res = await window.dex.renameMediaFile(fileToRename, renameInput.value.trim());
      if (res && res.success) {
        showToast('Đổi tên file thành công', 'success');
        if (renameModal) renameModal.style.display = 'none';
        fileToRename = null;
        fetchMedia();
      } else {
        showToast(res.error || 'Lỗi khi đổi tên', 'danger');
      }
    }
  });

  if (renameModal) {
    renameModal.addEventListener('click', (e) => {
      if (e.target === renameModal) {
        renameModal.style.display = 'none';
        fileToRename = null;
      }
    });
  }
}
