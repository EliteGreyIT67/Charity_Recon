// Import Firebase modules and the configuration from config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, deleteObject, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { firebaseConfig } from './config.js';

// --- App State & Firebase References ---
let db, auth, storage;
let currentChecklistData = null;
let checklistUnsubscribe = null;
let userId = null;
let isAuthReady = false;
let allChecklistsFromFirestore = [];
const ui = {};
let confirmAction = null;
let saveTimeout = null; // For debouncing save actions

// --- App Configuration ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-animal-rescue-app';

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

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    cacheDOMElements();
    setupTheme();

    try {
        if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_")) {
            throw new Error("Firebase configuration is missing or incomplete. Please update 'tools/animal_checklist_app/config.js' with your project credentials.");
        }
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);
        await setupAuthListener();
    } catch (error) {
        console.error("Initialization failed:", error);
        const errorHtml = `<div class="p-4 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg">
            <h3 class="font-bold">Application Error</h3><p class="text-sm mt-1">${error.message}</p></div>`;
        ui.appContainer.innerHTML = errorHtml;
        return;
    }

    attachEventListeners();
}

function setupTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    helpers.applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    ui.darkModeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        helpers.applyTheme(isDark ? 'light' : 'dark');
    });
}

async function setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            isAuthReady = true;
            userId = user.uid;
            ui.authStatus.textContent = "Authenticated";
            ui.userIdDisplay.textContent = userId;
            ui.userInfo.classList.remove('hidden');
            ui.newChecklistBtn.disabled = false;
            ui.importChecklistBtn.disabled = false;
            listenForChecklists();
            helpers.showView('list');
        } else {
            isAuthReady = false;
            userId = null;
            ui.authStatus.textContent = "Not Authenticated";
            ui.userIdDisplay.textContent = "";
            ui.userInfo.classList.remove('hidden');
            ui.newChecklistBtn.disabled = true;
            ui.importChecklistBtn.disabled = true;
            if (checklistUnsubscribe) checklistUnsubscribe();
            allChecklistsFromFirestore = [];
            renderListView([]);
        }
    });

    try {
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Anonymous authentication failed: ", error);
        ui.authStatus.textContent = `Auth Failed: ${error.message}`;
    }
}

function cacheDOMElements() {
    const ids = [
        'app-container', 'list-view', 'checklist-view', 'new-checklist-btn', 'import-checklist-btn', 'back-to-list-btn', 
        'save-checklist-btn', 'delete-checklist-btn', 'share-checklist-btn', 'print-checklist-btn', 'copy-checklist-btn', 
        'add-category-btn', 'dark-mode-toggle', 'sun-icon', 'moon-icon', 'org-name-input', 'org-name-input-print-header', 
        'org-name-error', 'checklist-items-container', 'checklist-title', 'saved-checklists-container', 'search-input', 
        'no-checklists-message', 'status-message', 'user-info', 'auth-status', 'user-id', 'confirmation-modal', 
        'modal-title', 'modal-message', 'modal-confirm-btn', 'modal-cancel-btn', 'share-modal', 'share-id-display', 
        'share-modal-copy-btn', 'share-modal-close-btn', 'import-modal', 'import-id-input', 'import-status-message', 
        'import-modal-confirm-btn', 'import-modal-cancel-btn', 'edit-modal', 'edit-modal-title', 'edit-modal-input', 
        'edit-modal-error', 'edit-modal-cancel-btn', 'edit-modal-save-btn', 'save-button-text', 'save-spinner'
    ];
    ids.forEach(id => { ui[id] = document.getElementById(id); });
}

