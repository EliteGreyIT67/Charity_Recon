/**
 * OSINT tab UI: form submit, results accordion, state select.
 */
import { buildLinkSections } from './osint-links.js';
import { escapeHtml, copyToClipboard, showToast, refreshIcons } from './util.js';

export function createOsintController({ elements, getStateData, toastContainer }) {
  function createLinkHTML(text, href) {
    const isValidUrl = href && (href.startsWith('http://') || href.startsWith('https://'));
    const safeText = escapeHtml(text);
    const safeHref = escapeHtml(href || '');
    const linkAttributes = isValidUrl
      ? `href="${safeHref}" target="_blank" rel="noopener noreferrer"`
      : `href="#" aria-disabled="true" title="Invalid URL provided"`;
    const linkColor = isValidUrl ? 'text-indigo-500 hover:text-indigo-600' : 'text-gray-400 cursor-not-allowed';
    const copyButtonDisabled = !isValidUrl ? 'disabled' : '';

    return `
      <div class="result-link-card">
        <a ${linkAttributes} class="flex-grow font-medium text-gray-700 dark:text-gray-200 truncate pr-4 ${!isValidUrl ? 'opacity-50' : ''}">${safeText}</a>
        <div class="flex items-center space-x-2 flex-shrink-0">
          <a ${linkAttributes} class="${linkColor}" aria-label="Open link for ${safeText} ${isValidUrl ? 'in new tab' : '(Invalid URL)'}">
            <i data-lucide="${isValidUrl ? 'arrow-up-right' : 'alert-circle'}" class="w-5 h-5"></i>
          </a>
          <button class="copy-link-btn p-1 rounded text-gray-400 hover:text-indigo-500" data-link="${safeHref}" title="Copy link" aria-label="Copy link for ${safeText}" ${copyButtonDisabled}>
            <i data-lucide="copy" class="w-5 h-5"></i>
          </button>
        </div>
      </div>`;
  }

  function createAccordionSectionHTML(id, title, icon, links, isOpen = false) {
    if (!links || links.length === 0) return '';
    const linksHtml = links.map((link) => createLinkHTML(link.name, link.url)).join('');
    const allLinksText = escapeHtml(links.map((l) => `${l.name}: ${l.url}`).join('\n'));
    const safeTitle = escapeHtml(title);
    const safeId = escapeHtml(id);
    const safeIcon = escapeHtml(icon);

    return `
      <div class="card overflow-hidden">
        <h2>
          <button class="accordion-header w-full" aria-expanded="${isOpen}" data-target="${safeId}-content">
            <span class="flex items-center space-x-3 text-left">
              <i data-lucide="${safeIcon}" class="w-6 h-6 text-indigo-500 flex-shrink-0"></i>
              <span class="text-xl font-semibold">${safeTitle}</span>
            </span>
            <span class="flex items-center space-x-3">
              <button class="copy-all-btn p-1 rounded text-gray-400 hover:text-indigo-500" data-links="${allLinksText}" title="Copy all links in this section" aria-label="Copy all links in the ${safeTitle} section">
                <i data-lucide="copy-plus" class="w-5 h-5"></i>
              </button>
              <i data-lucide="chevron-down" class="chevron-icon ${isOpen ? 'rotate-180' : ''} transition-transform duration-300"></i>
            </span>
          </button>
        </h2>
        <div id="${safeId}-content" role="region" class="accordion-content px-5 pb-5 ${isOpen ? 'open' : ''} transition-all duration-500 ease-in-out">
          <div class="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">${linksHtml}</div>
        </div>
      </div>`;
  }

  function resetGenerateButton() {
    if (!elements.generateButton) return;
    elements.generateButton.disabled = false;
    elements.generateButton.innerHTML = `<i data-lucide="search" class="w-5 h-5"></i><span>Generate</span>`;
    refreshIcons();
  }

  function renderResults(orgName, sections) {
    elements.resultsTitle.textContent = `Investigation for: "${orgName}"`;
    elements.accordionContainer.innerHTML = sections
      .map((s) => createAccordionSectionHTML(s.id, s.title, s.icon, s.links, s.isOpen))
      .join('');
    elements.placeholder.classList.add('hidden-fade');
    elements.resultsContainer.classList.remove('hidden-fade');
    elements.resultsContainer.classList.add('visible-fade');
    resetGenerateButton();
    refreshIcons();
  }

  function gatherInputs() {
    return {
      orgName: elements.orgName?.value.trim() || '',
      personName: elements.personName?.value.trim() || '',
      orgEin: elements.orgEin?.value.trim() || '',
      location: elements.location?.value.trim() || '',
      domainName: elements.domainName?.value.trim() || '',
      socialHandle: elements.socialHandle?.value.trim() || '',
      selectedState: elements.stateSelect?.value || '',
    };
  }

  function handleSubmit(e) {
    e.preventDefault();
    elements.generateButton.disabled = true;
    elements.generateButton.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i><span>Generating...</span>`;
    refreshIcons();
    elements.placeholder.classList.add('hidden');
    elements.skeletonContainer.classList.remove('hidden');

    // Sync work — no artificial delay
    const inputs = gatherInputs();
    if (!inputs.orgName) {
      elements.errorMessage.textContent = 'Organization name is required.';
      elements.errorMessage.classList.remove('hidden');
      resetGenerateButton();
      elements.skeletonContainer.classList.add('hidden');
      elements.placeholder.classList.remove('hidden');
      return;
    }
    elements.errorMessage.classList.add('hidden');
    const sections = buildLinkSections(inputs, getStateData());
    renderResults(inputs.orgName, sections);
    elements.skeletonContainer.classList.add('hidden');
  }

  function clearResults() {
    elements.searchForm?.reset();
    elements.resultsContainer.classList.remove('visible-fade');
    elements.resultsContainer.classList.add('hidden-fade');
    setTimeout(() => {
      elements.accordionContainer.innerHTML = '';
      elements.resultsTitle.textContent = '';
      elements.placeholder.classList.remove('hidden-fade');
      elements.placeholder.classList.remove('hidden');
    }, 300);
  }

  function handleAccordionClick(e) {
    const accordionButton = e.target.closest('button.accordion-header');
    const copyButton = e.target.closest('.copy-link-btn, .copy-all-btn');

    if (accordionButton && !copyButton) {
      const targetId = accordionButton.dataset.target;
      if (!targetId) return;
      const content = document.getElementById(targetId);
      const chevron = accordionButton.querySelector('.chevron-icon');
      const isExpanded = accordionButton.getAttribute('aria-expanded') === 'true';
      accordionButton.setAttribute('aria-expanded', String(!isExpanded));
      content?.classList.toggle('open');
      chevron?.classList.toggle('rotate-180');
      return;
    }

    if (copyButton) {
      e.stopPropagation();
      const textToCopy = copyButton.dataset.link || copyButton.dataset.links;
      if (textToCopy) copyToClipboard(textToCopy, copyButton, toastContainer);
      return;
    }

    const link = e.target.closest('a');
    if (link) link.classList.add('visited-link');
  }

  function populateStates() {
    const states = getStateData().states || {};
    if (!elements.stateSelect) return;
    const fragment = document.createDocumentFragment();
    const sorted = Object.entries(states).sort(([, a], [, b]) => a.localeCompare(b));
    for (const [abbr, name] of sorted) {
      const option = document.createElement('option');
      option.value = abbr;
      option.textContent = name;
      fragment.appendChild(option);
    }
    elements.stateSelect.innerHTML = '<option value="">Select a State or Territory (Optional)</option>';
    elements.stateSelect.appendChild(fragment);
  }

  function bind() {
    elements.searchForm?.addEventListener('submit', handleSubmit);
    elements.clearButton?.addEventListener('click', clearResults);
    elements.accordionContainer?.addEventListener('click', handleAccordionClick);
  }

  return {
    bind,
    populateStates,
    gatherInputs,
    clearResults,
  };
}
