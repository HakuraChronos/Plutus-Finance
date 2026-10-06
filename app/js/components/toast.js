/* ==========================================================================
   PLUTUS FINANCE - TOAST NOTIFICATION SYSTEM
   ========================================================================== */

class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    let el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      el.className = 'toast-container';
      document.body.appendChild(el);
    }
    this.container = el;
  }

  show({ message, type = 'info', duration = 3500 }) {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    const iconElement = document.createElement('span');
    iconElement.style.fontSize = '1.15rem';
    iconElement.textContent = icon;
    const messageElement = document.createElement('div');
    messageElement.style.cssText = 'flex: 1; line-height: 1.4;';
    messageElement.textContent = String(message);
    toast.append(iconElement, messageElement);

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  success(msg) {
    this.show({ message: msg, type: 'success' });
  }

  warning(msg) {
    this.show({ message: msg, type: 'warning', duration: 5000 });
  }

  error(msg) {
    this.show({ message: msg, type: 'error' });
  }

  info(msg) {
    this.show({ message: msg, type: 'info' });
  }
}

export const toast = new ToastManager();
