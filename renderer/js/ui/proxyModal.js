import { els } from '../elements.js';
import { showToast } from './toast.js';
import { withLoading } from '../actions/deviceActions.js';

let activeProxySerial = '';

export function openProxyModal(serial) {
  activeProxySerial = serial;
  if (els.proxyModalSerial) els.proxyModalSerial.textContent = serial;
  if (els.inputProxyStr) els.inputProxyStr.value = '';
  if (els.proxyModal) els.proxyModal.style.display = 'flex';
}

export function closeProxyModal() {
  if (els.proxyModal) els.proxyModal.style.display = 'none';
  activeProxySerial = '';
}

export async function saveProxy() {
  if (!activeProxySerial) return;
  const proxyStr = els.inputProxyStr.value.trim();
  if (!proxyStr) {
    showToast('Vui lòng nhập chuỗi proxy (IP:PORT)', 'danger');
    return;
  }
  await withLoading(activeProxySerial, async () => {
    try {
      const res = await window.dex.setProxy(activeProxySerial, proxyStr);
      if (res && res.success) {
        showToast(`Đã lưu proxy cho ${activeProxySerial}`, 'success');
        closeProxyModal();
      } else {
        showToast('Lỗi khi set proxy', 'danger');
      }
    } catch(e) {
      showToast('Lỗi hệ thống khi set proxy', 'danger');
    }
  });
}

export async function clearProxy() {
  if (!activeProxySerial) return;
  await withLoading(activeProxySerial, async () => {
    try {
      const res = await window.dex.clearProxy(activeProxySerial);
      if (res && res.success) {
        showToast(`Đã xóa proxy cho ${activeProxySerial}`, 'success');
        closeProxyModal();
      } else {
        showToast('Lỗi khi xóa proxy', 'danger');
      }
    } catch(e) {
      showToast('Lỗi hệ thống khi xóa proxy', 'danger');
    }
  });
}

export function initProxyModal() {
  if (els.btnSaveProxy) els.btnSaveProxy.addEventListener('click', saveProxy);
  if (els.btnClearProxy) els.btnClearProxy.addEventListener('click', clearProxy);
  if (els.btnCloseProxyModal) els.btnCloseProxyModal.addEventListener('click', closeProxyModal);
  
  if (els.proxyModal) {
    els.proxyModal.addEventListener('click', (e) => {
      if (e.target === els.proxyModal) closeProxyModal();
    });
  }
}
