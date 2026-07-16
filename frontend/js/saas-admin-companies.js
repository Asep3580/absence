// --- Module State & Config ---
let currentPagination = { currentPage: 1, limit: 10 };
let currentSort = { column: 'created_at', order: 'desc' };
let addMapInstance = { map: null, marker: null, circle: null };
let editMapInstance = { map: null, marker: null, circle: null };
const DEFAULT_COORDS = { lat: -6.2088, lng: 106.8456 }; // Jakarta
const DEFAULT_ZOOM = 13;
const DEFAULT_RADIUS = 50;

// --- DOM Elements ---
let companiesTableBody, searchCompanyInput, addCompanyForm, editCompanyForm, addCompanyModal, editCompanyModal;

// --- Dependencies ---
let fetchData;
let SAAS_API;

// --- Data Loading & Rendering ---
export async function loadCompanies(page = 1, limit = 10) {
    try {
        companiesTableBody.innerHTML = '<tr><td colspan="10" class="loading">Loading...</td></tr>';
        const searchTerm = searchCompanyInput.value || '';
        const endpoint = `${SAAS_API.companies}?page=${page}&limit=${limit}&search=${encodeURIComponent(searchTerm)}&sortBy=${currentSort.column}&sortOrder=${currentSort.order}`;
        
        const response = await fetchData(endpoint);
        
        const companies = Array.isArray(response) ? response : response?.data;

        if (companies) {
            renderCompaniesTable(companies);
            if (response && response.pagination) {
                renderCompaniesPagination(response.pagination);
                currentPagination = response.pagination;
            } else {
                console.warn("Pagination data not found in API response. Disabling pagination controls.");
                const paginationContainer = document.getElementById('companies-pagination-controls');
                if (paginationContainer) paginationContainer.innerHTML = '';
            }
        } else {
            companiesTableBody.innerHTML = '<tr><td colspan="10" class="error">Failed to load companies.</td></tr>';
            const paginationContainer = document.getElementById('companies-pagination-controls');
            if (paginationContainer) paginationContainer.innerHTML = '';
        }
    } catch (error) {
        companiesTableBody.innerHTML = `<tr><td colspan="10" class="error">An error occurred: ${error.message}</td></tr>`;
        const paginationContainer = document.getElementById('companies-pagination-controls');
        if (paginationContainer) paginationContainer.innerHTML = '';
    }
}

function renderCompaniesTable(companies) {
    companiesTableBody.innerHTML = '';
    if (companies.length === 0) {
        const searchTerm = searchCompanyInput.value;
        if (searchTerm) {
            companiesTableBody.innerHTML = `<tr><td colspan="10">No companies found for "${searchTerm}".</td></tr>`;
        } else {
            companiesTableBody.innerHTML = '<tr><td colspan="10">No companies found.</td></tr>';
        }
        return;
    }
    companies.forEach(company => {
        const row = document.createElement('tr');

        const employeeCount = company.employeeCount || 0;
        const maxEmployees = company.maxEmployees || 0;
        const pricePerEmployee = company.pricePerEmployee || 0;
        const monthlyBill = employeeCount * pricePerEmployee;
        const formattedBill = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(monthlyBill);

        const dateFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
        const subStartDate = company.subscriptionStartDate ? new Date(company.subscriptionStartDate).toLocaleDateString('id-ID', dateFormatOptions) : 'N/A';
        const subEndDate = company.subscriptionEndDate ? new Date(company.subscriptionEndDate).toLocaleDateString('id-ID', dateFormatOptions) : 'N/A';
        const createdAtDate = new Date(company.createdAt).toLocaleDateString('id-ID', dateFormatOptions);

        row.innerHTML = `
            <td>${company.id}</td>
            <td>${company.name}</td>
            <td>${employeeCount} / ${maxEmployees}</td>
            <td>${formattedBill}</td>
            <td>${subStartDate}</td>
            <td>${subEndDate}</td>
            <td>${createdAtDate}</td>
            <td>${company.adminEmail || 'N/A'}</td>
            <td>${company.whatsapp || 'N/A'}</td>
            <td class="actions">
                <button class="btn-edit" data-id="${company.id}" style="background:#eff6ff;border:none;color:#3b82f6;border-radius:0.4rem;padding:0.35rem 0.75rem;cursor:pointer;margin-right:0.25rem;font-size:0.82rem;"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-delete" data-id="${company.id}" style="background:#fef2f2;border:none;color:#ef4444;border-radius:0.4rem;padding:0.35rem 0.75rem;cursor:pointer;font-size:0.82rem;"><i class="fas fa-trash"></i></button>
            </td>
        `;
        companiesTableBody.appendChild(row);
    });
}