function attachEventListeners() {
    // Main actions
    ui['new-checklist-btn'].addEventListener('click', () => { if(isAuthReady) renderChecklistForm(); });
    ui['back-to-list-btn'].addEventListener('click', () => { helpers.showView('list'); filterAndRenderListView(); });
    ui['save-checklist-btn'].addEventListener('click', () => handleSaveChecklist(true)); // Force immediate save
    ui['delete-checklist-btn'].addEventListener('click', handleDeleteChecklist);
    ui['print-checklist-btn'].addEventListener('click', () => {
        ui['org-name-input-print-header'].textContent = ui['org-name-input'].value.trim() || "Untitled Checklist";
        window.print();
    });
    ui['copy-checklist-btn'].addEventListener('click', handleCopyChecklistText);
    ui['share-checklist-btn'].addEventListener('click', handleShareChecklist);
    ui['import-checklist-btn'].addEventListener('click', () => {
        if(isAuthReady) {
            ui['import-id-input'].value = '';
            ui['import-status-message'].textContent = '';
            helpers.openModal(ui['import-modal']);
        }
    });

    // Form inputs
    ui['search-input'].addEventListener('input', filterAndRenderListView);
    ui['org-name-input'].addEventListener('input', () => {
        ui['checklist-title'].textContent = ui['org-name-input'].value.trim() || "New Checklist";
        handleSaveChecklist(); // Debounced save
    });
    ui['add-category-btn'].addEventListener('click', addCategory);

    // Delegated listeners
    ui['checklist-items-container'].addEventListener('click', handleChecklistContainerClick);
    ui['checklist-items-container'].addEventListener('input', handleChecklistContainerInput);
    ui['checklist-items-container'].addEventListener('change', handleChecklistContainerChange);

    // Modal-specific listeners
    ui['modal-confirm-btn'].addEventListener('click', () => confirmAction?.());
    ui['share-modal-copy-btn'].addEventListener('click', () => copyToClipboard(ui['share-id-display'].textContent, ui['share-id-display'], 'ID Copied!'));
    ui['import-modal-confirm-btn'].addEventListener('click', handleImportConfirm);

    // Generic Modal Close Listeners
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => { if (event.target === modal) helpers.closeModal(modal); });
        modal.querySelectorAll('.modal-cancel-btn, .modal-close-btn, [data-dismiss="modal"]').forEach(btn => {
            btn.addEventListener('click', () => helpers.closeModal(modal));
        });
    });
}

// --- Helper Functions ---
const helpers = {
    showView: (viewToShow) => {
        ui.listView.classList.toggle('hidden', viewToShow !== 'list');
        ui.checklistView.classList.toggle('hidden', viewToShow !== 'checklist');
        window.scrollTo(0, 0);
    },
    showStatus: (element, message, type = 'success', duration = 3000) => {
        if (!element) return;
        const colors = { success: 'text-green-600', info: 'text-sky-600', error: 'text-red-600' };
        const darkColors = { success: 'dark:text-green-400', info: 'dark:text-sky-400', error: 'dark:text-red-400' };
        element.textContent = message;
        element.className = `mt-4 text-center font-medium ${colors[type] || colors.info} ${darkColors[type] || darkColors.info}`;
        if (duration !== null) {
            setTimeout(() => { element.textContent = ''; }, duration);
        }
    },
    openModal: (modalElement) => { if (modalElement) modalElement.style.display = 'block'; },
    closeModal: (modalElement) => { if (modalElement) modalElement.style.display = 'none'; },
    openConfirmationModal: (title, message, onConfirm) => {
        ui['modal-title'].textContent = title;
        ui['modal-message'].textContent = message;
        confirmAction = onConfirm;
        helpers.openModal(ui['confirmation-modal']);
    },
    _editModalSaveHandler: null,
    _editModalCancelHandler: null,
    openEditModal: (title, placeholder, currentValue, onSave, onCancel, validationFn = (val) => val.trim() !== '') => {
        ui['edit-modal-title'].textContent = title;
        ui['edit-modal-input'].placeholder = placeholder;
        ui['edit-modal-input'].value = currentValue;
        ui['edit-modal-error'].classList.add('hidden');

        if (helpers._editModalSaveHandler) ui['edit-modal-save-btn'].removeEventListener('click', helpers._editModalSaveHandler);
        if (helpers._editModalCancelHandler) ui['edit-modal-cancel-btn'].removeEventListener('click', helpers._editModalCancelHandler);

        helpers._editModalSaveHandler = () => {
            const newValue = ui['edit-modal-input'].value.trim();
            if (validationFn(newValue)) {
                onSave(newValue);
                helpers.closeModal(ui['edit-modal']);
            } else {
                ui['edit-modal-error'].textContent = "Input cannot be empty.";
                ui['edit-modal-error'].classList.remove('hidden');
            }
        };
        helpers._editModalCancelHandler = () => {
            if (onCancel) onCancel();
            helpers.closeModal(ui['edit-modal']);
        };

        ui['edit-modal-save-btn'].addEventListener('click', helpers._editModalSaveHandler);
        ui['edit-modal-cancel-btn'].addEventListener('click', helpers._editModalCancelHandler);
        helpers.openModal(ui['edit-modal']);
    },
    applyTheme: (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            if (ui['sun-icon']) ui['sun-icon'].classList.add('hidden');
            if (ui['moon-icon']) ui['moon-icon'].classList.remove('hidden');
            localStorage.theme = 'dark';
        } else {
            document.documentElement.classList.remove('dark');
            if (ui['sun-icon']) ui['sun-icon'].classList.remove('hidden');
            if (ui['moon-icon']) ui['moon-icon'].classList.add('hidden');
            localStorage.theme = 'light';
        }
    },
    setSaveButtonState: (isSaving) => {
        if (isSaving) {
            ui['save-button-text'].textContent = 'Saving...';
            ui['save-spinner'].classList.remove('hidden');
            ui['save-checklist-btn'].disabled = true;
        } else {
            ui['save-button-text'].textContent = 'Save';
            ui['save-spinner'].classList.add('hidden');
            ui['save-checklist-btn'].disabled = false;
        }
    }
};

