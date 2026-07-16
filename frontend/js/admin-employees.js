import { fetchData, API_URL, state } from './api.js';
import { ui } from './admin.js';

/**
 * This file contains all functions related to employee management.
 * It must be loaded before `admin.js`.
 */

let currentPageLimit = 10; // Default items per page

/**
 * Loads and displays the list of employees in a table.
 */
export async function loadEmployeeTable(page = 1, status = 'active') {
    const limit = currentPageLimit; // Use the state variable
    const result = await fetchData(`/admin/users?page=${page}&limit=${limit}&status=${status}`);

    if (!result) {
        ui.employeeTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500">Failed to load employee data.</td></tr>`;
        const paginationContainer = document.getElementById('employee-pagination-controls');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const { data: users, pagination } = result;

    ui.employeeTableBody.innerHTML = ''; // Kosongkan tabel

    if (users && users.length > 0) {
        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b';
            
            const na = (value) => value || '<span class="italic text-slate-400">N/A</span>';

            // Employee Cell (Safely created)
            const employeeCell = document.createElement('td'); 
            employeeCell.className = 'px-6 py-4 font-medium text-slate-900 whitespace-nowrap';
            const avatarSrc = user.avatarUrl ? `${API_URL.replace(/\/api$/, '')}${user.avatarUrl}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`;
            employeeCell.innerHTML = `
                <a href="#employees/${user.id}" class="flex items-center group">
                    <img class="w-10 h-10 rounded-full mr-4 object-cover" src="${avatarSrc}" alt="">
                    <div>
                        <div class="font-semibold group-hover:text-blue-600" id="name-display"></div>
                        <div class="text-xs text-slate-500" id="email-display"></div>
                    </div>
                </a>`;
            employeeCell.querySelector('img').alt = `${user.username} avatar`;
            employeeCell.querySelector('#name-display').textContent = user.fullName || user.username;
            employeeCell.querySelector('#email-display').textContent = user.email;

            // Other cells
            const positionCell = document.createElement('td');
            positionCell.className = 'px-6 py-4';
            positionCell.innerHTML = na(user.positionName);

            const departmentCell = document.createElement('td');
            departmentCell.className = 'px-6 py-4';
            departmentCell.innerHTML = na(user.departmentName);

            const statusCell = document.createElement('td');
            statusCell.className = 'px-6 py-4';
            statusCell.innerHTML = na(user.employeeStatusName);

            row.append(employeeCell, positionCell, departmentCell, statusCell);

            // Add data attributes for search
            row.dataset.name = (user.fullName || user.username).toLowerCase();
            row.dataset.email = user.email.toLowerCase();
            row.dataset.position = (user.positionName || '').toLowerCase();
            row.dataset.department = (user.departmentName || '').toLowerCase();
            row.dataset.status = (user.employeeStatusName || '').toLowerCase();

            ui.employeeTableBody.appendChild(row);
        });
    } else {
        ui.employeeTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500">No employee data found.</td></tr>`;
    }

    renderEmployeePagination(pagination, status);

    // Terapkan filter pencarian setelah memuat tabel
    handleEmployeeSearch();
}

/**
 * Renders pagination controls for the employee table.
 * @param {object} pagination - The pagination object from the API.
 */