function renderCompaniesPagination(pagination) {
    const paginationContainer = document.getElementById('companies-pagination-controls');
    if (!paginationContainer || !pagination || pagination.totalPages <= 1) {
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const { currentPage, totalPages, totalItems, limit } = pagination;
    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(startItem + limit - 1, totalItems);

    let pageNumbersHTML = '';
    const pages = [];
    const maxVisiblePages = 5;
    const sidePages = 1;

    if (totalPages <= maxVisiblePages + 2) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (currentPage > sidePages + 2) pages.push('...');
        
        let start = Math.max(2, currentPage - sidePages);
        let end = Math.min(totalPages - 1, currentPage + sidePages);

        for (let i = start; i <= end; i++) pages.push(i);
        
        if (currentPage < totalPages - sidePages - 1) pages.push('...');
        pages.push(totalPages);
    }

    pages.forEach(page => {
        if (page === '...') {
            pageNumbersHTML += `<span>...</span>`;
        } else {
            const isActive = page === currentPage;
            pageNumbersHTML += `<button data-page="${page}" class="${isActive ? 'active' : ''}">${page}</button>`;
        }
    });

    const paginationHTML = `
        <p>
            Showing ${startItem} to ${endItem} of ${totalItems} results
        </p>
        <nav>
            <button data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
                &laquo; Previous
            </button>
            ${pageNumbersHTML}
            <button data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
                Next &raquo;
            </button>
        </nav>
    `;
    paginationContainer.innerHTML = paginationHTML;

    paginationContainer.querySelectorAll('button[data-page]').forEach(button => {
        button.addEventListener('click', (e) => {
            const page = parseInt(e.currentTarget.dataset.page, 10);
            loadCompanies(page, limit);
        });
    });
}

function updateSortHeaders() {
    const tableHeaders = document.querySelectorAll('#companies-table .sortable-header');
    tableHeaders.forEach(header => {
        const sortBy = header.dataset.sortBy;
        const icon = header.querySelector('.sort-icon');

        if (sortBy === currentSort.column) {
            header.classList.add('active');
            if (currentSort.order === 'asc') {
                icon.className = 'fas fa-sort-up sort-icon';
            } else {
                icon.className = 'fas fa-sort-down sort-icon';
            }
        } else {
            header.classList.remove('active');
            icon.className = 'fas fa-sort sort-icon';
        }
    });
}

function handleCompanySearch() {
    loadCompanies(1, currentPagination.limit);
}

function setupMapForModal(type, data = {}) {
    const isEdit = type === 'edit';
    
    const instance = isEdit ? editMapInstance : addMapInstance;
    const mapId = `${type}-company-map`;

    const latInputId = isEdit ? 'editOfficeLatitude' : 'officeLatitude';
    const lngInputId = isEdit ? 'editOfficeLongitude' : 'officeLongitude';
    const radiusInputId = isEdit ? 'editOfficeRadius' : 'officeRadius';

    const latInput = document.getElementById(latInputId);
    const lngInput = document.getElementById(lngInputId);
    const radiusInput = document.getElementById(radiusInputId);

    const initialCoords = isEdit ? {
        lat: parseFloat(data.officeLatitude) || DEFAULT_COORDS.lat,
        lng: parseFloat(data.officeLongitude) || DEFAULT_COORDS.lng
    } : DEFAULT_COORDS;

    const initialRadius = isEdit ? (parseInt(data.officeRadius, 10) || DEFAULT_RADIUS) : DEFAULT_RADIUS;

    latInput.value = initialCoords.lat;
    lngInput.value = initialCoords.lng;
    radiusInput.value = initialRadius;

    initMap(instance, mapId, latInput, lngInput, radiusInput, initialCoords, initialRadius);
}

