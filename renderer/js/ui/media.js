import { showToast } from './toast.js';

const mediaEls = {
  grid: document.getElementById('media-grid'),
  btnRefresh: document.getElementById('btn-refresh-media'),
  filterType: document.getElementById('media-filter-type'),
  selectAll: document.getElementById('media-select-all'),
  bulkActions: document.getElementById('media-bulk-actions'),
  btnDeleteSelected: document.getElementById('btn-delete-selected-media'),
  emptyState: document.getElementById('media-empty-state'),
  selectedCount: document.getElementById('media-selected-count')
};

let mediaList = [];
let selectedMedia = new Set();
let fileToDelete = null;

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
    filtered = mediaList.filter(m => m.type === mediaEls.filterType.value);
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
  const filtered = mediaEls.filterType && mediaEls.filterType.value !== 'all' 
    ? mediaList.filter(m => m.type === mediaEls.filterType.value) 
    : mediaList;

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
      if (window.dex) window.dex.openFile(p);
    });
  });

  const openBtns = mediaEls.grid.querySelectorAll('.action-open-media');
  openBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.path;
      if (window.dex) window.dex.openFile(p);
    });
  });

  const renameBtns = mediaEls.grid.querySelectorAll('.action-rename-media');
  renameBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.path;
      // Get the old filename (without extension for ease of editing, or with extension)
      const parts = p.split(/[\/\\]/);
      const oldName = parts[parts.length - 1];
      const newName = prompt('Nhập tên file mới (không bao gồm đuôi file):', oldName.split('.')[0]);
      if (newName && newName.trim() !== '') {
        const res = await window.dex.renameFile({ oldPath: p, newName: newName.trim() });
        if (res && res.success) {
          showToast('Đổi tên file thành công', 'success');
          fetchMedia();
        } else {
          showToast(res.error || 'Lỗi khi đổi tên', 'danger');
        }
      }
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
  if (mediaEls.filterType) {
    mediaEls.filterType.addEventListener('change', renderMedia);
  }
  if (mediaEls.selectAll) {
    mediaEls.selectAll.addEventListener('change', (e) => {
      const filtered = mediaEls.filterType.value !== 'all' 
        ? mediaList.filter(m => m.type === mediaEls.filterType.value) 
        : mediaList;
      
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
          await window.dex.deleteFile(p);
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
      await window.dex.deleteFile(fileToDelete);
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
}