function renderEmployeePagination(pagination, status) {
    const paginationContainer = document.getElementById('employee-pagination-controls');
    if (!paginationContainer || !pagination) {
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const { currentPage, totalPages, totalItems, limit } = pagination;

    // Hide pagination if there's only one page and no need to change page size
    if (totalPages <= 1 && totalItems <= currentPageLimit) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(startItem + limit - 1, totalItems);

    // --- Items per page selector ---
    const limitOptions = [10, 25, 50, 100];
    const limitSelectorHTML = `
        <select id="items-per-page" class="bg-white border border-slate-300 text-slate-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-1.5">
            ${limitOptions.map(opt => `<option value="${opt}" ${opt === limit ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
    `;

    // --- Generate Page Number Buttons ---
    let pageNumbersHTML = '';
    const pages = [];
    const maxVisiblePages = 5; // Total visible page numbers (e.g., 1 ... 4 5 6 ... 10)
    const sidePages = 1; // Number of pages to show on each side of the current page

    if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1); // Always show first page
        let start = Math.max(2, currentPage - sidePages);
        let end = Math.min(totalPages - 1, currentPage + sidePages);

        if (start > 2) pages.push('...');
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push('...');

        pages.push(totalPages); // Always show last page
    }

    pages.forEach(page => {
        if (page === '...') {
            pageNumbersHTML += `<span class="px-3 py-2 text-sm font-medium text-slate-500">...</span>`;
        } else {
            const isActive = page === currentPage;
            const activeClass = isActive ? 'bg-blue-50 border-blue-500 text-blue-600 z-10' : 'bg-white hover:bg-slate-50';
            pageNumbersHTML += `
                <button data-page="${page}" class="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-md ${activeClass}">
                    ${page}
                </button>
            `;
        }
    });
    // --- End of Page Number Generation ---

    let paginationHTML = `
        <div class="flex items-center space-x-4">
             <p class="text-sm text-slate-700">
                 Showing <span class="font-medium">${startItem}</span> to <span class="font-medium">${endItem}</span> of <span class="font-medium">${totalItems}</span> results
             </p>
             <div class="flex items-center space-x-2">
                ${limitSelectorHTML} <span class="text-sm text-slate-700">per page</span>
             </div>
        </div>
        <nav class="flex items-center space-x-1">
            <button data-page="${currentPage - 1}" class="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 ${currentPage === 1 ? 'cursor-not-allowed opacity-50' : ''}" ${currentPage === 1 ? 'disabled' : ''}>
                Previous
            </button>
            ${pageNumbersHTML}
            <button data-page="${currentPage + 1}" class="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 ${currentPage === totalPages ? 'cursor-not-allowed opacity-50' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>
                Next
            </button>
        </nav>
    `;

    paginationContainer.innerHTML = paginationHTML;

    // Add event listeners
    paginationContainer.querySelectorAll('button[data-page]').forEach(button => {
        button.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            loadEmployeeTable(parseInt(page, 10), status);
        });
    });

    // Add event listener for the limit selector
    const limitSelector = paginationContainer.querySelector('#items-per-page');
    limitSelector.addEventListener('change', (e) => {
        const newLimit = parseInt(e.target.value, 10);
        currentPageLimit = newLimit;
        // Go back to page 1 when changing the number of items per page
        loadEmployeeTable(1, status);
    });
}

/**
 * Displays the employee profile detail page.
 * @param {string} userId - The ID of the user to display.
 */
export async function showEmployeeProfile(userId) {
    const user = await fetchData(`/admin/users/${userId}`, { cache: 'reload' });
    ui.viewEmployeeProfile.innerHTML = ''; // Clear old profile
    if (!user) {
        ui.viewEmployeeProfile.innerHTML = `<p class="text-center text-red-500">Failed to load employee profile.</p>`;
        return;
    }

    // Defensively ensure the ID is on the object if the API is inconsistent
    if (!user.id) {
        user.id = userId;
    }

    const na = (value) => value || '<span class="italic text-slate-400">N/A</span>';
    // Parse YYYY-MM-DD as local midnight to avoid UTC→local day shift
    const parseLocal = (s) => { const [y, m, d] = String(s).substring(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
    const formatDate = (dateString) => dateString ? parseLocal(dateString).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : na(null);

    // Fetch marital statuses to create a dynamic map for display
    const maritalStatuses = await fetchData('/admin/marital-statuses');
    const maritalStatusMap = maritalStatuses ? Object.fromEntries(maritalStatuses.map(s => [s.name, s.description])) : {};

    // Translation maps for displaying data in English
    const genderMap = {
        'Laki-laki': 'Male',
        'Perempuan': 'Female'
    };

    const formatGender = (value) => genderMap[value] || na(value);
    const formatMaritalStatus = (value) => maritalStatusMap[value] || na(value); // Now uses dynamic map

    // Helper to create a card for displaying information.
    const createInfoCard = (title, iconName, iconColorClass) => {
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-xl border border-slate-200';
        card.innerHTML = `
            <div class="flex items-center space-x-3 mb-4">
                <div class="p-3 rounded-lg ${iconColorClass.bg} ${iconColorClass.text}">
                    <i data-lucide="${iconName}" class="w-5 h-5"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800">${title}</h3>
            </div>
            <div class="space-y-1"></div>
        `;
        return card;
    };

    // Helper to create a row within an info card.
    const createProfileRow = (label, value) => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-start border-b border-slate-100 py-3';
        row.innerHTML = `<span class="text-sm text-slate-500">${label}</span><span class="text-sm font-semibold text-slate-700 text-right"></span>`;
        row.lastElementChild.innerHTML = value;
        return row;
    };

    // Build the profile view programmatically
    const fragment = document.createDocumentFragment();
    const avatarSrc = user.avatarUrl ? `${API_URL.replace(/\/api$/, '')}${user.avatarUrl}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'mb-8 flex justify-end items-center space-x-2';
    headerDiv.innerHTML = `
        <button id="btn-deactivate-employee" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2 text-sm hidden">
            <i data-lucide="user-x" class="w-4 h-4"></i>
            <span>Deactivate</span>
        </button>
        <button id="btn-reactivate-employee" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 text-sm hidden">
            <i data-lucide="user-check" class="w-4 h-4"></i>
            <span>Reactivate</span>
        </button>
        <button id="btn-delete-employee" class="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center space-x-2 text-sm hidden">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            <span>Delete</span>
        </button>
        <button id="btn-edit-profile-details" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm">
            <i data-lucide="edit" class="w-4 h-4"></i>
            <span>Edit Profile</span>
        </button>`;
    fragment.appendChild(headerDiv);

    const mainContentDiv = document.createElement('div');
    mainContentDiv.className = 'space-y-8';
    mainContentDiv.innerHTML = `
        <div class="bg-white p-8 rounded-xl border border-slate-200 max-w-4xl mx-auto">
            <div class="flex flex-col md:flex-row items-center md:items-start md:space-x-8">
                <img src="${avatarSrc}" alt="" class="w-32 h-32 rounded-full object-cover mb-4 md:mb-0 ring-4 ring-slate-100">
                <div class="text-center md:text-left flex-1">
                    <div class="flex items-center justify-center md:justify-start">
                        <h1 class="text-3xl font-bold text-slate-800" id="profile-name"></h1>
                        <span id="profile-active-status-badge" class="ml-3 capitalize text-xs font-bold px-2.5 py-1 rounded-full"></span>
                    </div>
                    <p class="text-md text-slate-500 mt-1" id="profile-email"></p>
                    <p class="text-sm text-slate-500 mt-1" id="profile-position"></p>
                    <p class="text-sm text-slate-500 mt-1" id="profile-department"></p>
                    <p class="text-sm text-slate-500 mt-1" id="profile-status"></p>
                    <p class="text-sm text-slate-500 mt-1" id="profile-level"></p>
                    <span class="capitalize mt-3 inline-block px-3 py-1 text-sm font-medium rounded-full ${user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}" id="profile-role"></span>
                </div>
            </div>
        </div>`;
    mainContentDiv.querySelector('img').alt = `${user.username} avatar`;
    mainContentDiv.querySelector('#profile-name').innerHTML = na(user.fullName) || na(user.username);
    mainContentDiv.querySelector('#profile-email').innerHTML = na(user.email);
    mainContentDiv.querySelector('#profile-position').innerHTML = `Position: ${na(user.positionName)}`;
    mainContentDiv.querySelector('#profile-department').innerHTML = `Department: ${na(user.departmentName)}`;
    mainContentDiv.querySelector('#profile-status').innerHTML = `Status: ${na(user.employeeStatusName)}`;
    mainContentDiv.querySelector('#profile-level').innerHTML = `Level: ${na(user.employeeLevelName)}`;
    mainContentDiv.querySelector('#profile-role').textContent = user.role;

    // Set active status badge
    const statusBadge = mainContentDiv.querySelector('#profile-active-status-badge');
    if (user.isActive) {
        statusBadge.textContent = 'Active';
        statusBadge.className += ' bg-green-100 text-green-800';
    } else {
        statusBadge.textContent = 'Inactive';
        statusBadge.className += ' bg-red-100 text-red-800';
    }
    fragment.appendChild(mainContentDiv);

    // --- New Card Layout ---
    const cardContainerDiv = document.createElement('div');
    cardContainerDiv.className = 'space-y-8 mt-8 max-w-4xl mx-auto';

    // Job Information Card
    const jobCard = createInfoCard('Job Information', 'briefcase', { bg: 'bg-blue-100', text: 'text-blue-600' });
    const jobBody = jobCard.querySelector('.space-y-1');
    jobBody.appendChild(createProfileRow('Company', na(user.companyName)));
    jobBody.appendChild(createProfileRow('Employee ID (NIK)', na(user.employeeNik)));
    jobBody.appendChild(createProfileRow('Department', na(user.departmentName)));
    jobBody.appendChild(createProfileRow('Position', na(user.positionName)));
    jobBody.appendChild(createProfileRow('Level', na(user.employeeLevelName)));
    jobBody.appendChild(createProfileRow('Status', na(user.employeeStatusName)));
    jobBody.appendChild(createProfileRow('Join Date', formatDate(user.joinDate || user.createdAt)));
    jobBody.appendChild(createProfileRow('Direct Supervisor', user.supervisorName || '-'));
    jobBody.appendChild(createProfileRow('Direct Manager', user.managerName || '-'));
    jobBody.lastElementChild?.classList.remove('border-b');
    cardContainerDiv.appendChild(jobCard);

    // Personal Data Card
    const personalCard = createInfoCard('Personal Data', 'user', { bg: 'bg-orange-100', text: 'text-orange-600' });
    const personalBody = personalCard.querySelector('.space-y-1');
    personalBody.appendChild(createProfileRow('Full Name', na(user.fullName)));
    personalBody.appendChild(createProfileRow('Date of Birth', formatDate(user.dateOfBirth)));
    personalBody.appendChild(createProfileRow('Gender', formatGender(user.gender)));
    personalBody.appendChild(createProfileRow('Religion', na(user.religion)));
    personalBody.appendChild(createProfileRow('Marital Status', formatMaritalStatus(user.maritalStatus)));
    personalBody.lastElementChild?.classList.remove('border-b');
    cardContainerDiv.appendChild(personalCard);

    // Contact & Emergency Card
    const contactCard = createInfoCard('Contact & Emergency', 'phone', { bg: 'bg-green-100', text: 'text-green-600' });
    const contactBody = contactCard.querySelector('.space-y-1');
    contactBody.appendChild(createProfileRow('Email', na(user.email)));
    contactBody.appendChild(createProfileRow('Phone No.', na(user.phoneNumber)));
    contactBody.appendChild(createProfileRow('Address', na(user.address)));
    contactBody.appendChild(createProfileRow('Emergency Contact Name', na(user.emergencyContactName)));
    contactBody.appendChild(createProfileRow('Emergency Contact Phone', na(user.emergencyContactPhone)));
    contactBody.lastElementChild?.classList.remove('border-b');
    cardContainerDiv.appendChild(contactCard);

    mainContentDiv.appendChild(cardContainerDiv);
    fragment.appendChild(mainContentDiv);
    
    ui.viewEmployeeProfile.appendChild(fragment);

    // --- Deactivate/Reactivate/Delete Logic ---
    const deactivateBtn = document.getElementById('btn-deactivate-employee');
    const reactivateBtn = document.getElementById('btn-reactivate-employee');
    const deleteBtn = document.getElementById('btn-delete-employee');

    if (user.isActive) {
        deactivateBtn.classList.remove('hidden');
        deactivateBtn.addEventListener('click', () => handleDeactivateEmployee(userId, user.fullName || user.username));
    } else {
        reactivateBtn.classList.remove('hidden');
        reactivateBtn.addEventListener('click', () => handleReactivateEmployee(userId, user.fullName || user.username));
        
        if (state.user && state.user.role === 'admin') {
            deleteBtn.classList.remove('hidden');
            deleteBtn.addEventListener('click', () => handleDeleteEmployee(userId, user.fullName || user.username));
        }
    }

    // Add event listener to the newly created edit button
    document.getElementById('btn-edit-profile-details').addEventListener('click', () => {
        handleEditProfileDetails(userId);
    });

    lucide.createIcons();
}

/**
 * Handles deactivating an employee's account.
 * @param {string} userId 
 * @param {string} userName 
 */
async function handleDeactivateEmployee(userId, userName) {
    if (confirm(`Are you sure you want to deactivate ${userName}? They will no longer be able to log in.`)) {
        const result = await fetchData(`/admin/users/${userId}/deactivate`, { method: 'PUT' });
        if (result) {
            alert(`${userName} has been deactivated.`);
            await showEmployeeProfile(userId); // Refresh profile view
        }
    }
}

/**
 * Handles reactivating an employee's account.
 * @param {string} userId 
 * @param {string} userName 
 */
async function handleReactivateEmployee(userId, userName) {
    if (confirm(`Are you sure you want to reactivate ${userName}?`)) {
        const result = await fetchData(`/admin/users/${userId}/reactivate`, { method: 'PUT' });
        if (result) {
            alert(`${userName} has been reactivated.`);
            await showEmployeeProfile(userId); // Refresh profile view
        }
    }
}

/**
 * Handles permanently deleting an employee's account.
 * @param {string} userId 
 * @param {string} userName 
 */
async function handleDeleteEmployee(userId, userName) {
    if (confirm(`Are you sure you want to PERMANENTLY DELETE ${userName}? This action cannot be undone.`)) {
        const result = await fetchData(`/admin/users/${userId}`, { method: 'DELETE' });
        if (result) {
            alert(`${userName} has been permanently deleted.`);
            window.location.hash = '#employees';
        }
        // If result is null, fetchData will have already shown an alert.
    }
}

/**
 * Fetches the latest user data and shows the edit modal.
 * @param {string} userId
 */
async function handleEditProfileDetails(userId) {
    const user = await fetchData(`/admin/users/${userId}`, { cache: 'reload' });
    if (user) {
        if (!user.id) {
            user.id = userId;
        }
        showProfileDetailsModal(user);
    }
}

/**
 * Populates a select dropdown with options.
 * @param {HTMLSelectElement} selectElement - The <select> element to populate.
 * @param {Array<object>} data - The array of data objects.
 * @param {string} valueField - The property name for the option value.
 * @param {string} textField - The property name for the option text.
 * @param {string} placeholder - The placeholder text for the first option.
 */
function populateSelect(selectElement, data, valueField, textField, placeholder) {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueField];
        option.textContent = item[textField];
        selectElement.appendChild(option);
    });
}