// --- Rendering Logic ---

async function renderChecklistForm(checklistId = null) {
    currentChecklistData = null;
    if (checklistId) {
        try {
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/checklists`, checklistId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                currentChecklistData = { id: docSnap.id, ...docSnap.data() };
            } else {
                throw new Error("Checklist not found!");
            }
        } catch (error) {
            console.error(error);
            helpers.showStatus(ui['status-message'], "Could not find the selected checklist.", 'error');
            helpers.showView('list');
            return;
        }
    } else {
        currentChecklistData = {
            id: null,
            orgName: '',
            categories: JSON.parse(JSON.stringify(checklistMasterTemplate)),
            lastUpdated: null
        };
    }

    ui['checklist-items-container'].innerHTML = '';
    ui['org-name-input'].value = currentChecklistData?.orgName || '';
    ui['org-name-input-print-header'].textContent = currentChecklistData?.orgName || "New Checklist";
    ui['checklist-title'].textContent = currentChecklistData?.orgName || 'New Checklist';
    ui['delete-checklist-btn'].classList.toggle('hidden', !checklistId);
    ui['share-checklist-btn'].classList.toggle('hidden', !checklistId);
    ui['org-name-error'].classList.add('hidden');

    currentChecklistData.categories.forEach(category => {
        ui['checklist-items-container'].appendChild(createCategoryElement(category));
    });

    helpers.showView('checklist');
}

function createCategoryElement(category) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category-block bg-slate-50/50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-700/80 expanded';
    categoryDiv.dataset.categoryId = category.id;

    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'flex justify-between items-center p-4 cursor-pointer';
    categoryHeader.dataset.action = 'toggle-category';

    const titleAndIcon = document.createElement('div');
    titleAndIcon.className = 'flex items-center space-x-3';

    const toggleIcon = document.createElement('div');
    toggleIcon.className = 'category-toggle-icon text-slate-500';
    toggleIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>`;
    titleAndIcon.appendChild(toggleIcon);

    const categoryTitleElement = document.createElement('h3');
    categoryTitleElement.className = 'category-title text-xl font-semibold text-slate-700 dark:text-slate-300';
    categoryTitleElement.textContent = category.name;
    titleAndIcon.appendChild(categoryTitleElement);
    
    categoryHeader.appendChild(titleAndIcon);

    const categoryActions = document.createElement('div');
    categoryActions.className = 'flex space-x-2';
    // ... (add edit/delete buttons here as before)
    categoryHeader.appendChild(categoryActions);
    
    categoryDiv.appendChild(categoryHeader);

    const categoryContent = document.createElement('div');
    categoryContent.className = 'category-content px-4 pb-4';
    
    const itemsWrapper = document.createElement('div');
    itemsWrapper.className = 'space-y-5 border-t border-slate-200 dark:border-slate-700 pt-4';

    category.items.forEach(item => {
        itemsWrapper.appendChild(createItemElement(item, category.id));
    });

    const addItemBtn = document.createElement('button');
    // ... (add item button setup as before)
    itemsWrapper.appendChild(addItemBtn);

    categoryContent.appendChild(itemsWrapper);
    categoryDiv.appendChild(categoryContent);
    
    return categoryDiv;
}

function createItemElement(item, categoryId) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'checklist-item border-b border-slate-100 dark:border-slate-700 pb-4 last:border-b-0';
    itemDiv.dataset.itemId = item.id;
    itemDiv.dataset.categoryId = categoryId;

    // ... (item content: checkbox, text, actions, notes, attachments)
    
    // Contextual Tool Button
    if (item.link) {
        const toolButton = document.createElement('button');
        toolButton.className = 'contextual-tool-button mt-2 flex items-center space-x-2 text-sm text-sky-600 dark:text-sky-400 hover:underline';
        toolButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg><span>${item.linkText || 'Open Tool'}</span>`;
        toolButton.onclick = () => window.open(item.link, '_blank');
        itemDiv.appendChild(toolButton);
    }

    return itemDiv;
}

// --- Core Logic ---

async function handleSaveChecklist(force = false) {
    clearTimeout(saveTimeout);

    const saveAction = async () => {
        if (!isAuthReady || !currentChecklistData) return;

        const orgName = ui['org-name-input'].value.trim();
        if (!orgName) {
            ui['org-name-error'].classList.remove('hidden');
            return;
        }
        ui['org-name-error'].classList.add('hidden');

        currentChecklistData.orgName = orgName;
        currentChecklistData.lastUpdated = serverTimestamp();

        helpers.setSaveButtonState(true);

        try {
            if (currentChecklistData.id) {
                const docRef = doc(db, `artifacts/${appId}/users/${userId}/checklists`, currentChecklistData.id);
                await updateDoc(docRef, currentChecklistData);
            } else {
                const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/checklists`);
                const newDocRef = await addDoc(collectionRef, currentChecklistData);
                currentChecklistData.id = newDocRef.id;
                
                renderChecklistForm(currentChecklistData.id);
            }
            helpers.showStatus(ui['status-message'], "Checklist saved!", 'success');
        } catch (error) {
            console.error("Error saving checklist: ", error);
            helpers.showStatus(ui['status-message'], "Error saving checklist.", 'error');
        } finally {
            helpers.setSaveButtonState(false);
        }
    };

    if (force) {
        await saveAction();
    } else {
        saveTimeout = setTimeout(saveAction, 1000);
    }
}

