/**
 * Compliance checklist: localStorage model + UI.
 */
import { escapeHtml, showStatus, refreshIcons, openModal, closeModal } from './util.js';

export const STORAGE_KEY = 'charity_recon_checklists';
const LEGACY_STORAGE_KEY = 'charity_recon_checklists_standalone';

export function getChecklistMasterTemplate() {
  return JSON.parse(JSON.stringify([
    {
      id: 'cat_fed_state',
      name: 'Federal & State Compliance',
      isCustom: false,
      items: [
        { id: 'fed_irs_status', text: 'IRS 501(c)(3) status verified?', link: 'https://apps.irs.gov/app/eos/', linkText: 'IRS Search', isCustom: false, checked: false, notes: '' },
        { id: 'fed_form_990', text: 'IRS Form 990 accessible & reviewed?', link: 'https://projects.propublica.org/nonprofits/search?q=', linkText: 'ProPublica Search', isCustom: false, checked: false, notes: '' },
        { id: 'rep_bbb_rating', text: 'Better Business Bureau (BBB) rating checked?', link: 'https://www.bbb.org/search?find_text=', linkText: 'BBB Search', isCustom: false, checked: false, notes: '' },
        { id: 'fed_aphis_license', text: 'APHIS license status verified (if applicable)?', link: 'https://aphis.my.site.com/PublicSearchTool/s/', linkText: 'APHIS Search', isCustom: false, checked: false, notes: '' },
        { id: 'state_charity_reg', text: 'Registered with State Charity Officials?', link: 'https://www.nasconet.org/resources/state-government/', linkText: 'NASCO Directory', isCustom: false, checked: false, notes: '' },
        { id: 'state_local_licenses', text: 'Necessary state/local animal shelter/rescue licenses obtained?', isCustom: false, checked: false, notes: '' },
      ],
    },
    {
      id: 'cat_operational_trans',
      name: 'Operational Transparency',
      isCustom: false,
      items: [
        { id: 'op_legal_dba_name', text: 'Legal name and DBA (Doing Business As) are clearly stated?', isCustom: false, checked: false, notes: '' },
        { id: 'op_contact_info', text: 'Verifiable contact information (phone/email) is available and responsive?', isCustom: false, checked: false, notes: '' },
        { id: 'op_website_mission', text: 'Website clearly states mission, programs, and animal welfare practices?', isCustom: false, checked: false, notes: '' },
        { id: 'op_board_list', text: 'A list of the Board of Directors is publicly available?', isCustom: false, checked: false, notes: '' },
        { id: 'op_adoption_process', text: 'Adoption process is clearly documented and transparent?', isCustom: false, checked: false, notes: '' },
        { id: 'op_sourcing_policy', text: 'Animal sourcing policy (where animals come from) is clear?', isCustom: false, checked: false, notes: '' },
        { id: 'op_medical_records', text: 'Comprehensive medical records (vaccinations, spay/neuter) are provided with adoptions?', isCustom: false, checked: false, notes: '' },
      ],
    },
    {
      id: 'cat_reputation_acc',
      name: 'Reputation & Accountability',
      isCustom: false,
      items: [
        { id: 'rep_watchdog_sites', text: 'Charity watchdog sites (e.g., Charity Navigator, GuideStar) reviewed?', link: 'https://www.charitynavigator.org/', linkText: 'Charity Navigator', isCustom: false, checked: false, notes: '' },
        { id: 'rep_news_archives', text: 'News archives and search engines checked for significant negative press or legal issues?', isCustom: false, checked: false, notes: '' },
      ],
    },
  ]));
}

export function migrateLegacyChecklistStorage() {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return;
    const legacy = JSON.parse(legacyRaw);
    if (!Array.isArray(legacy) || legacy.length === 0) return;
    const existingRaw = localStorage.getItem(STORAGE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const byId = new Map((Array.isArray(existing) ? existing : []).map((c) => [c.id, c]));
    for (const item of legacy) {
      if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...byId.values()]));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    console.warn('[checklist] migration skipped:', err);
  }
}

export function loadChecklists() {
  migrateLegacyChecklistStorage();
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveChecklists(checklists) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists));
}