/**
 * Translates hardcoded gender options from Indonesian to English.
 * @param {HTMLSelectElement} selectElement The select element for gender.
 */
function translateGenderOptions(selectElement) {
    if (!selectElement) return;
    // This assumes the values are 'Laki-laki' and 'Perempuan' in the HTML
    Array.from(selectElement.options).forEach(option => {
        if (option.value === 'Laki-laki') option.textContent = 'Male';
        if (option.value === 'Perempuan') option.textContent = 'Female';
    });
}

/**
 * Shows the modal for adding a new employee.
 * Fetches positions and departments to populate dropdowns.
 */
export async function showAddEmployeeModal() {
    ui.addEmployeeForm.reset();

    // Fetch positions and departments in parallel
    const [positions, departments, statuses, levels, maritalStatuses] = await Promise.all([
        fetchData('/admin/positions'),
        fetchData('/admin/departments'),
        fetchData('/admin/employee-statuses'),
        fetchData('/admin/employee-levels'),
        fetchData('/admin/marital-statuses')
    ]);

    // Populate dropdowns
    const positionSelect = document.getElementById('employee-position');
    const departmentSelect = document.getElementById('employee-department');
    const statusSelect = document.getElementById('employee-status');
    const levelSelect = document.getElementById('employee-level');
    const maritalStatusSelect = document.getElementById('employee-maritalStatus');

    if (positions) {
        populateSelect(positionSelect, positions, 'id', 'name', 'Select position');
    }
    if (departments) {
        populateSelect(departmentSelect, departments, 'id', 'name', 'Select department');
    }
    if (statuses) {
        populateSelect(statusSelect, statuses, 'id', 'name', 'Select status');
    }
    if (levels) {
        populateSelect(levelSelect, levels, 'id', 'name', 'Select a level');
    }
    if (maritalStatuses) {
        populateSelect(maritalStatusSelect, maritalStatuses, 'name', 'description', 'Select marital status');
    }

    // Translate gender dropdown options
    translateGenderOptions(document.getElementById('employee-gender'));

    ui.addEmployeeModal.classList.remove('hidden');
    ui.addEmployeeModal.classList.add('flex');
}