async function handleAttachmentUpload(file, categoryId, itemId, uploadStatusElement) {
    if (!file) return;

    if (!currentChecklistData.id) {
        helpers.showStatus(uploadStatusElement, "Saving checklist before attaching file...", 'info', null);
        await handleSaveChecklist(true);
        if (!currentChecklistData.id) {
            helpers.showStatus(uploadStatusElement, "Please enter an organization name before adding attachments.", 'error');
            return;
        }
    }

    helpers.showStatus(uploadStatusElement, `Uploading "${file.name}"...`, 'info', null);

    try {
        const storageRef = ref(storage, `artifacts/${appId}/users/${userId}/attachments/${currentChecklistData.id}/${itemId}/${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        const category = currentChecklistData.categories.find(c => c.id === categoryId);
        const item = category?.items.find(i => i.id === itemId);

        if (item) {
            if (!item.attachments) item.attachments = [];
            if (!item.attachments.some(att => att.fileName === file.name)) {
                item.attachments.push({
                    fileName: file.name,
                    url: downloadURL,
                    type: file.type,
                    size: file.size,
                    uploadedAt: new Date()
                });
                await handleSaveChecklist(true);
                helpers.showStatus(uploadStatusElement, `"${file.name}" uploaded successfully!`, 'success');
            } else {
                helpers.showStatus(uploadStatusElement, `"${file.name}" already exists.`, 'info');
            }
        }
    } catch (error) {
        console.error("Error uploading attachment:", error);
        helpers.showStatus(uploadStatusElement, `Upload failed for "${file.name}".`, 'error');
    }
}

// ... (All other functions from previous version, like handleDelete, handleShare, etc.)

function handleChecklistContainerClick(event) {
    const targetElement = event.target.closest('[data-action]');
    if (!targetElement) return;

    const action = targetElement.dataset.action;
    
    if (action === 'toggle-category') {
        const categoryBlock = targetElement.closest('.category-block');
        categoryBlock.classList.toggle('expanded');
        return;
    }

    // ... (handle other actions like edit, delete, etc.)
}
