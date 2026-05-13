type ToastType = 'success' | 'error' | 'info';

const CONTAINER_ID = 'lifeos-toast-container';

function ensureContainer(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('toast can only run in the browser');
  }
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.style.position = 'fixed';
    el.style.top = '16px';
    el.style.right = '16px';
    el.style.zIndex = '9999';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '8px';
    document.body.appendChild(el);
  }
  return el;
}

export function showToast(message: string, type: ToastType = 'success', ttlMs = 3000): void {
  if (typeof document === 'undefined') return;
  const root = ensureContainer();
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.padding = '10px 14px';
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '13px';
  toast.style.fontFamily = 'Inter, system-ui, sans-serif';
  toast.style.background = 'var(--bg-1)';
  toast.style.color = 'var(--text-0)';
  toast.style.border = '1px solid var(--line)';
  toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
  toast.style.borderLeft = `3px solid var(--${type === 'success' ? 'good' : type === 'error' ? 'danger' : 'info'})`;
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-6px)';
  toast.style.transition = 'opacity 0.18s, transform 0.18s';
  root.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    window.setTimeout(() => toast.remove(), 200);
  }, ttlMs);
}