function initMap(instance, mapId, latInput, lngInput, radiusInput, initialCoords, initialRadius) {
    if (instance.map) {
        instance.map.setView(initialCoords, DEFAULT_ZOOM);
        instance.marker.setLatLng(initialCoords);
        instance.circle.setLatLng(initialCoords);
        instance.circle.setRadius(initialRadius);
        setTimeout(() => instance.map.invalidateSize(), 10);
        return;
    }

    const map = L.map(mapId, { attributionControl: false }).setView(initialCoords, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    const marker = L.marker(initialCoords, { draggable: true }).addTo(map);
    const circle = L.circle(initialCoords, {
        color: 'blue',
        fillColor: '#4a69bd',
        fillOpacity: 0.2,
        radius: initialRadius
    }).addTo(map);

    instance.map = map;
    instance.marker = marker;
    instance.circle = circle;

    const updateFormAndCircle = (coords, radius) => {
        latInput.value = coords.lat.toFixed(8);
        lngInput.value = coords.lng.toFixed(8);
        radiusInput.value = Math.round(radius);
        circle.setLatLng(coords);
        circle.setRadius(radius);
    };

    map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        updateFormAndCircle(e.latlng, circle.getRadius());
    });

    marker.on('dragend', () => {
        const newCoords = marker.getLatLng();
        updateFormAndCircle(newCoords, circle.getRadius());
    });

    const updateMapFromForm = () => {
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        const radius = parseInt(radiusInput.value, 10);

        if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius) && radius >= 0) {
            const newCoords = { lat, lng };
            marker.setLatLng(newCoords);
            circle.setLatLng(newCoords);
            circle.setRadius(radius);
            map.panTo(newCoords);
        }
    };

    latInput.addEventListener('input', updateMapFromForm);
    lngInput.addEventListener('input', updateMapFromForm);
    radiusInput.addEventListener('input', updateMapFromForm);

    setTimeout(() => map.invalidateSize(), 10);
}

function destroyMap(instance) {
    if (instance.map) {
        instance.map.remove();
        instance.map = null;
        instance.marker = null;
        instance.circle = null;
    }
}

function showAddCompanyModal() {
    addCompanyForm.reset();
    addCompanyModal.style.display = 'flex';
    setupMapForModal('add');
}

function hideAddCompanyModal() {
    addCompanyModal.style.display = 'none';
    destroyMap(addMapInstance);
}

function showEditCompanyModal(companyData) {
    document.getElementById('editCompanyId').value = companyData.id;
    document.getElementById('editCompanyName').value = companyData.name;
    document.getElementById('editCompanyAddress').value = companyData.address || '';
    document.getElementById('editCompanyWhatsapp').value = companyData.whatsapp || '';
    document.getElementById('editSubscriptionStartDate').value = companyData.subscriptionStartDate ? new Date(companyData.subscriptionStartDate).toISOString().split('T')[0] : '';
    document.getElementById('editSubscriptionEndDate').value = companyData.subscriptionEndDate ? new Date(companyData.subscriptionEndDate).toISOString().split('T')[0] : '';
    document.getElementById('editPricePerEmployee').value = companyData.pricePerEmployee || 0;
    document.getElementById('editMaxEmployees').value = companyData.maxEmployees || 10;
    
    editCompanyForm.dataset.adminId = companyData.adminId;
    document.getElementById('editAdminUsername').value = companyData.adminUsername || '';

    const adminEmailField = document.getElementById('editAdminEmail');
    adminEmailField.value = companyData.adminEmail || '';
    adminEmailField.readOnly = true; // Make email field read-only

    document.getElementById('editAdminPassword').value = '';

    editCompanyModal.style.display = 'flex';
    setupMapForModal('edit', companyData);
}

function hideEditCompanyModal() {
    editCompanyModal.style.display = 'none';
    destroyMap(editMapInstance);
    document.getElementById('editAdminEmail').readOnly = false; // Reset for next use
}

async function handleAddCompanySubmit(e) {
    e.preventDefault();
    
    // Validasi form sebelum submit
    if (!addCompanyForm.checkValidity()) {
        addCompanyForm.reportValidity();
        return;
    }

    const emailField = document.getElementById('adminEmail');
    const existingError = emailField.nextElementSibling;
    if (existingError && existingError.classList.contains('form-error-message')) {
        existingError.remove();
    }

    const companyData = {
        companyName: document.getElementById('companyName').value,
        companyAddress: document.getElementById('companyAddress').value,
        companyWhatsapp: document.getElementById('companyWhatsapp').value,
        subscriptionStartDate: document.getElementById('subscriptionStartDate').value,
        subscriptionEndDate: document.getElementById('subscriptionEndDate').value,
        pricePerEmployee: document.getElementById('pricePerEmployee').value || 0,
        maxEmployees: document.getElementById('maxEmployees').value || 10,
        officeLatitude: document.getElementById('officeLatitude').value || null,
        officeLongitude: document.getElementById('officeLongitude').value || null,
        officeRadius: document.getElementById('officeRadius').value || null,
        adminUsername: document.getElementById('adminUsername').value,
        adminEmail: document.getElementById('adminEmail').value,
        adminPassword: document.getElementById('adminPassword').value,
    };

    try {
        const result = await fetchData(SAAS_API.companies, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(companyData) });

        if (result) {
            alert('Company and Admin created successfully!');
            hideAddCompanyModal();
            addCompanyForm.reset();
            loadCompanies();
        }
    } catch (error) {
        if (error && error.message && error.message.includes('Email admin sudah digunakan')) {
            const errorElement = document.createElement('div');
            errorElement.className = 'form-error-message';
            errorElement.textContent = 'This email is already in use.';
            errorElement.style.color = 'var(--danger-color, #e74c3c)';
            errorElement.style.fontSize = '0.85rem';
            errorElement.style.marginTop = '5px';
            emailField.parentNode.insertBefore(errorElement, emailField.nextSibling);
        } else {
            alert(`An error occurred: ${error ? error.message : 'Unknown error'}`);
        }
    }
}

