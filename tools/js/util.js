/**
 * Shared DOM / browser utilities for Charity Recon.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convert kebab-case id to camelCase element key. */
export function idToKey(id) {
  return id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
}

export function cacheElements(ids) {
  const elements = {};
  for (const id of ids) {
    elements[idToKey(id)] = document.getElementById(id);
  }
  return elements;
}

export function initTheme(themeToggleEl) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeIcons(themeToggleEl);
}

export function toggleTheme(themeToggleEl) {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem(
    'theme',
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  updateThemeIcons(themeToggleEl);
}

export function updateThemeIcons(themeToggleEl) {
  if (!themeToggleEl) return;
  const isDark = document.documentElement.classList.contains('dark');
  const sunIcon = themeToggleEl.querySelector('[data-lucide="sun"]');
  const moonIcon = themeToggleEl.querySelector('[data-lucide="moon"]');
  if (sunIcon) sunIcon.style.display = isDark ? 'none' : 'block';
  if (moonIcon) moonIcon.style.display = isDark ? 'block' : 'none';
}

export function showToast(container, message, type = 'success') {
  if (!container) return;
  const toast = document.createElement('div');
  const icon = type === 'success' ? 'check-circle' : 'alert-circle';
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

export function copyToClipboard(text, button, toastContainer) {
  const done = () => {
    const isCopyAll = button.classList.contains('copy-all-btn');
    showToast(toastContainer, isCopyAll ? 'All links copied!' : 'Link copied!');
    const original = button.innerHTML;
    button.innerHTML = `<i data-lucide="check" class="w-5 h-5 text-green-500"></i>`;
    if (window.lucide) lucide.createIcons();
    setTimeout(() => {
      button.innerHTML = original;
      if (window.lucide) lucide.createIcons();
    }, 1500);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      showToast(toastContainer, 'Failed to copy!', 'error');
    });
    return;
  }
  // Fallback
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    showToast(toastContainer, 'Failed to copy!', 'error');
  }
  document.body.removeChild(ta);
}

export function showStatus(element, message, type = 'success', duration = 3000) {
  if (!element) return;
  const colors = { success: 'text-green-600', error: 'text-red-600', info: 'text-gray-600' };
  const darkColors = {
    success: 'dark:text-green-400',
    error: 'dark:text-red-400',
    info: 'dark:text-gray-400',
  };
  element.textContent = message;
  element.className = `mt-4 text-center font-medium ${colors[type] || colors.info} ${darkColors[type] || darkColors.info}`;
  if (element._statusTimeout) clearTimeout(element._statusTimeout);
  if (duration !== null) {
    element._statusTimeout = setTimeout(() => {
      if (element.textContent === message) {
        element.textContent = '';
        element.className = 'mt-4 text-center font-medium';
      }
      delete element._statusTimeout;
    }, duration);
  } else {
    delete element._statusTimeout;
  }
}

export function closeModal(modalElement) {
  if (modalElement) modalElement.style.display = 'none';
}

export function openModal(modalElement) {
  if (modalElement) modalElement.style.display = 'block';
}

export function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}
