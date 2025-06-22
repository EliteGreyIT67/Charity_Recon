// Import Firebase modules using specific versions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, deleteObject, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- App State & Firebase References ---
let db;
let auth;
let storage;
let currentChecklistData = null; // Holds the data for the currently viewed/edited checklist
let checklistUnsubscribe = null; // Holds the unsubscribe function for the Firestore listener
let userId = null; // Current authenticated user ID
let isAuthReady = false; // Flag indicating if authentication state is known
let allChecklistsFromFirestore = []; // Cache of all checklists for the current user
let ui = {}; // Cache for DOM elements
let confirmAction = null; // Function to call when confirmation modal is confirmed

// --- App Configuration ---
// Use a default app ID if not provided by a build process
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-animal-rescue-app';

// Firebase configuration (replace with your actual config or inject via build)
// This config is hardcoded in the original, so it's kept here.
const firebaseConfig = {
    apiKey: "AIzaSyCSLAD2acFHCmf8bkJwQx_puLcb-HARyJE",
    authDomain: "rescue-compliance-app.firebaseapp.com",
    projectId: "rescue-compliance-app",
    storageBucket: "rescue-compliance-app.firebasestorage.app",
    messagingSenderId: "354094080932",
    appId: "1:354094080932:web:7c9aeb9b0036e6542d5731",
    measurementId: "G-CL6TNFWL0L"
};

// Master checklist structure to be used as a template for new checklists
// Includes default categories and items with properties like id, text, links, etc.
const checklistMasterTemplate = [
    { id: "cat_fed_state", name: "Federal & State Compliance", isCustom: false, items: [
        { id: "fed_irs_status", text: "IRS 501(c)(3) status verified?", link: "https://apps.irs.gov/app/eos/", isCustom: false, attachments: [] },
        { id: "fed_form_990", text: "IRS Form 990 accessible & reviewed?", linkText: "IRS/ProPublica/Candid", isCustom: false, attachments: [] },
        { id: "fed_aphis_license", text: "APHIS license status verified (if applicable)?", link: "https://aphis.my.site.com/PublicSearchTool/s/", isCustom: false, attachments: [] },
        { id: "state_charity_reg", text: "Registered with State Charity Officials?", link: "https://www.nasconet.org/resources/state-government/", linkText: "NASCO", isCustom: false, attachments: [] },
        { id: "review_solicitation_reg", text: "Review charitable solicitation registrations?", link: "https://www.nasconet.org/resources/state-government/", linkText: "NASCO", isCustom: false, attachments: [] },
        { id: "state_local_licenses", text: "Necessary state/local animal shelter/rescue licenses obtained (if applicable)?", isCustom: false, attachments: [] }
    ]},
    { id: "cat_operational_trans", name: "Operational Transparency", isCustom: false, items: [
        { id: "op_legal_dba_name", text: "Legal name and DBA (Doing Business As) are clearly stated?", isCustom: false, attachments: [] },
        { id: "op_contact_info", text: "Verifiable contact information (phone/email) is available and responsive?", isCustom: false, attachments: [] },
        { id: "op_website_mission", text: "Website clearly states mission, programs, and animal welfare practices?", isCustom: false, attachments: [] },
        { id: "op_board_list", text: "A list of the Board of Directors is publicly available?", isCustom: false, attachments: [] },
        { id: "op_financial_reports", text: "Financial reports (e.g., annual report, Form 990) are available for review?", isCustom: false, attachments: [] },
        { id: "op_adoption_process", text: "Adoption process is clearly documented and transparent?", isCustom: false, attachments: [] },
        { id: "op_sourcing_policy", text: "Animal sourcing policy (where animals come from) is clear?", isCustom: false, attachments: [] },
        { id: "op_medical_records", text: "Comprehensive medical records (vaccinations, spay/neuter, conditions) are provided with adoptions?", isCustom: false, attachments: [] }
    ]},
    { id: "cat_reputation_acc", name: "Reputation & Accountability", isCustom: false, items: [
        { id: "rep_bbb_rating", text: "Better Business Bureau (BBB) rating checked for unresolved complaints?", link: "https://www.bbb.org/scamtracker/lookupscam", isCustom: false, attachments: [] },
        { id: "rep_watchdog_sites", text: "Charity watchdog sites (e.g., Charity Navigator, GuideStar) reviewed?", linkText: "Charity Navigator, GuideStar, etc.", isCustom: false, attachments: [] },
        { id: "rep_news_archives", text: "News archives and search engines checked for significant negative press or legal issues?", isCustom: false, attachments: [] }
    ]}
];

