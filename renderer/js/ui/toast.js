function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '9999';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '10px';
  document.body.appendChild(container);
  
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.innerHTML = `
      .toast { padding: 12px 20px; border-radius: 4px; color: #fff; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: opacity 0.3s; opacity: 0; }
      .toast-info { background: #3b82f6; }
      .toast-success { background: #10b981; }
      .toast-danger { background: #ef4444; }
      .toast.fade-in { opacity: 1; }
      .toast.fade-out { opacity: 0; }
    `;
    document.head.appendChild(style);
  }
  return container;
}

export function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} fade-in`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('fade-in');
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}