/**
 * Hides the modal for adding a new employee.
 */
export function hideAddEmployeeModal() {
    ui.addEmployeeModal.classList.add('hidden');
    ui.addEmployeeModal.classList.remove('flex');
}

/**
 * Handles the submission of the add new employee form.
 */
export async function handleAddEmployeeFormSubmit(e) {
    e.preventDefault();
    if (!ui.addEmployeeForm.checkValidity()) {
        ui.addEmployeeForm.reportValidity();
        return;
    }

    const email = document.getElementById('employee-email').value;
    const fullName = document.getElementById('employee-fullName').value;

    const employeeData = {
        email: email,
        password: document.getElementById('employee-password').value,
        username: fullName || email.split('@')[0],
        role: 'user', // Hardcode role to 'user' for employees
        positionId: document.getElementById('employee-position').value || null,
        employeeNik: document.getElementById('employee-nik').value || null,
        departmentId: document.getElementById('employee-department').value || null,
        employeeStatusId: document.getElementById('employee-status').value || null,
        employeeLevelId: document.getElementById('employee-level').value || null,
        joinDate: document.getElementById('employee-joinDate').value || null,
        contractStartDate: document.getElementById('employee-contractStartDate').value || null,
        contractEndDate: document.getElementById('employee-contractEndDate').value || null,
        annualLeaveAdjustment: document.getElementById('employee-leaveAdjustment').value ? parseInt(document.getElementById('employee-leaveAdjustment').value, 10) : null,
        fullName: fullName,
        // Include all other profile fields from the form
        phoneNumber: document.getElementById('employee-phoneNumber').value,
        dateOfBirth: document.getElementById('employee-dateOfBirth').value || null,
        gender: document.getElementById('employee-gender').value,
        maritalStatus: document.getElementById('employee-maritalStatus').value,
        religion: document.getElementById('employee-religion').value,
        address: document.getElementById('employee-address').value,
        emergencyContactName: document.getElementById('employee-emergencyContactName').value,
        emergencyContactPhone: document.getElementById('employee-emergencyContactPhone').value,
    };

    const result = await fetchData('/admin/users', { method: 'POST', body: JSON.stringify(employeeData), headers: { 'Content-Type': 'application/json' } });

    if (result) {
        hideAddEmployeeModal();
        await loadEmployeeTable();
        document.dispatchEvent(new CustomEvent('user-data-changed'));
    }
}