// --- UI Element Cache ---
// Caches frequently used DOM elements on initialization
function cacheDOMElements() {
    ui = {
        // App Views
        listView: document.getElementById('list-view'),
        checklistView: document.getElementById('checklist-view'),

        // Main buttons
        newChecklistBtn: document.getElementById('new-checklist-btn'),
        importChecklistBtn: document.getElementById('import-checklist-btn'),
        backToListBtn: document.getElementById('back-to-list-btn'),
        saveChecklistBtn: document.getElementById('save-checklist-btn'),
        deleteChecklistBtn: document.getElementById('delete-checklist-btn'),
        shareChecklistBtn: document.getElementById('share-checklist-btn'),
        printChecklistBtn: document.getElementById('print-checklist-btn'),
        copyChecklistBtn: document.getElementById('copy-checklist-btn'),
        addCategoryBtn: document.getElementById('add-category-btn'),

        // --- FIX: Added missing UI elements for dark mode toggle ---
        darkModeToggle: document.getElementById('dark-mode-toggle'),
        sunIcon: document.getElementById('sun-icon'),
        moonIcon: document.getElementById('moon-icon'),
        // --- END FIX ---

        // Checklist form elements
        orgNameInput: document.getElementById('org-name-input'),
        orgNameInputPrintHeader: document.getElementById('org-name-input-print-header'),
        orgNameError: document.getElementById('org-name-error'),
        checklistItemsContainer: document.getElementById('checklist-items-container'),
        checklistTitle: document.getElementById('checklist-title'),

        // List view elements
        savedChecklistsContainer: document.getElementById('saved-checklists-container'),
        searchInput: document.getElementById('search-input'),
        noChecklistsMsg: document.getElementById('no-checklists-message'),
        statusMessage: document.getElementById('status-message'),

        // Auth elements
        userInfo: document.getElementById('user-info'),
        authStatus: document.getElementById('auth-status'),
        userIdDisplay: document.getElementById('user-id'),

        // Confirmation Modal
        confirmationModal: document.getElementById('confirmation-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalMessage: document.getElementById('modal-message'),
        modalConfirmBtn: document.getElementById('modal-confirm-btn'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),

        // Share Modal
        shareModal: document.getElementById('share-modal'),
        shareIdDisplay: document.getElementById('share-id-display'),
        shareModalCopyBtn: document.getElementById('share-modal-copy-btn'),
        shareModalCloseBtn: document.getElementById('share-modal-close-btn'),

        // Import Modal
        importModal: document.getElementById('import-modal'),
        importIdInput: document.getElementById('import-id-input'),
        importStatusMessage: document.getElementById('import-status-message'),
        importModalConfirmBtn: document.getElementById('import-modal-confirm-btn'),
        importModalCancelBtn: document.getElementById('import-modal-cancel-btn'),

        // External Tool Modals
        openEinModalBtn: document.getElementById('open-ein-modal-btn'),
        einLookupModal: document.getElementById('ein-lookup-modal'),
        openPropublicaModalBtn: document.getElementById('open-propublica-modal-btn'),
        propublicaLookupModal: document.getElementById('propublica-lookup-modal'),
        openBbbModalBtn: document.getElementById('open-bbb-modal-btn'),
        bbbScamModal: document.getElementById('bbb-scam-modal'),
        openNascoModalBtn: document.getElementById('open-nasco-modal-btn'),
        nascoRegModal: document.getElementById('nasco-reg-modal'),
        openAphisModalBtn: document.getElementById('open-aphis-modal-btn'),
        aphisLookupModal: document.getElementById('aphis-lookup-modal'),
        openCharityNavModalBtn: document.getElementById('open-charitynav-modal-btn'),
        charityNavLookupModal: document.getElementById('charitynav-lookup-modal'),
        openCharityWatchModalBtn: document.getElementById('open-charitywatch-modal-btn'),
        charityWatchLookupModal: document.getElementById('charitywatch-lookup-modal'),

        // Customization Modals
        editModal: document.getElementById('edit-modal'),
        editModalTitle: document.getElementById('edit-modal-title'),
        editModalInput: document.getElementById('edit-modal-input'),
        editModalError: document.getElementById('edit-modal-error'),
        editModalCancelBtn: document.getElementById('edit-modal-cancel-btn'),
        editModalSaveBtn: document.getElementById('edit-modal-save-btn'),
    };
}


// --- Helper Functions ---
const helpers = {
    // Shows the specified view ('list' or 'checklist') and hides the other.
    showView: (viewToShow) => {
        ui.listView.classList.toggle('hidden', viewToShow !== 'list');
        ui.checklistView.classList.toggle('hidden', viewToShow !== 'checklist');
        window.scrollTo(0, 0); // Scroll to top when changing views
    },
    // Displays a status message in a designated element.
    showStatus: (element, message, type = 'success', duration = 3000) => {
        if (!element) return; // Prevent errors if element doesn't exist
        const colors = { success: 'text-green-600', info: 'text-sky-600', error: 'text-red-600' };
        const darkColors = { success: 'dark:text-green-400', info: 'dark:text-sky-400', error: 'dark:text-red-400' };
        element.textContent = message;
        element.className = `mt-4 text-center font-medium ${colors[type] || colors.info} ${darkColors[type] || darkColors.info}`;
        if (duration !== null) { // Use null to indicate no timeout
            setTimeout(() => { element.textContent = ''; }, duration);
        }
    },
    // Opens a modal element.
    openModal: (modalElement) => { if (modalElement) modalElement.style.display = 'block'; },
    // Closes a modal element.
    closeModal: (modalElement) => { if (modalElement) modalElement.style.display = 'none'; },
    // Opens the generic confirmation modal.
    openConfirmationModal: (title, message, onConfirm) => {
        ui.modalTitle.textContent = title;
        ui.modalMessage.textContent = message;
        confirmAction = onConfirm; // Store the action to be performed on confirmation
        helpers.openModal(ui.confirmationModal);
    },
    // Handlers for the edit modal, stored to be removed later
    _editModalSaveHandler: null,
    _editModalCancelHandler: null,
    // Opens the generic edit/add modal for text input.
    openEditModal: (title, placeholder, currentValue, onSave, onCancel, validationFn = (val) => val.trim() !== '') => {
        ui.editModalTitle.textContent = title;
        ui.editModalInput.placeholder = placeholder;
        ui.editModalInput.value = currentValue;
        ui.editModalError.classList.add('hidden'); // Hide previous errors

        // Remove previous listeners if they exist
        if (helpers._editModalSaveHandler) {
            ui.editModalSaveBtn.removeEventListener('click', helpers._editModalSaveHandler);
        }
        if (helpers._editModalCancelHandler) {
            ui.editModalCancelBtn.removeEventListener('click', helpers._editModalCancelHandler);
        }

        // Define and store new handlers
        helpers._editModalSaveHandler = () => {
            const newValue = ui.editModalInput.value.trim();
            if (validationFn(newValue)) {
                onSave(newValue);
                helpers.closeModal(ui.editModal);
                // Clean up references after use
                helpers._editModalSaveHandler = null;
                helpers._editModalCancelHandler = null;
            } else {
                ui.editModalError.textContent = "Input cannot be empty."; // Default error message
                ui.editModalError.classList.remove('hidden');
            }
        };

        helpers._editModalCancelHandler = () => {
            if (onCancel) onCancel();
            helpers.closeModal(ui.editModal);
            // Clean up references after use
            helpers._editModalSaveHandler = null;
            helpers._editModalCancelHandler = null;
        };

        // Attach new listeners
        ui.editModalSaveBtn.addEventListener('click', helpers._editModalSaveHandler);
        ui.editModalCancelBtn.addEventListener('click', helpers._editModalCancelHandler);

        helpers.openModal(ui.editModal);
    },
     // Opens a generic modal for external links.
     openExternalLinkModal: (modalElement, title, message, linkUrl, linkText) => {
        if (!modalElement) return;
        const modalConfirmLink = modalElement.querySelector('a[target="_blank"]'); // Ensure we get the link
        const modalTitleElement = modalElement.querySelector('h3');
        const modalMessageElement = modalElement.querySelector('p:not([id])'); // Select the message paragraph

        if (modalConfirmLink && modalTitleElement && modalMessageElement) {
            modalTitleElement.textContent = title;
            modalMessageElement.textContent = message;
            modalConfirmLink.href = linkUrl;
            modalConfirmLink.textContent = linkText;
            helpers.openModal(modalElement);
        } else {
            console.error("Could not find elements in external link modal:", modalElement);
        }
    },
    // Applies the selected theme (dark or light) to the document.
    applyTheme: (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            if (ui.sunIcon) ui.sunIcon.classList.add('hidden');
            if (ui.moonIcon) ui.moonIcon.classList.remove('hidden');
            localStorage.theme = 'dark';
        } else {
            document.documentElement.classList.remove('dark');
            if (ui.sunIcon) ui.sunIcon.classList.remove('hidden');
            if (ui.moonIcon) ui.moonIcon.classList.add('hidden');
            localStorage.theme = 'light';
        }
    }
};

// --- Rendering Logic ---