async function handleEditCompany(companyId) {
    const companyData = await fetchData(`${SAAS_API.companies}/${companyId}`);
    if (companyData) {
        showEditCompanyModal(companyData);
    }
}

async function handleEditCompanySubmit(e) {
    e.preventDefault();

    // Validasi form sebelum submit
    if (!editCompanyForm.checkValidity()) {
        editCompanyForm.reportValidity();
        return;
    }

    const companyId = document.getElementById('editCompanyId').value;
    const updatedData = {
        companyName: document.getElementById('editCompanyName').value,
        companyAddress: document.getElementById('editCompanyAddress').value,
        companyWhatsapp: document.getElementById('editCompanyWhatsapp').value,
        subscriptionStartDate: document.getElementById('editSubscriptionStartDate').value,
        subscriptionEndDate: document.getElementById('editSubscriptionEndDate').value,
        pricePerEmployee: document.getElementById('editPricePerEmployee').value || 0,
        maxEmployees: document.getElementById('editMaxEmployees').value || 10,
        officeLatitude: document.getElementById('editOfficeLatitude').value || null,
        officeLongitude: document.getElementById('editOfficeLongitude').value || null,
        officeRadius: document.getElementById('editOfficeRadius').value || null,
        adminId: editCompanyForm.dataset.adminId,
        adminUsername: document.getElementById('editAdminUsername').value,
        adminEmail: document.getElementById('editAdminEmail').value,
    };

    const newPassword = document.getElementById('editAdminPassword').value;
    if (newPassword) {
        if (newPassword.length < 6) {
            alert('Password baru harus memiliki minimal 6 karakter.');
            return;
        }
        updatedData.adminPassword = newPassword;
    }

    const result = await fetchData(`${SAAS_API.companies}/${companyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });

    if (result) {
        alert('Detail perusahaan berhasil diperbarui!');
        hideEditCompanyModal();
        loadCompanies(currentPagination.currentPage, currentPagination.limit);
    }
}

async function handleDeleteCompany(companyId, companyName) {
    const confirmationMessage = `Are you sure you want to permanently delete the company "${companyName}" (ID: ${companyId})? This action cannot be undone.`;
    if (confirm(confirmationMessage)) {
        const result = await fetchData(`${SAAS_API.companies}/${companyId}`, {
            method: 'DELETE'
        });

        if (result) {
            alert(`Company "${companyName}" was successfully deleted.`);
            loadCompanies();
        } else {
            // The fetchData function will typically show a more specific error.
            // This is a fallback.
            alert(`Failed to delete company "${companyName}".`);
        }
    }
}

export function initCompanyModule(config) {
    fetchData = config.fetchData;
    SAAS_API = config.SAAS_API;

    companiesTableBody = config.dom.companiesTableBody;
    searchCompanyInput = config.dom.searchCompanyInput;
    addCompanyForm = config.dom.addCompanyForm;
    editCompanyForm = config.dom.editCompanyForm;
    addCompanyModal = config.dom.addCompanyModal;
    editCompanyModal = config.dom.editCompanyModal;

    config.dom.addCompanyBtn.addEventListener('click', showAddCompanyModal);
    searchCompanyInput.addEventListener('input', () => {
        clearTimeout(searchCompanyInput.debounce);
        searchCompanyInput.debounce = setTimeout(() => {
            handleCompanySearch();
        }, 300);
    });
    config.dom.closeAddModalBtn.addEventListener('click', hideAddCompanyModal);
    addCompanyForm.addEventListener('submit', handleAddCompanySubmit);
    config.dom.closeEditModalBtn.addEventListener('click', hideEditCompanyModal);
    editCompanyForm.addEventListener('submit', handleEditCompanySubmit);

    companiesTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
            handleEditCompany(editBtn.dataset.id);
        }

        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const companyId = deleteBtn.dataset.id;
            const companyName = deleteBtn.closest('tr').cells[1].textContent;
            handleDeleteCompany(companyId, companyName);
        }
    });
}