export function createChecklistController({ elements, onSwitchToList }) {
  let current = null;
  let saveTimeout = null;
  let confirmAction = null;

  function showSubView(subView) {
    elements.checklistListView?.classList.toggle('hidden', subView !== 'list');
    elements.checklistEditorView?.classList.toggle('hidden', subView !== 'editor');
  }

  function setSaveButtonState(isSaving) {
    if (!elements.saveChecklistBtn || !elements.saveButtonText || !elements.saveSpinner) return;
    elements.saveButtonText.textContent = isSaving ? 'Saving...' : 'Save';
    elements.saveSpinner.classList.toggle('hidden', !isSaving);
    elements.saveChecklistBtn.disabled = isSaving;
  }

  function renderItemHTML(item, categoryId) {
    const toolButtonHtml = item.link
      ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="contextual-tool-button mt-1.5 flex items-center space-x-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline" data-base-url="${escapeHtml(item.link)}"><i data-lucide="external-link" class="h-4 w-4"></i><span>${escapeHtml(item.linkText || 'Open Tool')}</span></a>`
      : '';
    return `
      <div class="checklist-item border-b border-gray-100 dark:border-gray-700/50 pb-4 last:border-b-0" data-item-id="${escapeHtml(item.id)}" data-category-id="${escapeHtml(categoryId)}">
        <div class="flex items-start space-x-4">
          <input type="checkbox" id="check-${escapeHtml(item.id)}" class="custom-checkbox mt-1" data-action="check-item" ${item.checked ? 'checked' : ''}>
          <label for="check-${escapeHtml(item.id)}" class="item-text flex-1 text-gray-700 dark:text-gray-300 cursor-pointer">${escapeHtml(item.text)}</label>
        </div>
        <div class="pl-10 mt-2 space-y-3">
          ${toolButtonHtml}
          <textarea class="notes-input w-full p-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" data-action="update-note" placeholder="Add notes...">${escapeHtml(item.notes || '')}</textarea>
        </div>
      </div>`;
  }

  function renderCategoryHTML(category) {
    return `
      <div class="category-block bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/80 dark:border-gray-700/80 expanded" data-category-id="${escapeHtml(category.id)}">
        <div class="flex justify-between items-center p-4 cursor-pointer" data-action="toggle-category">
          <h3 class="category-title text-xl font-semibold text-gray-700 dark:text-gray-300">${escapeHtml(category.name)}</h3>
          <i data-lucide="chevron-down" class="category-toggle-icon text-gray-500 chevron-icon transform rotate-180"></i>
        </div>
        <div class="category-content open px-4 pb-4">
          <div class="space-y-5 border-t border-gray-200 dark:border-gray-700 pt-4">
            ${(category.items || []).map((item) => renderItemHTML(item, category.id)).join('')}
            <button class="add-item-button mt-4 w-full text-sm btn btn-secondary" data-action="add-item">Add Item</button>
          </div>
        </div>
      </div>`;
  }

  function updateDynamicToolLinks() {
    if (!elements.checklistOrgNameInput || !elements.checklistItemsContainer) return;
    const orgName = elements.checklistOrgNameInput.value.trim();
    if (!orgName) return;
    const encodedOrgName = encodeURIComponent(orgName);
    elements.checklistItemsContainer.querySelectorAll('a.contextual-tool-button[data-base-url]').forEach((link) => {
      link.href = `${link.dataset.baseUrl}${encodedOrgName}`;
    });
  }

  function buildUI(data) {
    if (!elements.checklistItemsContainer || !elements.checklistSummaryNotes) return;
    elements.checklistItemsContainer.innerHTML = '';
    (data.categories || []).forEach((category) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = renderCategoryHTML(category);
      elements.checklistItemsContainer.appendChild(wrap.firstElementChild);
    });
    elements.checklistSummaryNotes.value = data.summary || '';
    updateDynamicToolLinks();
    refreshIcons();
  }

  function filterAndRenderListView() {
    if (!elements.checklistSearchInput || !elements.savedChecklistsContainer || !elements.noChecklistsMessage) return;
    const searchTerm = elements.checklistSearchInput.value.toLowerCase();
    const cards = elements.savedChecklistsContainer.querySelectorAll('[data-id]');
    let visibleCount = 0;
    cards.forEach((card) => {
      const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
      const isVisible = title.includes(searchTerm);
      card.style.display = isVisible ? '' : 'none';
      if (isVisible) visibleCount++;
    });
    const hasAny = elements.savedChecklistsContainer.children.length > 0;
    elements.noChecklistsMessage.classList.toggle('hidden', !( !hasAny || visibleCount === 0 ));
  }

  function renderListView(checklists) {
    const container = elements.savedChecklistsContainer;
    if (!container) return;
    container.innerHTML = '';
    elements.noChecklistsMessage?.classList.toggle('hidden', checklists.length > 0);
    const sorted = [...checklists].sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    sorted.forEach((list) => {
      const card = document.createElement('div');
      card.className = 'p-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-indigo-500/50';
      card.dataset.id = list.id;
      card.addEventListener('click', () => renderForm(list.id));
      const lastUpdated = list.lastUpdated ? new Date(list.lastUpdated).toLocaleString() : 'N/A';
      card.innerHTML = `
        <div class="flex justify-between items-start">
          <h3 class="text-xl font-bold text-gray-800 dark:text-white truncate pr-4">${escapeHtml(list.orgName || 'Untitled Checklist')}</h3>
          <span class="flex-shrink-0 text-xs font-semibold uppercase px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Local</span>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Last updated: ${escapeHtml(lastUpdated)}</p>`;
      container.appendChild(card);
    });
    filterAndRenderListView();
  }

  function refreshList() {
    try {
      const checklists = loadChecklists();
      showSubView('list');
      renderListView(checklists);
    } catch (error) {
      console.error(error);
      if (elements.noChecklistsMessage) {
        elements.noChecklistsMessage.innerHTML = `<div class="flex flex-col items-center"><i data-lucide="alert-triangle" class="w-20 h-20 text-red-400 mb-4"></i><p class="text-xl font-semibold">Error Loading Checklists</p></div>`;
        refreshIcons();
      }
      renderListView([]);
    }
  }

  function renderForm(checklistId = null, prefilledOrgName = '') {
    if (elements.checklistItemsContainer) elements.checklistItemsContainer.innerHTML = '';
    current = null;

    if (checklistId) {
      const data = loadChecklists().find((c) => c.id === checklistId);
      if (!data) {
        showStatus(elements.statusMessage, 'Checklist not found.', 'error');
        showSubView('list');
        return;
      }
      current = data;
      buildUI(data);
      if (elements.checklistOrgNameInput) elements.checklistOrgNameInput.value = data.orgName || '';
      if (elements.checklistTitle) elements.checklistTitle.textContent = data.orgName || 'New Checklist';
      elements.deleteChecklistBtn?.classList.remove('hidden');
    } else {
      current = {
        id: null,
        orgName: prefilledOrgName,
        categories: getChecklistMasterTemplate(),
        summary: '',
        lastUpdated: new Date().toISOString(),
      };
      buildUI(current);
      if (elements.checklistOrgNameInput) elements.checklistOrgNameInput.value = prefilledOrgName || '';
      if (elements.checklistTitle) elements.checklistTitle.textContent = prefilledOrgName || 'New Checklist';
      elements.deleteChecklistBtn?.classList.add('hidden');
    }
    showSubView('editor');
  }

  async function handleSave(force = false) {
    clearTimeout(saveTimeout);
    const saveAction = async () => {
      if (!current) return;
      const orgName = elements.checklistOrgNameInput.value.trim();
      if (!orgName) {
        elements.checklistOrgNameError?.classList.remove('hidden');
        return;
      }
      elements.checklistOrgNameError?.classList.add('hidden');
      current.orgName = orgName;
      current.summary = elements.checklistSummaryNotes.value;
      current.lastUpdated = new Date().toISOString();
      setSaveButtonState(true);
      try {
        let checklists = loadChecklists();
        if (current.id) {
          const index = checklists.findIndex((c) => c.id === current.id);
          if (index !== -1) checklists[index] = current;
          else checklists.push(current);
        } else {
          current.id = `checklist_${Date.now()}`;
          checklists.push(current);
          elements.deleteChecklistBtn?.classList.remove('hidden');
        }
        saveChecklists(checklists);
        showStatus(elements.statusMessage, 'Checklist saved!', 'success');
      } catch (error) {
        console.error(error);
        showStatus(elements.statusMessage, `Error saving: ${error.message}`, 'error', null);
      } finally {
        setSaveButtonState(false);
      }
    };
    if (force) await saveAction();
    else saveTimeout = setTimeout(saveAction, 1500);
  }

  function openConfirmation(title, message, onConfirm) {
    if (!elements.confirmationModal || !elements.modalTitle || !elements.modalMessage) return;
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    confirmAction = onConfirm;
    openModal(elements.confirmationModal);
  }

  function handleDelete() {
    if (!current?.id) return;
    openConfirmation(
      'Delete Checklist?',
      `Are you sure you want to permanently delete the "${current.orgName || 'Untitled Checklist'}" checklist? This cannot be undone.`,
      () => {
        try {
          const checklists = loadChecklists().filter((c) => c.id !== current.id);
          saveChecklists(checklists);
          current = null;
          showSubView('list');
          refreshList();
        } catch (error) {
          showStatus(elements.statusMessage, `Error deleting: ${error.message}`, 'error');
        }
      }
    );
  }

  function addItem(categoryId) {
    if (!current?.categories) return;
    const category = current.categories.find((c) => c.id === categoryId);
    if (!category) return;
    const newItemText = prompt('Enter text for the new checklist item:', 'New Item');
    if (newItemText === null || newItemText.trim() === '') return;
    if (!category.items) category.items = [];
    category.items.push({
      id: `item_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      text: newItemText.trim(),
      isCustom: true,
      checked: false,
      notes: '',
    });
    buildUI(current);
    handleSave(true);
  }

  function addCategory() {
    if (!current) return;
    const newCategoryName = prompt('Enter name for the new category:', 'New Category');
    if (newCategoryName === null || newCategoryName.trim() === '') return;
    if (!current.categories) current.categories = [];
    current.categories.push({
      id: `cat_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: newCategoryName.trim(),
      isCustom: true,
      items: [],
    });
    buildUI(current);
    handleSave(true);
  }

  function onContainerClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const categoryEl = target.closest('.category-block');
    const categoryId = categoryEl?.dataset.categoryId;

    if (action === 'toggle-category' && categoryEl) {
      const content = categoryEl.querySelector('.category-content');
      const icon = categoryEl.querySelector('.category-toggle-icon');
      const isOpen = content?.classList.contains('open');
      content?.classList.toggle('open');
      icon?.classList.toggle('rotate-180', !isOpen);
      categoryEl.classList.toggle('expanded', !isOpen);
    } else if (action === 'add-item' && categoryId) {
      addItem(categoryId);
    }
  }

  function onContainerInput(e) {
    const target = e.target.closest('[data-action="update-note"]');
    if (!target || !current) return;
    const itemEl = target.closest('.checklist-item');
    const category = current.categories?.find((c) => c.id === itemEl?.dataset.categoryId);
    const item = category?.items?.find((i) => i.id === itemEl?.dataset.itemId);
    if (item) {
      item.notes = target.value;
      handleSave(false);
    }
  }

  function onContainerChange(e) {
    const target = e.target.closest('[data-action="check-item"]');
    if (!target || !current) return;
    const itemEl = target.closest('.checklist-item');
    const category = current.categories?.find((c) => c.id === itemEl?.dataset.categoryId);
    const item = category?.items?.find((i) => i.id === itemEl?.dataset.itemId);
    if (item) {
      item.checked = target.checked;
      handleSave(true);
    }
  }

  function bind() {
    elements.newChecklistBtn?.addEventListener('click', () => renderForm(null));
    elements.backToListBtn?.addEventListener('click', () => {
      showSubView('list');
      refreshList();
      onSwitchToList?.();
    });
    elements.saveChecklistBtn?.addEventListener('click', () => handleSave(true));
    elements.deleteChecklistBtn?.addEventListener('click', handleDelete);
    elements.checklistSearchInput?.addEventListener('input', filterAndRenderListView);
    elements.checklistOrgNameInput?.addEventListener('input', () => {
      if (elements.checklistTitle) {
        elements.checklistTitle.textContent = elements.checklistOrgNameInput.value.trim() || 'New Checklist';
      }
      updateDynamicToolLinks();
      handleSave(false);
    });
    elements.checklistSummaryNotes?.addEventListener('input', () => handleSave(false));
    elements.addCategoryBtn?.addEventListener('click', addCategory);
    elements.checklistItemsContainer?.addEventListener('click', onContainerClick);
    elements.checklistItemsContainer?.addEventListener('input', onContainerInput);
    elements.checklistItemsContainer?.addEventListener('change', onContainerChange);
    elements.modalConfirmBtn?.addEventListener('click', () => {
      confirmAction?.();
      if (elements.confirmationModal) closeModal(elements.confirmationModal);
    });
  }

  return {
    bind,
    refreshList,
    renderForm,
    showSubView,
  };
}