// Creates the DOM element for a single checklist item.
function createItemElement(item, categoryId) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'checklist-item border-b border-slate-100 dark:border-slate-700 pb-4 last:border-b-0';
    itemDiv.dataset.itemId = item.id;
    itemDiv.dataset.categoryId = categoryId;

    const label = document.createElement('label');
    label.className = 'flex items-start space-x-4 mb-2';

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.isChecked ?? false;
    checkbox.dataset.itemId = item.id;
    checkbox.dataset.categoryId = categoryId;
    checkbox.dataset.action = 'toggle-checked'; // Data attribute for delegation
    checkbox.className = 'custom-checkbox shrink-0 mt-1';

    const itemTextContainer = document.createElement('div');
    itemTextContainer.className = 'flex-grow flex justify-between items-center';
    const itemTextSpan = document.createElement('span');
    itemTextSpan.className = 'item-text text-base text-slate-700 dark:text-slate-300 flex-grow';
    itemTextSpan.textContent = item.text;
    itemTextContainer.appendChild(itemTextSpan);

    // Item action buttons (edit/delete)
    const itemActions = document.createElement('div');
    itemActions.className = 'flex space-x-2 shrink-0 ml-2';

    // Edit Item Text Button
    const editItemBtn = document.createElement('button');
    editItemBtn.className = 'edit-button p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400';
    editItemBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.827-2.828z" /></svg>`;
    editItemBtn.title = 'Edit item text';
    editItemBtn.dataset.action = 'edit-item'; // Data attribute for delegation
    editItemBtn.dataset.itemId = item.id;
    editItemBtn.dataset.categoryId = categoryId;
    itemActions.appendChild(editItemBtn);

    // Delete Item Button (only for custom items)
    if (item.isCustom) {
        const deleteItemBtn = document.createElement('button');
        deleteItemBtn.className = 'delete-button p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400';
        deleteItemBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" /></svg>`;
        deleteItemBtn.title = 'Delete item';
        deleteItemBtn.dataset.action = 'delete-item'; // Data attribute for delegation
        deleteItemBtn.dataset.itemId = item.id;
        deleteItemBtn.dataset.categoryId = categoryId;
        itemActions.appendChild(deleteItemBtn);
    }
    itemTextContainer.appendChild(itemActions);

    label.appendChild(checkbox);
    label.appendChild(itemTextContainer);
    itemDiv.appendChild(label);

    // Render resource links
    if (item.link || item.linkText) {
        const linkWrapper = document.createElement('div');
        linkWrapper.className = 'mt-1 mb-2 pl-8'; // Indent under checkbox
        if (item.link) {
            const link = document.createElement('a');
            link.href = item.link;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'text-sky-600 dark:text-sky-400 hover:underline text-sm font-medium';
            link.textContent = item.linkText || 'Visit Resource';
            linkWrapper.appendChild(link);
        } else {
             const linkPlaceholder = document.createElement('span');
             linkPlaceholder.className = 'link-placeholder text-slate-500 dark:text-slate-400 text-sm';
             linkPlaceholder.textContent = `(e.g., ${item.linkText})`;
             linkWrapper.appendChild(linkPlaceholder);
        }
        itemDiv.appendChild(linkWrapper);
    }

    // Notes Textarea
    const notesTextarea = document.createElement('textarea');
    notesTextarea.dataset.itemId = item.id;
    notesTextarea.dataset.categoryId = categoryId;
    notesTextarea.dataset.action = 'update-notes'; // Data attribute for delegation
    notesTextarea.value = item.notes ?? '';
    notesTextarea.placeholder = 'Optional notes...';
    notesTextarea.className = 'mt-2 w-full p-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:ring-1 focus:ring-sky-500 focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 resize-y transition';
    notesTextarea.rows = 2;
    itemDiv.appendChild(notesTextarea);

    // Attachments Section
    const attachmentsContainer = document.createElement('div');
    attachmentsContainer.className = 'attachments-container mt-3 pl-8'; // Indent
    attachmentsContainer.innerHTML = `<p class="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Attachments:</p>`;

    const attachmentsList = document.createElement('ul');
    attachmentsList.className = 'space-y-1';

    // Display existing attachments
    (item.attachments || []).forEach(attachment => {
        const attachmentLi = document.createElement('li');
        attachmentLi.className = 'flex items-center justify-between text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 p-2 rounded-md';
        attachmentLi.innerHTML = `
            <a href="${attachment.url}" target="_blank" rel="noopener noreferrer" class="flex items-center space-x-2 text-sky-600 dark:text-sky-400 hover:underline">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
                <span>${attachment.fileName}</span>
            </a>
            <button class="delete-attachment-btn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40" data-action="delete-attachment" data-file-name="${attachment.fileName}" data-file-url="${attachment.url}" data-item-id="${item.id}" data-category-id="${categoryId}" title="Delete attachment">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" /></svg>
            </button>
        `;
        attachmentsList.appendChild(attachmentLi);
    });

    attachmentsContainer.appendChild(attachmentsList);

    // Add Attachment button and hidden file input
    const addAttachmentDiv = document.createElement('div');
    addAttachmentDiv.className = 'file-input-wrapper mt-2';
    addAttachmentDiv.innerHTML = `
        <input type="file" id="file-input-${item.id}" class="hidden" data-item-id="${item.id}" data-category-id="${categoryId}">
        <button class="add-attachment-btn w-full bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-semibold py-2 px-3 rounded-lg text-sm transition-colors duration-200 flex items-center justify-center space-x-2" data-action="add-attachment" data-item-id="${item.id}" data-category-id="${categoryId}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span>Add Attachment</span>
        </button>
        <div class="attachment-upload-status mt-2 text-center text-sm hidden"></div>
    `;
    attachmentsContainer.appendChild(addAttachmentDiv);
    itemDiv.appendChild(attachmentsContainer);

    return itemDiv;
}

// Creates the DOM element for a category block including its items.
function createCategoryElement(category) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category-block bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200/80 dark:border-slate-700/80';
    categoryDiv.dataset.categoryId = category.id;

    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-700';

    const categoryTitleElement = document.createElement('h3');
    categoryTitleElement.className = 'category-title text-xl font-semibold text-slate-700 dark:text-slate-300 flex-grow';
    categoryTitleElement.textContent = category.name;
    categoryHeader.appendChild(categoryTitleElement);

    // Category action buttons (edit/delete)
    const categoryActions = document.createElement('div');
    categoryActions.className = 'flex space-x-2';

    // Edit Category Name Button
    const editCategoryBtn = document.createElement('button');
    editCategoryBtn.className = 'edit-button p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400';
    editCategoryBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.827-2.828z" /></svg>`;
    editCategoryBtn.title = 'Edit category name';
    editCategoryBtn.dataset.action = 'edit-category'; // Data attribute for delegation
    editCategoryBtn.dataset.categoryId = category.id;
    categoryActions.appendChild(editCategoryBtn);

    // Delete Category Button (only for custom categories)
    if (category.isCustom) {
        const deleteCategoryBtn = document.createElement('button');
        deleteCategoryBtn.className = 'delete-button p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400';
        deleteCategoryBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" /></svg>`;
        deleteCategoryBtn.title = 'Delete category';
        deleteCategoryBtn.dataset.action = 'delete-category'; // Data attribute for delegation
        deleteCategoryBtn.dataset.categoryId = category.id;
        categoryActions.appendChild(deleteCategoryBtn);
    }

    categoryHeader.appendChild(categoryActions);
    categoryDiv.appendChild(categoryHeader);

    const itemsWrapper = document.createElement('div');
    itemsWrapper.className = 'space-y-5';

    // Render items within the category
    category.items.forEach(item => {
        itemsWrapper.appendChild(createItemElement(item, category.id));
    });

    // Add new item button for the category
    const addItemBtn = document.createElement('button');
    addItemBtn.className = 'add-item-button mt-4 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-semibold py-2 px-3 rounded-lg text-sm transition-colors duration-200 flex items-center justify-center space-x-2';
    addItemBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg><span>Add New Item</span>`;
    addItemBtn.dataset.action = 'add-item'; // Data attribute for delegation
    addItemBtn.dataset.categoryId = category.id;
    itemsWrapper.appendChild(addItemBtn);

    categoryDiv.appendChild(itemsWrapper);
    return categoryDiv;
}

// Renders the checklist form view, either for a new checklist or an existing one.
async function renderChecklistForm(checklistId = null) {
    currentChecklistData = null; // Clear previous data
    if (checklistId) {
        // Fetch existing checklist data
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/checklists`, checklistId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            currentChecklistData = { id: docSnap.id, ...docSnap.data() };
        } else {
            console.error("Checklist not found!");
            helpers.showStatus(ui.statusMessage, "Could not find the selected checklist.", 'error');
            helpers.showView('list'); // Go back to list view if not found
            return;
        }
    } else {
        // Initialize data for a new checklist using a deep copy of the template
        currentChecklistData = {
            id: null,
            orgName: '',
            categories: JSON.parse(JSON.stringify(checklistMasterTemplate)), // Deep copy to avoid modifying template
            lastUpdated: null
        };
    }

    // Clear the checklist items container and populate UI elements
    ui.checklistItemsContainer.innerHTML = '';
    ui.orgNameInput.value = currentChecklistData?.orgName || '';
    ui.orgNameInputPrintHeader.textContent = currentChecklistData?.orgName || "New Checklist";
    ui.checklistTitle.textContent = currentChecklistData?.orgName || 'New Checklist';
    ui.deleteChecklistBtn.classList.toggle('hidden', !checklistId); // Hide delete for new checklists
    ui.shareChecklistBtn.classList.toggle('hidden', !checklistId); // Hide share for new checklists
    ui.orgNameError.classList.add('hidden'); // Hide name error initially

    // Render categories and items using helper functions
    currentChecklistData.categories.forEach(category => {
        ui.checklistItemsContainer.appendChild(createCategoryElement(category));
    });

    helpers.showView('checklist'); // Switch to checklist view
    // Event listeners are now handled by delegation on the container, attached in initApp
}