/**
 * Shows the modal for editing employee profile details.
 * @param {object} user - The user object containing profile data.
 */
export async function showProfileDetailsModal(user) {
    ui.profileDetailsForm.reset();

    // Fetch dropdown data
    const [positions, departments, statuses, levels, maritalStatuses, colleagues] = await Promise.all([
        fetchData('/admin/positions'),
        fetchData('/admin/departments'),
        fetchData('/admin/employee-statuses'),
        fetchData('/admin/employee-levels'),
        fetchData('/admin/marital-statuses'),
        fetchData('/user/colleagues'),
    ]);

    // Populate and set current values for job info
    const posSelect = document.getElementById('modal-profile-position');
    const deptSelect = document.getElementById('modal-profile-department');
    const statusSelect = document.getElementById('modal-profile-employeeStatus');
    const levelSelect = document.getElementById('modal-profile-employeeLevel');
    const maritalStatusSelect = document.getElementById('modal-profile-maritalStatus');

    populateSelect(posSelect, positions || [], 'id', 'name', 'Select Position');
    populateSelect(deptSelect, departments || [], 'id', 'name', 'Select Department');
    populateSelect(statusSelect, statuses || [], 'id', 'name', 'Select Status');
    populateSelect(levelSelect, levels || [], 'id', 'name', 'Select Level');
    populateSelect(maritalStatusSelect, maritalStatuses || [], 'name', 'description', 'Select Marital Status');

    // Translate gender dropdown options
    translateGenderOptions(document.getElementById('modal-profile-gender'));

    posSelect.value = user.positionId || '';
    deptSelect.value = user.departmentId || '';
    statusSelect.value = user.employeeStatusId || '';
    levelSelect.value = user.employeeLevelId || '';
    maritalStatusSelect.value = user.maritalStatus || '';

    document.getElementById('modal-profile-joinDate').value = user.joinDate ? user.joinDate.split('T')[0] : '';
    document.getElementById('modal-profile-employee-nik').value = user.employeeNik || '';
    document.getElementById('modal-profile-details-user-id').value = user.id;
    document.getElementById('modal-profile-fullName').value = user.fullName || '';
    document.getElementById('modal-profile-phoneNumber').value = user.phoneNumber || '';
    // Format date for input[type=date] which expects YYYY-MM-DD
    document.getElementById('modal-profile-dateOfBirth').value = user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '';
    document.getElementById('modal-profile-gender').value = user.gender || '';
    document.getElementById('modal-profile-religion').value = user.religion || '';
    document.getElementById('modal-profile-address').value = user.address || '';
    document.getElementById('modal-profile-emergencyContactName').value = user.emergencyContactName || '';
    document.getElementById('modal-profile-emergencyContactPhone').value = user.emergencyContactPhone || '';
    
    // Contract dates
    const contractStartDateInput = document.getElementById('modal-profile-contractStartDate');
    const contractEndDateInput = document.getElementById('modal-profile-contractEndDate');
    contractStartDateInput.value = user.contractStartDate ? user.contractStartDate.split('T')[0] : '';
    contractEndDateInput.value = user.contractEndDate ? user.contractEndDate.split('T')[0] : '';

    // Annual leave adjustment
    const leaveAdjInput = document.getElementById('modal-profile-leaveAdjustment');
    if (leaveAdjInput) leaveAdjInput.value = user.annualLeaveAdjustment != null ? user.annualLeaveAdjustment : '';

    // Supervisor & Manager dropdowns — populated with all colleagues (same company)
    const supervisorSelect = document.getElementById('modal-profile-supervisorId');
    const managerSelect = document.getElementById('modal-profile-managerId');
    const allUsers = colleagues || [];
    [supervisorSelect, managerSelect].forEach(sel => {
        sel.innerHTML = '<option value="">— None —</option>';
        allUsers.forEach(u => {
            if (String(u.id) === String(user.id)) return; // exclude self
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.fullName || u.username;
            sel.appendChild(opt);
        });
    });
    supervisorSelect.value = user.supervisorId || '';
    managerSelect.value = user.managerId || '';

    ui.profileDetailsModal.classList.remove('hidden');
    ui.profileDetailsModal.classList.add('flex');
}

