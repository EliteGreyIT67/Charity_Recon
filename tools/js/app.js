/**
 * Charity Recon app shell: routing, init, wiring.
 */
import { cacheElements, initTheme, toggleTheme, closeModal, refreshIcons, showToast } from './util.js';
import { validateStateData } from './osint-links.js';
import { createOsintController } from './osint.js';
import { createChecklistController } from './checklist.js';

const ELEMENT_IDS = [
  'theme-toggle', 'search-form', 'generate-button', 'clear-button', 'org-name', 'person-name',
  'org-ein', 'location', 'domain-name', 'social-handle', 'state-select', 'results-container',
  'placeholder', 'error-message', 'results-title', 'accordion-container', 'toast-container',
  'skeleton-container', 'tab-osint', 'tab-checklist', 'osint-view', 'checklist-view',
  'checklist-list-view', 'new-checklist-btn',
  'checklist-search-input', 'no-checklists-message', 'saved-checklists-container',
  'checklist-editor-view', 'back-to-list-btn', 'checklist-title', 'checklist-org-name-input',
  'checklist-org-name-error', 'checklist-items-container', 'add-category-btn',
  'checklist-summary-notes', 'delete-checklist-btn', 'save-checklist-btn',
  'save-button-text', 'save-spinner', 'status-message', 'confirmation-modal', 'modal-title',
  'modal-message', 'modal-confirm-btn',
  'start-checklist-from-osint-btn',
];

const VIEW_TAB = {
  'osint-view': 'tab-osint',
  'checklist-view': 'tab-checklist',
};

const VIEW_HASH = {
  'osint-view': '#osint',
  'checklist-view': '#checklist',
};

let stateData = { states: {}, stateResources: {}, stateAnimalWelfareResources: {} };

export async function initApp() {
  const elements = cacheElements(ELEMENT_IDS);

  initTheme(elements.themeToggle);
  elements.themeToggle?.addEventListener('click', () => toggleTheme(elements.themeToggle));

  const osint = createOsintController({
    elements,
    getStateData: () => stateData,
    toastContainer: elements.toastContainer,
  });

  const checklist = createChecklistController({
    elements,
    onSwitchToList: () => {},
  });

  function switchView(viewId) {
    document.querySelectorAll('.view-content').forEach((el) => el.classList.add('hidden'));
    document.getElementById(viewId)?.classList.remove('hidden');

    document.querySelectorAll('.nav-tab').forEach((tab) => tab.classList.remove('active'));
    const tabId = VIEW_TAB[viewId];
    if (tabId) document.getElementById(tabId)?.classList.add('active');

    const hash = VIEW_HASH[viewId] || '#osint';
    if (location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  }

  function applyRouteFromLocation() {
    const hash = (location.hash || '').toLowerCase();
    const viewParam = (new URLSearchParams(location.search).get('view') || '').toLowerCase();
    if (hash === '#checklist' || viewParam === 'checklist') {
      switchView('checklist-view');
    } else {
      switchView('osint-view');
    }
  }

  elements.tabOsint?.addEventListener('click', () => switchView('osint-view'));
  elements.tabChecklist?.addEventListener('click', () => switchView('checklist-view'));
  window.addEventListener('hashchange', applyRouteFromLocation);

  elements.startChecklistFromOsintBtn?.addEventListener('click', () => {
    const orgName = elements.orgName?.value.trim() || '';
    if (!orgName) {
      showToast(elements.toastContainer, 'Please enter an organization name first.', 'error');
      return;
    }
    switchView('checklist-view');
    checklist.renderForm(null, orgName);
  });

  // Modal dismiss
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
    modal.querySelectorAll('[data-dismiss="modal"]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(modal));
    });
  });

  osint.bind();
  checklist.bind();

  await loadStateData(elements, osint);
  checklist.refreshList();
  applyRouteFromLocation();
  refreshIcons();
}

async function loadStateData(elements, osint) {
  try {
    // Resolve from this module URL so it works under any base path (e.g. GitHub Pages).
    const stateUrl = new URL('../state_data.json', import.meta.url);
    const response = await fetch(stateUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status} loading ${stateUrl.pathname}`);
    const raw = await response.json();
    const validated = validateStateData(raw);
    if (!validated.ok) throw new Error(validated.error);
    stateData = validated.data;
    osint.populateStates();
  } catch (error) {
    console.error('[app] state data load failed:', error);
    if (elements.errorMessage) {
      elements.errorMessage.textContent =
        'Error: Could not load state resources. Ensure tools/state_data.json is deployed and served over HTTP.';
      elements.errorMessage.classList.remove('hidden');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initApp().catch((err) => console.error('[app] init failed:', err));
});