// Filters the list of checklists based on the search input and renders the list view.
function filterAndRenderListView() {
    if (!ui.searchInput) return;
    const searchTerm = ui.searchInput.value.trim().toLowerCase();
    const checklistsToRender = searchTerm
        ? allChecklistsFromFirestore.filter(c => c.orgName && c.orgName.toLowerCase().includes(searchTerm))
        : allChecklistsFromFirestore;

    renderListView(checklistsToRender);
}

// Renders the list of saved checklists in the list view.
function renderListView(checklists) {
    ui.savedChecklistsContainer.innerHTML = ''; // Clear current list
    const hasAnyChecklists = allChecklistsFromFirestore.length > 0;
    const hasRenderedChecklists = checklists.length > 0;

    // Show appropriate message if no checklists exist or no checklists match search
    if (!hasAnyChecklists) {
        ui.noChecklistsMsg.classList.remove('hidden');
        ui.noChecklistsMsg.querySelector('p.text-2xl').textContent = 'No checklists found.';
        ui.noChecklistsMsg.querySelector('p.text-slate-500').textContent = 'Click "Start New" to begin, or "Import Shared" to add one from a colleague.';
    } else if (!hasRenderedChecklists) {
         ui.noChecklistsMsg.classList.remove('hidden');
         ui.noChecklistsMsg.querySelector('p.text-2xl').textContent = 'No checklists match your search.';
         ui.noChecklistsMsg.querySelector('p.text-slate-500').textContent = 'Try a different search term or clear the search.';
    } else {
        ui.noChecklistsMsg.classList.add('hidden');
    }

    // Sort checklists by last updated date (most recent first)
    checklists.sort((a, b) => (b.lastUpdated?.toDate() || 0) - (a.lastUpdated?.toDate() || 0));

    // Create and append a card for each checklist
    checklists.forEach(checklist => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm hover:shadow-lg border border-transparent hover:border-sky-500 transition-all duration-200 cursor-pointer';
        card.onclick = () => renderChecklistForm(checklist.id); // Open checklist on click

        // Calculate completion progress
        let totalItems = 0;
        let itemsChecked = 0;
        checklist.categories?.forEach(cat => {
            totalItems += cat.items.length;
            itemsChecked += cat.items.filter(item => item.isChecked).length;
        });

        const progress = totalItems > 0 ? Math.round((itemsChecked / totalItems) * 100) : 0;
        const date = checklist.lastUpdated?.toDate().toLocaleString() ?? 'N/A';

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-xl font-bold text-slate-800 dark:text-slate-200">${checklist.orgName}</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Last updated: ${date}</p>
                </div>
                <div class="text-right">
                    <p class="text-lg font-semibold text-sky-600 dark:text-sky-400">${progress}%</p>
                    <p class="text-xs text-slate-400 dark:text-slate-500">${itemsChecked}/${totalItems} complete</p>
                </div>
            </div>
            <div class="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                <div class="bg-sky-500 dark:bg-sky-500 h-2.5 rounded-full" style="width: ${progress}%"></div>
            </div>
        `;
        ui.savedChecklistsContainer.appendChild(card);
    });
}

// --- Customization Logic (Add/Edit/Delete Categories & Items) ---

// Opens modal to add a new category.
function addCategory() {
    helpers.openEditModal(
        'Add New Category',
        'Enter new category name',
        '', // Initial value
        (newName) => { // onSave callback
            const newId = `custom_cat_${crypto.randomUUID()}`; // Generate unique ID
            currentChecklistData.categories.push({
                id: newId,
                name: newName,
                isCustom: true, // Mark as custom
                items: [] // Start with no items
            });
            handleSaveChecklist(true); // Save and re-render to show the new category
        },
        () => { /* Cancelled - no action needed */ },
        (val) => val.trim() !== '' // Validation: name cannot be empty
    );
}

// Opens modal to edit an existing category name.
function editCategoryName(categoryId, currentName) {
    helpers.openEditModal(
        'Edit Category Name',
        'Enter new category name',
        currentName, // Initial value is current name
        (newName) => { // onSave callback
            const category = currentChecklistData.categories.find(c => c.id === categoryId);
            if (category) {
                category.name = newName;
                handleSaveChecklist(true); // Save and re-render
            }
        },
        () => { /* Cancelled */ },
        (val) => val.trim() !== '' // Validation: name cannot be empty
    );
}

// Opens confirmation modal to delete a category.
async function deleteCategory(categoryId, categoryName) {
    helpers.openConfirmationModal(
        `Delete "${categoryName}" category?`,
        "This will permanently remove this category and all its items.",
        async () => { // onConfirm callback
            helpers.closeModal(ui.confirmationModal);
            // Find the category and delete its items' attachments first
            const categoryToDelete = currentChecklistData.categories.find(c => c.id === categoryId);
             if (categoryToDelete && categoryToDelete.items) {
                for (const item of categoryToDelete.items) {
                    if (item.attachments) {
                        for (const attachment of item.attachments) {
                            await deleteFileFromStorage(item.id, attachment.fileName);
                        }
                    }
                }
            }
            // Remove the category from the data
            currentChecklistData.categories = currentChecklistData.categories.filter(c => c.id !== categoryId);
            handleSaveChecklist(true); // Save and re-render
        }
    );
}

// Opens modal to add a new item to a category.
function addItem(categoryId) {
    helpers.openEditModal(
        'Add New Item',
        'Enter new checklist item description',
        '', // Initial value
        (newItemText) => { // onSave callback
            const category = currentChecklistData.categories.find(c => c.id === categoryId);
            if (category) {
                const newId = `custom_item_${crypto.randomUUID()}`; // Generate unique ID
                category.items.push({
                    id: newId,
                    text: newItemText,
                    isChecked: false,
                    notes: '',
                    isCustom: true, // Mark as custom
                    attachments: []
                });
                handleSaveChecklist(true); // Save and re-render
            }
        },
        () => { /* Cancelled */ },
        (val) => val.trim() !== '' // Validation: text cannot be empty
    );
}

// Opens modal to edit an existing item's text.
function editItemText(categoryId, itemId, currentText) {
     helpers.openEditModal(
        'Edit Item Text',
        'Enter new item description',
        currentText, // Initial value is current text
        (newText) => { // onSave callback
            const category = currentChecklistData.categories.find(c => c.id === categoryId);
            const item = category?.items.find(i => i.id === itemId);
            if (item) {
                item.text = newText;
                handleSaveChecklist(true); // Save and re-render
            }
        },
        () => { /* Cancelled */ },
        (val) => val.trim() !== '' // Validation: text cannot be empty
    );
}

// Opens confirmation modal to delete an item.
async function deleteItem(categoryId, itemId, itemText) {
    helpers.openConfirmationModal(
        `Delete "${itemText}" item?`,
        "This will permanently remove this checklist item and its attachments.",
        async () => { // onConfirm callback
            helpers.closeModal(ui.confirmationModal);
            const category = currentChecklistData.categories.find(c => c.id === categoryId);
            if (category) {
                const itemToDelete = category.items.find(item => item.id === itemId);
                if (itemToDelete && itemToDelete.attachments) {
                    // Delete all associated files from storage first
                    for (const attachment of itemToDelete.attachments) {
                        await deleteFileFromStorage(item.id, attachment.fileName);
                    }
                }
                // Remove the item from the data
                category.items = category.items.filter(i => i.id !== itemId);
                handleSaveChecklist(true); // Save and re-render
            }
        }
    );
}

// --- Attachment Logic ---

// Handles the file upload process for an attachment.
async function handleAttachmentUpload(file, categoryId, itemId, uploadStatusElement) {
    if (!file) return;

    helpers.showStatus(uploadStatusElement, `Uploading "${file.name}"...`, 'info', null); // Show status without timeout

    try {
        // Define Firebase Storage path
        // Path: /artifacts/{appId}/users/{userId}/attachments/{checklistId}/{itemId}/{fileName}
        const storageRef = ref(storage, `artifacts/${appId}/users/${userId}/attachments/${currentChecklistData.id}/${itemId}/${file.name}`);

        // Upload the file
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Find the item in the current checklist data
        const category = currentChecklistData.categories.find(c => c.id === categoryId);
        const item = category?.items.find(i => i.id === itemId);

        if (item) {
            if (!item.attachments) item.attachments = [];
            // Check for duplicates before adding
            if (!item.attachments.some(att => att.fileName === file.name)) {
                item.attachments.push({
                    fileName: file.name,
                    url: downloadURL,
                    type: file.type,
                    size: file.size,
                    uploadedAt: serverTimestamp() // Use server timestamp for consistency
                });
                // Update the UI for the specific item's attachments list
                const itemElement = ui.checklistItemsContainer.querySelector(`.checklist-item[data-item-id="${itemId}"]`);
                if (itemElement) {
                    const attachmentsList = itemElement.querySelector('.attachments-container ul');
                     // Clear and re-render the attachments list for this item
                    attachmentsList.innerHTML = '';
                    item.attachments.forEach(attachment => {
                        const attachmentLi = document.createElement('li');
                        attachmentLi.className = 'flex items-center justify-between text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 p-2 rounded-md';
                        attachmentLi.innerHTML = `
                            <a href="${attachment.url}" target="_blank" rel="noopener noreferrer" class="flex items-center space-x-2 text-sky-600 dark:text-sky-400 hover:underline">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
                                <span>${attachment.fileName}</span>
                            </a>
                            <button class="delete-attachment-btn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40" data-action="delete-attachment" data-file-name="${attachment.fileName}" data-file-url="${attachment.url}" data-item-id="${item.id}" data-category-id="${categoryId}" title="Delete attachment">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" /></svg>
                            </button>
                        `;
                        attachmentsList.appendChild(attachmentLi);
                    });
                }

                await handleSaveChecklist(false); // Save the updated checklist data with attachment metadata
                helpers.showStatus(uploadStatusElement, `"${file.name}" uploaded successfully!`, 'success');
            } else {
                helpers.showStatus(uploadStatusElement, `"${file.name}" already exists.`, 'info');
            }
        }
    } catch (error) {
        console.error("Error uploading attachment:", error);
        helpers.showStatus(uploadStatusElement, `Upload failed for "${file.name}".`, 'error');
    } finally {
        // The file input value is cleared by the browser after change event
        setTimeout(() => uploadStatusElement.classList.add('hidden'), 3000); // Hide status after 3 seconds
    }
}

// Deletes an attachment from Storage and updates the checklist data.
async function deleteAttachment(categoryId, itemId, fileName, fileUrl) {
    helpers.openConfirmationModal(
        `Delete "${fileName}"?`,
        "This will permanently remove the attachment from this item.",
        async () => { // onConfirm callback
            helpers.closeModal(ui.confirmationModal);
            helpers.showStatus(ui.statusMessage, `Deleting "${fileName}"...`, 'info', null);
            try {
                // Delete from Firebase Storage
                await deleteFileFromStorage(itemId, fileName);

                // Remove from Firestore data
                const category = currentChecklistData.categories.find(c => c.id === categoryId);
                const item = category?.items.find(i => i.id === itemId);
                if (item) {
                    item.attachments = (item.attachments || []).filter(att => att.fileName !== fileName);

                    // Update the UI for the specific item's attachments list
                    const itemElement = ui.checklistItemsContainer.querySelector(`.checklist-item[data-item-id="${itemId}"]`);
                    if (itemElement) {
                         const attachmentLiToRemove = itemElement.querySelector(`[data-file-name="${fileName}"]`)?.closest('li');
                         if(attachmentLiToRemove) attachmentLiToRemove.remove();
                    }

                    await handleSaveChecklist(false); // Save updated checklist
                    helpers.showStatus(ui.statusMessage, `Attachment "${fileName}" deleted.`, 'info', 3000);
                }
            } catch (error) {
                console.error("Error deleting attachment:", error);
                helpers.showStatus(ui.statusMessage, `Failed to delete attachment "${fileName}".`, 'error');
            }
        }
    );
}

// Deletes a specific file from Firebase Storage.
async function deleteFileFromStorage(itemId, fileName) {
     // Storage path: /artifacts/{appId}/users/{userId}/attachments/{checklistId}/{itemId}/{fileName}
    // Ensure currentChecklistData and its ID exist before attempting deletion
    if (!currentChecklistData?.id) {
        console.warn(`Cannot delete file ${fileName}: currentChecklistData or its ID is missing.`);
        return; // Cannot proceed without checklist ID
    }
    const fileRef = ref(storage, `artifacts/${appId}/users/${userId}/attachments/${currentChecklistData.id}/${itemId}/${fileName}`);
    try {
        await deleteObject(fileRef);
        console.log(`File ${fileName} deleted from storage.`);
    } catch (error) {
        // If the file doesn't exist in storage, it's not an error we need to stop for.
        // Otherwise, log the error and re-throw.
        if (error.code === 'storage/object-not-found') {
            console.warn(`File ${fileName} not found in storage, skipping deletion.`);
        } else {
            console.error(`Error deleting file ${fileName} from storage:`, error);
            throw error; // Re-throw to propagate the error
        }
    }
}

// --- Event Handlers & Firestore Logic ---

// Handles saving the current checklist data to Firestore.
// `reRender` flag indicates if the UI should be re-rendered after saving (e.g., after adding/deleting items/categories).
async function handleSaveChecklist(reRender = false) {
    if (!isAuthReady || !currentChecklistData) {
        // This might happen if save is triggered before data is loaded or after delete
        console.warn("Attempted to save checklist when auth not ready or no checklist data loaded.");
        return;
    }

    const orgName = ui.orgNameInput.value.trim();
    if (!orgName) {
        ui.orgNameError.classList.remove('hidden');
        ui.orgNameInput.focus();
        // Only show status if it's a user-initiated save, not an auto-save from input
        if (!reRender) { // Assuming reRender=false means triggered by input change
             helpers.showStatus(ui.statusMessage, "Organization name is required.", 'error');
        }
        return;
    }
    ui.orgNameError.classList.add('hidden');

    // Update currentChecklistData state from UI elements IF reRender is true
    // If reRender is false, the delegated event handlers should have already updated the data
    if (reRender) {
         currentChecklistData.orgName = orgName;
         // When re-rendering, we rebuild the data structure from the DOM state
         // This is less efficient but necessary after structural changes (add/delete)
         const updatedCategories = [];
         ui.checklistItemsContainer.querySelectorAll('.category-block').forEach(categoryEl => {
             const categoryId = categoryEl.dataset.categoryId;
             const categoryName = categoryEl.querySelector('.category-title').textContent; // Get name from DOM
             const isCustom = currentChecklistData.categories.find(c => c.id === categoryId)?.isCustom ?? false; // Preserve isCustom
             const updatedItems = [];
             categoryEl.querySelectorAll('.checklist-item').forEach(itemEl => {
                 const itemId = itemEl.dataset.itemId;
                 const isChecked = itemEl.querySelector('input[type="checkbox"]').checked;
                 const notes = itemEl.querySelector('textarea').value.trim();
                 const itemText = itemEl.querySelector('.item-text').textContent; // Get text from DOM
                 // Find original item to preserve link, linkText, isCustom, and attachments
                 const originalItem = currentChecklistData.categories.find(c => c.id === categoryId)?.items.find(i => i.id === itemId);

                 updatedItems.push({
                     id: itemId,
                     text: itemText, // Use text from DOM after edit
                     isChecked: isChecked,
                     notes: notes,
                     link: originalItem?.link,
                     linkText: originalItem?.linkText,
                     isCustom: originalItem?.isCustom ?? false,
                     attachments: originalItem?.attachments ?? [] // Attachments are updated separately
                 });
             });
             updatedCategories.push({
                 id: categoryId,
                 name: categoryName, // Use name from DOM after edit
                 isCustom: isCustom,
                 items: updatedItems
             });
         });
         currentChecklistData.categories = updatedCategories;
    } else {
        // If not re-rendering, the data state should already be updated by the event handlers
        // We just need to ensure the orgName is captured from the input
        currentChecklistData.orgName = orgName;
    }

    currentChecklistData.lastUpdated = serverTimestamp(); // Update timestamp on save

    ui.saveChecklistBtn.disabled = true; // Disable save button during saving
    if (!reRender) { // Only show "Saving..." status if not re-rendering immediately
        helpers.showStatus(ui.statusMessage, "Saving...", 'info', null);
    }

    try {
        let currentId = currentChecklistData?.id;
        if (currentId) {
            // Update existing document
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/checklists`, currentId);
            // Use setDoc without merge if structural changes occurred (reRender=true)
            // Use updateDoc (which is like setDoc with merge) for simple data changes (reRender=false)
             if (reRender) {
                 await setDoc(doc(db, `artifacts/${appId}/users/${userId}/checklists`, currentId), currentChecklistData);
             } else {
                 // For simple data changes (checkbox, notes, orgName), updateDoc is sufficient
                 await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/checklists`, currentId), {
                     orgName: currentChecklistData.orgName,
                     categories: currentChecklistData.categories, // Send the whole updated array
                     lastUpdated: currentChecklistData.lastUpdated
                 });
             }

        } else {
            // Add a new document
            const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/checklists`);
            const newDocRef = await addDoc(collectionRef, currentChecklistData);
            currentId = newDocRef.id;
            currentChecklistData.id = currentId; // Update the state with the new document ID
        }

        // Fetch the saved doc to ensure all server-stamped fields (like lastUpdated) are accurate
        const savedDocSnap = await getDoc(doc(db, `artifacts/${appId}/users/${userId}/checklists`, currentId));
        currentChecklistData = {id: savedDocSnap.id, ...savedDocSnap.data()};

        if (reRender) {
            // Re-render the form if structural changes occurred
            renderChecklistForm(currentChecklistData.id);
        } else {
            helpers.showStatus(ui.statusMessage, "Checklist saved successfully!", 'success');
        }

        // Update UI elements that depend on the checklist being saved (having an ID)
        ui.checklistTitle.textContent = orgName;
        ui.deleteChecklistBtn.classList.remove('hidden');
        ui.shareChecklistBtn.classList.remove('hidden');

    } catch (error) {
        console.error("Error saving checklist: ", error);
        helpers.showStatus(ui.statusMessage, "Error saving checklist.", 'error');
    } finally {
        ui.saveChecklistBtn.disabled = false; // Re-enable save button
    }
}