/**
 * Hides the modal for editing employee profile details.
 */
export function hideProfileDetailsModal() {
    ui.profileDetailsModal.classList.add('hidden');
    ui.profileDetailsModal.classList.remove('flex');
}

/**
 * Handles the submission of the employee profile details form.
 */
export async function handleProfileDetailsFormSubmit(e) {
    e.preventDefault();
    const userId = document.getElementById('modal-profile-details-user-id').value;

    // Bangun payload dengan semua data dari form, termasuk yang baru
    const payload = {
        // Personal Data
        fullName: document.getElementById('modal-profile-fullName').value,
        phoneNumber: document.getElementById('modal-profile-phoneNumber').value,
        dateOfBirth: document.getElementById('modal-profile-dateOfBirth').value,
        gender: document.getElementById('modal-profile-gender').value,
        maritalStatus: document.getElementById('modal-profile-maritalStatus').value,
        religion: document.getElementById('modal-profile-religion').value,
        address: document.getElementById('modal-profile-address').value,
        emergencyContactName: document.getElementById('modal-profile-emergencyContactName').value,
        emergencyContactPhone: document.getElementById('modal-profile-emergencyContactPhone').value,

        // Job Data
        positionId: document.getElementById('modal-profile-position').value || null,
        departmentId: document.getElementById('modal-profile-department').value || null,
        employeeStatusId: document.getElementById('modal-profile-employeeStatus').value || null,
        employeeLevelId: document.getElementById('modal-profile-employeeLevel').value || null,
        
        // Add NIK and Join Date to the payload
        joinDate: document.getElementById('modal-profile-joinDate').value,
        employeeNik: document.getElementById('modal-profile-employee-nik').value,

        // Contract Data
        contractStartDate: document.getElementById('modal-profile-contractStartDate').value,
        contractEndDate: document.getElementById('modal-profile-contractEndDate').value,
        annualLeaveAdjustment: document.getElementById('modal-profile-leaveAdjustment')?.value !== ''
            ? parseInt(document.getElementById('modal-profile-leaveAdjustment').value, 10)
            : null,

        // Approval Chain
        supervisorId: document.getElementById('modal-profile-supervisorId').value || null,
        managerId: document.getElementById('modal-profile-managerId').value || null,
    };

    // Panggil API ke endpoint baru yang telah kita buat
    const result = await fetchData(`/admin/employees/${userId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
    });

    if (result) {
        hideProfileDetailsModal();
        await showEmployeeProfile(userId); // Refresh profile view
    }
}

// ─── Bulk Import ─────────────────────────────────────────────────────────────

let _bulkParsedEmployees = [];

export function showBulkImportModal() {
    _bulkParsedEmployees = [];
    _setBulkStep(1);

    const fileInput = document.getElementById('bulk-file-input');
    if (fileInput) fileInput.value = '';
    document.getElementById('bulk-file-name').classList.add('hidden');
    document.getElementById('btn-bulk-preview').classList.add('hidden');

    const modal = document.getElementById('bulk-import-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
}

export function hideBulkImportModal() {
    const modal = document.getElementById('bulk-import-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function _setBulkStep(step) {
    [1, 2, 3].forEach(n => {
        document.getElementById(`bulk-step-${n}`).classList.toggle('hidden', n !== step);
        const ind = document.getElementById(`bulk-step-${n}-ind`);
        if (n < step) {
            ind.classList.remove('opacity-40');
            ind.querySelector('div').className = 'w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold';
        } else if (n === step) {
            ind.classList.remove('opacity-40');
            ind.querySelector('div').className = 'w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold';
        } else {
            ind.classList.add('opacity-40');
            ind.querySelector('div').className = 'w-7 h-7 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-xs font-bold';
        }
    });
}

function _parseBulkFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
            _bulkParsedEmployees = rows.map(r => ({
                nik:                  r['NIK'] || r['Nik'] || '',
                fullName:             r['Full Name*'] || r['Full Name'] || '',
                username:             r['Username'] || '',
                email:                r['Email*'] || r['Email'] || '',
                password:             r['Password'] || '',
                department:           r['Department'] || '',
                position:             r['Position'] || '',
                employeeStatus:       r['Employee Status'] || '',
                employeeLevel:        r['Employee Level'] || '',
                role:                 r['Role'] || 'user',
                phone:                r['Phone'] || '',
                joinDate:             r['Join Date'] || '',
                gender:               r['Gender'] || '',
                dateOfBirth:          r['Date of Birth'] || '',
                religion:             r['Religion'] || '',
                address:              r['Address'] || '',
                emergencyContactName: r['Emergency Contact Name'] || '',
                emergencyContactPhone:r['Emergency Contact Phone'] || '',
                contractStart:        r['Contract Start'] || '',
                contractEnd:          r['Contract End'] || '',
            })).filter(e => (e.fullName || e.email).trim());
        } catch {
            alert('Failed to parse Excel file. Please use the provided template.');
        }
    };
    reader.readAsArrayBuffer(file);
}

function _showBulkPreview() {
    const employees = _bulkParsedEmployees;
    document.getElementById('bulk-preview-summary').textContent =
        `Found ${employees.length} employee${employees.length !== 1 ? 's' : ''} to import`;
    document.getElementById('btn-confirm-bulk-text').textContent =
        `Import ${employees.length} Employee${employees.length !== 1 ? 's' : ''}`;

    const MAX = 15;
    const tbody = document.getElementById('bulk-preview-table-body');
    tbody.innerHTML = '';
    employees.slice(0, MAX).forEach((e, i) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';
        const td = (v, fallback = '-') => `<td class="px-3 py-2 text-slate-600">${v || fallback}</td>`;
        row.innerHTML = `
            <td class="px-3 py-2 text-slate-400">${i + 2}</td>
            ${td(e.nik)}
            <td class="px-3 py-2 font-medium text-slate-800">${e.fullName || '<span class="text-red-500 font-normal">MISSING</span>'}</td>
            <td class="px-3 py-2 text-slate-600">${e.email || '<span class="text-red-500">MISSING</span>'}</td>
            ${td(e.department)}${td(e.position)}${td(e.employeeStatus)}`;
        tbody.appendChild(row);
    });

    const moreEl = document.getElementById('bulk-preview-more');
    if (employees.length > MAX) {
        moreEl.classList.remove('hidden');
        moreEl.textContent = `... and ${employees.length - MAX} more rows`;
    } else {
        moreEl.classList.add('hidden');
    }

    _setBulkStep(2);
    lucide.createIcons();
}

async function _runBulkImport() {
    const btn = document.getElementById('btn-confirm-bulk-import');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 mr-2"></i>Importing...';
    lucide.createIcons();

    try {
        const result = await fetchData('/admin/users/bulk-import', {
            method: 'POST',
            body: JSON.stringify({ employees: _bulkParsedEmployees }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!result) return;

        document.getElementById('bulk-success-count').textContent = result.successCount;
        document.getElementById('bulk-error-count').textContent = result.errorCount;

        const errors = (result.results || []).filter(r => r.status === 'error');
        const errContainer = document.getElementById('bulk-errors-container');
        if (errors.length > 0) {
            errContainer.classList.remove('hidden');
            document.getElementById('bulk-errors-table-body').innerHTML = errors.map(e => `
                <tr class="hover:bg-red-50">
                    <td class="px-3 py-2 text-slate-500">${e.row}</td>
                    <td class="px-3 py-2 text-slate-700">${e.name || '-'}</td>
                    <td class="px-3 py-2 text-slate-600">${e.email || '-'}</td>
                    <td class="px-3 py-2 text-red-600">${e.message || 'Unknown error'}</td>
                </tr>`).join('');
        } else {
            errContainer.classList.add('hidden');
        }

        _setBulkStep(3);
        lucide.createIcons();
    } finally {
        btn.disabled = false;
    }
}

export async function downloadBulkTemplate() {
    const btn = document.getElementById('btn-download-template');
    btn.disabled = true;
    const origHTML = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 mr-2"></i>Preparing...';
    lucide.createIcons();

    try {
        const [departments, positions, statuses, levels] = await Promise.all([
            fetchData('/admin/departments'),
            fetchData('/admin/positions'),
            fetchData('/admin/employee-statuses'),
            fetchData('/admin/employee-levels'),
        ]);

        const wb = XLSX.utils.book_new();

        const headers = [
            'NIK', 'Full Name*', 'Username', 'Email*', 'Password',
            'Department', 'Position', 'Employee Status', 'Employee Level', 'Role',
            'Phone', 'Join Date', 'Gender', 'Date of Birth', 'Religion',
            'Address', 'Emergency Contact Name', 'Emergency Contact Phone',
            'Contract Start', 'Contract End'
        ];
        const sample = [
            'EMP001', 'John Doe', 'johndoe', 'john@company.com', 'Password@123',
            (departments || [])[0]?.name || '', (positions || [])[0]?.name || '',
            (statuses || [])[0]?.name || '', (levels || [])[0]?.name || '', 'user',
            '081234567890', '2024-01-15', 'Laki-laki', '1995-03-20', 'Islam',
            'Jakarta', 'Jane Doe', '081234567891', '2024-01-15', '2025-01-14'
        ];
        const ws1 = XLSX.utils.aoa_to_sheet([headers, sample]);
        ws1['!cols'] = headers.map(() => ({ wch: 22 }));
        XLSX.utils.book_append_sheet(wb, ws1, 'Employees');

        const ref = [
            ['=== REFERENCE VALUES ===', ''],
            ['Copy exact values below into the Employees sheet', ''],
            ['', ''],
            ['DEPARTMENTS', ''], ...((departments || []).map(d => ['', d.name])),
            ['', ''],
            ['POSITIONS', ''], ...((positions || []).map(p => ['', p.name])),
            ['', ''],
            ['EMPLOYEE STATUS', ''], ...((statuses || []).map(s => ['', s.name])),
            ['', ''],
            ['EMPLOYEE LEVEL', ''], ...((levels || []).map(l => ['', l.name])),
            ['', ''],
            ['GENDER (exact)', ''], ['', 'Laki-laki'], ['', 'Perempuan'],
            ['', ''],
            ['ROLE (exact)', ''], ['', 'user'], ['', 'admin'],
            ['', ''],
            ['DATE FORMAT', ''], ['', 'YYYY-MM-DD  e.g. 2024-01-15'],
            ['', ''],
            ['NOTES', ''],
            ['', '* Columns with * are required (Full Name, Email)'],
            ['', '* Username auto-generated from Full Name if blank'],
            ['', '* Password defaults to Password@123 if blank'],
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(ref);
        ws2['!cols'] = [{ wch: 28 }, { wch: 44 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Reference');

        XLSX.writeFile(wb, 'employee_import_template.xlsx');
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHTML;
        lucide.createIcons();
    }
}

export function initBulkImportEvents() {
    // File input change (wired once here, not in showBulkImportModal)
    const fileInput = document.getElementById('bulk-file-input');
    fileInput?.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        document.getElementById('bulk-file-name-text').textContent = file.name;
        document.getElementById('bulk-file-name').classList.remove('hidden');
        document.getElementById('btn-bulk-preview').classList.remove('hidden');
        lucide.createIcons();
        _parseBulkFile(file);
    });

    document.getElementById('btn-close-bulk-import')?.addEventListener('click', hideBulkImportModal);
    document.getElementById('btn-download-template')?.addEventListener('click', downloadBulkTemplate);
    document.getElementById('btn-bulk-preview')?.addEventListener('click', () => {
        if (_bulkParsedEmployees.length === 0) {
            alert('No employee rows found in the file. Please check the file and try again.');
            return;
        }
        _showBulkPreview();
    });
    document.getElementById('btn-bulk-back')?.addEventListener('click', () => {
        _setBulkStep(1);
        lucide.createIcons();
    });
    document.getElementById('btn-confirm-bulk-import')?.addEventListener('click', _runBulkImport);
    document.getElementById('btn-bulk-done')?.addEventListener('click', () => {
        hideBulkImportModal();
        loadEmployeeTable();
    });
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filters the employee cards in the grid based on search input.
 */
export function handleEmployeeSearch() {
    if (!ui.searchEmployeeInput || !ui.employeeTableBody) return;
    const searchTerm = ui.searchEmployeeInput.value.toLowerCase();
    const rows = ui.employeeTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        // Make sure we don't hide the "no data" row
        if (row.cells.length > 1) {
            const name = row.dataset.name || '';
            const email = row.dataset.email || '';
            const position = row.dataset.position || '';
            const department = row.dataset.department || '';
            const status = row.dataset.status || '';
            
            if (name.includes(searchTerm) || email.includes(searchTerm) || position.includes(searchTerm) || department.includes(searchTerm) || status.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
}