/**
 * AttendX — Toast Notification System
 * Usage:
 *   showToast('User created successfully!', 'success');
 *   showToast('Something went wrong', 'error');
 *   showToast('Please wait...', 'info');
 *   showToast('Low attendance detected', 'warning');
 */

(function () {
  // Create toast container once
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const ICONS = {
    success: 'ri-checkbox-circle-line',
    error: 'ri-error-warning-line',
    info: 'ri-information-line',
    warning: 'ri-alert-line',
  };

  /**
   * Show a toast notification.
   * @param {string} message - The text to display
   * @param {'success'|'error'|'info'|'warning'} type - Toast type
   * @param {number} duration - Auto-dismiss duration in ms (default 3500)
   */
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.position = 'relative';
    toast.innerHTML = `
      <i class="${ICONS[type] || ICONS.info}"></i>
      <span>${message}</span>
      <button class="toast-close" title="Dismiss"><i class="ri-close-line"></i></button>
      <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => dismiss(toast));

    container.appendChild(toast);

    // Auto-dismiss
    const timer = setTimeout(() => dismiss(toast), duration);
    toast._timer = timer;
  }

  function dismiss(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timer);
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => toast.remove());
  }

  // Expose globally
  window.showToast = showToast;
})();