// Handles deleting the current checklist.
async function handleDeleteChecklist() {
    // Ensure there's a checklist loaded and auth is ready
    if (!currentChecklistData?.id || !isAuthReady) return;

    // Open confirmation modal before deleting
    helpers.openConfirmationModal(
        `Delete "${currentChecklistData.orgName || 'this checklist'}"?`,
        "This action is permanent and cannot be recovered. All associated attachments will also be deleted.",
        async () => { // onConfirm callback
            helpers.closeModal(ui.confirmationModal);
            helpers.showStatus(ui.statusMessage, "Deleting...", 'info', null);
            try {
                // Collect all item IDs to delete attachments
                const allItems = currentChecklistData.categories.flatMap(cat => cat.items);
                for (const item of allItems) {
                    if (item.attachments) {
                        for (const attachment of item.attachments) {
                            // Delete each attachment file from storage
                            await deleteFileFromStorage(item.id, attachment.fileName);
                        }
                    }
                }

                // Delete the checklist document from Firestore
                await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/checklists`, currentChecklistData.id));

                currentChecklistData = null; // Clear current state
                helpers.showView('list'); // Return to list view
                helpers.showStatus(ui.statusMessage, "Checklist and all attachments deleted.", 'info', 3000);
            } catch (error) {
                console.error("Error deleting checklist and/or attachments: ", error);
                helpers.showStatus(ui.statusMessage, "Failed to delete checklist and/or some attachments.", 'error');
            }
        }
    );
}

// Handles generating and displaying a share ID for the current checklist.
async function handleShareChecklist() {
    if (!currentChecklistData?.id) return; // Can only share saved checklists
    helpers.showStatus(ui.statusMessage, 'Generating Share ID...', 'info', null);

    try {
        let shareId = currentChecklistData.shareId;
        if (!shareId) {
            // If no share ID exists, create a new shared document
            // This shared document contains only the structure and default info, not user progress/notes/attachments
            const sharedDocData = {
                ownerId: userId, // Store owner ID for potential future features
                orgName: currentChecklistData.orgName,
                categories: currentChecklistData.categories.map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    isCustom: cat.isCustom,
                    items: cat.items.map(item => ({
                        id: item.id,
                        text: item.text,
                        link: item.link,
                        linkText: item.linkText,
                        isCustom: item.isCustom
                        // isChecked, notes, and attachments are intentionally excluded from shared data
                    }))
                }))
            };
            // Add the shared data to a public collection
            const sharedDocRef = await addDoc(collection(db, `artifacts/${appId}/public/data/sharedChecklists`), sharedDocData);
            shareId = sharedDocRef.id;

            // Store the share ID back in the original checklist document
            const originalDocRef = doc(db, `artifacts/${appId}/users/${userId}/checklists`, currentChecklistData.id);
            await updateDoc(originalDocRef, { shareId: shareId });
            currentChecklistData.shareId = shareId; // Update local state
        }

        // Display the share ID and open the share modal
        ui.shareIdDisplay.textContent = shareId;
        helpers.showStatus(ui.statusMessage, 'Share ID is ready!', 'success');
        helpers.openModal(ui.shareModal);

    } catch (error) {
        console.error("Error creating share link:", error);
        helpers.showStatus(ui.statusMessage, 'Could not create Share ID.', 'error');
    }
}

// Handles confirming the import of a checklist using a share ID.
async function handleImportConfirm() {
    const shareId = ui.importIdInput.value.trim();
    if (!shareId) {
        return helpers.showStatus(ui.importStatusMessage, 'Please enter a Share ID.', 'error');
    }

    ui.importModalConfirmBtn.disabled = true; // Disable button during import
    helpers.showStatus(ui.importStatusMessage, 'Importing...', 'info', null);

    try {
        // Fetch the shared checklist data from the public collection
        const docRef = doc(db, `artifacts/${appId}/public/data/sharedChecklists`, shareId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Map the imported data to the user's checklist structure
            const importedCategories = data.categories.map(cat => ({
                id: cat.id,
                name: cat.name,
                isCustom: cat.isCustom,
                items: cat.items.map(item => ({
                    id: item.id,
                    text: item.text,
                    link: item.link,
                    linkText: item.linkText,
                    isCustom: item.isCustom,
                    isChecked: false, // Imported items start unchecked
                    notes: '', // Imported items start with no notes
                    attachments: [] // Imported items start with no attachments
                }))
            }));

            // Create a new checklist document for the current user
            const newChecklist = {
                orgName: `[Imported] ${data.orgName}`, // Prefix name to indicate it's imported
                categories: importedCategories,
                lastUpdated: serverTimestamp()
            };
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/checklists`), newChecklist);

            helpers.showStatus(ui.importStatusMessage, 'Import successful!', 'success');
            ui.importIdInput.value = ''; // Clear input
            setTimeout(() => helpers.closeModal(ui.importModal), 1500); // Close modal after a delay
        } else {
            helpers.showStatus(ui.importStatusMessage, 'Invalid Share ID. Checklist not found.', 'error');
        }
    } catch (error) {
        console.error("Error importing checklist:", error);
        helpers.showStatus(ui.importStatusMessage, 'An error occurred during import.', 'error');
    } finally {
        ui.importModalConfirmBtn.disabled = false; // Re-enable button
    }
}

// Fallback function for copying text to clipboard using an invisible textarea.
function fallbackCopyTextToClipboard(text, statusElement, successMsg) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Avoid scrolling to bottom
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        helpers.showStatus(statusElement, successful ? successMsg : 'Copy failed.', successful ? 'success' : 'error');
    } catch (err) {
        helpers.showStatus(statusElement, 'Copy failed.', 'error');
    }
    document.body.removeChild(textArea);
}

// Copies text to the clipboard using the modern Clipboard API or a fallback.
function copyToClipboard(text, statusElement, successMsg) {
     if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            helpers.showStatus(statusElement, successMsg, 'success');
        }).catch(err => {
            console.warn('Clipboard API failed, falling back.', err);
            fallbackCopyTextToClipboard(text, statusElement, successMsg);
        });
    } else {
        console.warn('Not in a secure context or Clipboard API not available, falling back.');
        fallbackCopyTextToClipboard(text, statusElement, successMsg);
    }
}

// Copies the checklist content as plain text to the clipboard.
function handleCopyChecklistText() {
    const orgName = ui.orgNameInput.value.trim();
    if (!orgName) {
        return helpers.showStatus(ui.statusMessage, "Please enter an organization name before copying.", 'error');
    }
    if (!currentChecklistData) {
         return helpers.showStatus(ui.statusMessage, "No checklist data to copy.", 'info');
    }

    let textToCopy = `Compliance Checklist for: ${orgName}\n========================================\n\n`;

    // Format categories and items for plain text copy
    currentChecklistData.categories.forEach(category => {
        textToCopy += `CATEGORY: ${category.name.toUpperCase()}\n----------------------------------------\n`;
        category.items.forEach(item => {
            const status = item.isChecked ? "[X]" : "[ ]";
            textToCopy += `${status} ${item.text}\n`;
            if (item.notes?.trim()) textToCopy += `    Notes: ${item.notes.trim()}\n`;
            if (item.link) textToCopy += `    Resource: ${item.link}\n`;
            if (item.attachments && item.attachments.length > 0) {
                textToCopy += `    Attachments:\n`;
                item.attachments.forEach(att => {
                    textToCopy += `        - ${att.fileName}: ${att.url}\n`;
                });
            }
            textToCopy += "\n"; // Add a blank line after each item
        });
        textToCopy += "\n"; // Add a blank line after each category
    });
    copyToClipboard(textToCopy, ui.statusMessage, 'Checklist text copied!');
}

// Sets up the real-time listener for the user's checklists in Firestore.
function listenForChecklists() {
    // Unsubscribe from previous listener if it exists
    if (checklistUnsubscribe) {
        checklistUnsubscribe();
    }
    // Create a query for the user's checklists
    const q = query(collection(db, `artifacts/${appId}/users/${userId}/checklists`));

    // Set up the real-time listener
    checklistUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allChecklistsFromFirestore = []; // Clear previous data
        querySnapshot.forEach((doc) => {
            // Add each checklist document to the cache
            allChecklistsFromFirestore.push({ id: doc.id, ...doc.data() });
        });
        filterAndRenderListView(); // Re-render the list view with the updated data
    }, (error) => {
        console.error("Error listening for checklist updates: ", error);
        // Optionally show a user-facing error message
    });
}

// --- Delegated Event Handlers for Checklist Container ---

// Handles click events within the checklist items container
function handleChecklistContainerClick(event) {
    // Find the closest element with a data-action attribute
    const targetElement = event.target.closest('[data-action]');
    if (!targetElement) return; // Not an action element

    const action = targetElement.dataset.action;
    const categoryId = targetElement.dataset.categoryId;
    const itemId = targetElement.dataset.itemId;

    // Find the category and item in the current data state
    const category = currentChecklistData?.categories.find(c => c.id === categoryId);
    const item = category?.items.find(i => i.id === itemId);

    switch (action) {
        case 'edit-category':
            if (category) editCategoryName(categoryId, category.name);
            break;
        case 'delete-category':
            if (category) deleteCategory(categoryId, category.name);
            break;
        case 'add-item':
            if (category) addItem(categoryId);
            break;
        case 'edit-item':
            if (item) editItemText(categoryId, itemId, item.text);
            break;
        case 'delete-item':
            if (item) deleteItem(categoryId, itemId, item.text);
            break;
        case 'add-attachment':
             // Find the hidden file input associated with this button
            const fileInput = targetElement.closest('.file-input-wrapper')?.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.click(); // Trigger the file input click
            }
            break;
        case 'delete-attachment':
            const fileName = targetElement.dataset.fileName;
            const fileUrl = targetElement.dataset.fileUrl;
            if (item && fileName && fileUrl) {
                deleteAttachment(categoryId, itemId, fileName, fileUrl);
            }
            break;
        // Checkbox toggle handled by 'change' event
        // Notes update handled by 'input' event
    }
}

// Handles input events within the checklist items container (e.g., textarea input)
function handleChecklistContainerInput(event) {
    const targetElement = event.target;
    if (targetElement.tagName === 'TEXTAREA' && targetElement.dataset.action === 'update-notes') {
        const categoryId = targetElement.dataset.categoryId;
        const itemId = targetElement.dataset.itemId;
        const category = currentChecklistData?.categories.find(c => c.id === categoryId);
        const item = category?.items.find(i => i.id === itemId);
        if (item) {
            item.notes = targetElement.value.trim();
            handleSaveChecklist(false); // Save without re-rendering
        }
    }
}

// Handles change events within the checklist items container (e.g., checkbox change, file input change)
function handleChecklistContainerChange(event) {
    const targetElement = event.target;

    // Handle Checkbox Change
    if (targetElement.type === 'checkbox' && targetElement.dataset.action === 'toggle-checked') {
        const categoryId = targetElement.dataset.categoryId;
        const itemId = targetElement.dataset.itemId;
        const category = currentChecklistData?.categories.find(c => c.id === categoryId);
        const item = category?.items.find(i => i.id === itemId);
        if (item) {
            item.isChecked = targetElement.checked;
            handleSaveChecklist(false); // Save without re-rendering
        }
    }

    // Handle File Input Change (Attachment Upload)
    if (targetElement.type === 'file' && targetElement.files.length > 0) {
        const categoryId = targetElement.dataset.categoryId;
        const itemId = targetElement.dataset.itemId;
        const file = targetElement.files[0];
        const uploadStatusElement = targetElement.nextElementSibling?.nextElementSibling; // Find the status div
         if (file && categoryId && itemId && uploadStatusElement) {
             handleAttachmentUpload(file, categoryId, itemId, uploadStatusElement);
         }
         // Clear the file input value so the same file can be selected again
         targetElement.value = '';
    }
}


// --- App Initialization ---

// Initializes the application, including Firebase and event listeners.
async function initApp() {
    cacheDOMElements(); // Cache DOM elements on startup

    // Set initial theme based on local storage or system preference
    // --- FIX: Check if darkModeToggle exists before setting theme ---
    if(ui.darkModeToggle) {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        helpers.applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

        // Dark mode toggle listener
        ui.darkModeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('dark');
            helpers.applyTheme(isDark ? 'light' : 'dark');
        });
    }
    // --- END FIX ---

    console.log(`Initializing Firebase Checklist App (App ID: ${appId})...`);
    try {
        // Attempt to use config from environment variable first, fallback to hardcoded
        const configFromEnv = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
        const finalConfig = (configFromEnv && configFromEnv.apiKey)
            ? configFromEnv
            : firebaseConfig;

        if (!finalConfig || !finalConfig.apiKey) {
            throw new Error("Firebase configuration is missing. Please provide apiKey.");
        }

        // Initialize Firebase services
        const app = initializeApp(finalConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        if (ui.authStatus) ui.authStatus.textContent = "Error: " + error.message;
        if (ui.userInfo) ui.userInfo.classList.remove('hidden'); // Show error status
        return; // Stop initialization if Firebase fails
    }

    // Listen for authentication state changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            isAuthReady = true;
            userId = user.uid;
            ui.authStatus.textContent = "Authenticated";
            ui.userIdDisplay.textContent = userId;
            ui.userInfo.classList.remove('hidden');
            ui.newChecklistBtn.disabled = false;
            ui.importChecklistBtn.disabled = false;
            listenForChecklists(); // Start listening for user's checklists
            helpers.showView('list'); // Show the list view
        } else {
            // User is signed out
            isAuthReady = false;
            userId = null;
            ui.authStatus.textContent = "Not Authenticated";
            ui.userIdDisplay.textContent = "";
            ui.userInfo.classList.remove('hidden');
            ui.newChecklistBtn.disabled = true;
            ui.importChecklistBtn.disabled = true;
            if (checklistUnsubscribe) checklistUnsubscribe(); // Stop listening if user signs out
            allChecklistsFromFirestore = []; // Clear cached data
            renderListView([]); // Render an empty list
        }
    });

    // Attempt to sign in anonymously or with a custom token if provided
    try {
        const tokenFromEnv = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (tokenFromEnv) {
            await signInWithCustomToken(auth, tokenFromEnv);
        } else {
            await signInAnonymously(auth);
        }
    } catch (error) {
         console.error("Authentication failed: ", error);
         ui.authStatus.textContent = `Authentication Failed: ${error.message}`;
         ui.userInfo.classList.remove('hidden');
    }

    // --- Global Event Listeners ---
    ui.newChecklistBtn.addEventListener('click', () => { if(isAuthReady) renderChecklistForm(); });
    ui.backToListBtn.addEventListener('click', () => { helpers.showView('list'); filterAndRenderListView(); });
    ui.saveChecklistBtn.addEventListener('click', () => handleSaveChecklist(false)); // Don't re-render on simple save
    ui.deleteChecklistBtn.addEventListener('click', handleDeleteChecklist);
    ui.printChecklistBtn.addEventListener('click', () => {
        // Update print header before printing
        if (ui.orgNameInputPrintHeader) {
            ui.orgNameInputPrintHeader.textContent = ui.orgNameInput.value.trim() || "Untitled Checklist";
        }
        window.print();
    });
    ui.copyChecklistBtn.addEventListener('click', handleCopyChecklistText);
    ui.shareChecklistBtn.addEventListener('click', handleShareChecklist);
    ui.importChecklistBtn.addEventListener('click', () => {
        if(isAuthReady) {
            ui.importIdInput.value = ''; // Clear previous input
            ui.importStatusMessage.textContent = ''; // Clear previous status
            helpers.openModal(ui.importModal);
        }
    });
    ui.searchInput.addEventListener('input', filterAndRenderListView); // Filter list on search input
    ui.orgNameInput.addEventListener('input', () => {
        // Update checklist title as organization name is typed
        ui.checklistTitle.textContent = ui.orgNameInput.value.trim() || "New Checklist";
        // Also trigger a save for org name changes
        handleSaveChecklist(false);
    });

    // Listener for the "Add New Category" button
    ui.addCategoryBtn.addEventListener('click', addCategory);

    // External Tool Modal Buttons - Open the respective modals using the helper
    ui.openEinModalBtn.addEventListener('click', () => helpers.openExternalLinkModal(ui.einLookupModal, 'Open IRS Search Tool', 'The official IRS tool will be opened in a new browser tab.', 'https://apps.irs.gov/app/eos/', 'Continue to IRS.gov'));
    ui.openPropublicaModalBtn.addEventListener('click', () => helpers.openExternalLinkModal(ui.propublicaLookupModal, 'Open ProPublica Nonprofit Explorer', 'The ProPublica Nonprofit Explorer website will be opened in a new browser tab.', 'https://projects.propublica.org/nonprofits/', 'Continue to ProPublica'));
    ui.openBbbModalBtn.addEventListener('click', () => helpers.openExternalLinkModal(ui.bbbScamModal, 'Open BBB Scam Tracker', "The Better Business Bureau's website will be opened in a new browser tab.", 'https://www.bbb.org/scamtracker/lookupscam', 'Continue to BBB.org'));
    ui.openNascoModalBtn.addEventListener('click', () => helpers.openExternalLinkModal(ui.nascoRegModal, 'Open State Regulator List', 'The NASCO website will be opened in a new browser tab.', 'https://www.nasconet.org/resources/state-government/', 'Continue to NASCOnet.org'));
    ui.openAphisModalBtn.addEventListener('click', () => helpers.openExternalLinkModal(ui.aphisLookupModal, 'Open APHIS Search Tool', 'The USDA APHIS search tool will be opened in a new browser tab.', 'https://aphis.my.site.com/PublicSearchTool/s/', 'Continue to APHIS'));
    ui.openCharityNavModalBtn.addEventListener('click', () => helpers.openExternalLinkModal(ui.charityNavLookupModal, 'Open Charity Navigator', 'The Charity Navigator website will be opened in a new browser tab.', 'https://www.charitynavigator.org/', 'Continue to Charity Navigator'));
    ui.openCharityWatchModalBtn.addEventListener('click', () => helpers.openExternalLinkModal(ui.charityWatchLookupModal, 'Open CharityWatch', 'The CharityWatch website will be opened in a new browser tab.', 'https://www.charitywatch.org/', 'Continue to CharityWatch.org'));

    // Confirmation Modal Button Listener
    ui.modalConfirmBtn.addEventListener('click', () => confirmAction?.()); // Execute the stored action

    // Generic Modal Close Listeners for buttons
    // Add listeners to all buttons that should just close their parent modal
    document.querySelectorAll('.modal button[data-dismiss="modal"], .modal button:not(#modal-confirm-btn):not(#edit-modal-save-btn):not(#import-modal-confirm-btn)').forEach(btn => {
         // Exclude specific action buttons within modals
         if (btn && !['modal-confirm-btn', 'edit-modal-save-btn', 'import-modal-confirm-btn'].includes(btn.id)) {
             const handler = () => helpers.closeModal(btn.closest('.modal'));
             btn.addEventListener('click', handler);
         }
    });


    // Share Modal Copy Button
    ui.shareModalCopyBtn.addEventListener('click', () => copyToClipboard(ui.shareIdDisplay.textContent, ui.shareIdDisplay, 'ID Copied!'));

    // Import Modal Confirm Button
    ui.importModalConfirmBtn.addEventListener('click', handleImportConfirm);

    // External Link Modal Confirm Buttons (they are links, clicking them opens the link and should close the modal)
    document.querySelectorAll('.modal a[target="_blank"]').forEach(link => {
         if (link) { // Check if element exists
             const handler = () => helpers.closeModal(link.closest('.modal'));
             link.addEventListener('click', handler);
         }
    });

    // Generic click listener to close modals when clicking outside the content
    window.addEventListener('click', (event) => {
        // Check if the click target is a modal backdrop (the modal div itself)
        if (event.target.classList.contains('modal')) {
            helpers.closeModal(event.target);
        }
    });

    // --- Delegated Listeners for Checklist Container ---
    // These handle interactions within the checklist form itself
    ui.checklistItemsContainer.addEventListener('click', handleChecklistContainerClick);
    ui.checklistItemsContainer.addEventListener('input', handleChecklistContainerInput);
    ui.checklistItemsContainer.addEventListener('change', handleChecklistContainerChange);
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);
