// --- Module State & Config ---
let saasUsersTableBody, saasUserModal, saasUserForm, searchUserInput;

// --- Dependencies ---
let fetchData;
let SAAS_API;

// --- Data Loading & Rendering ---
export async function loadSaaSUsers() {
    try {
        saasUsersTableBody.innerHTML = '<tr><td colspan="5" class="loading">Loading users...</td></tr>';
        const searchTerm = searchUserInput.value || '';
        const endpoint = `${SAAS_API.users}?search=${encodeURIComponent(searchTerm)}`;
        
        const response = await fetchData(endpoint);
        const users = Array.isArray(response) ? response : response?.data;

        if (users) {
            renderSaaSUsersTable(users); // users is now guaranteed to be an array or undefined
        } else {
            saasUsersTableBody.innerHTML = '<tr><td colspan="5" class="error">Failed to load users.</td></tr>';
        }
    } catch (error) {
        saasUsersTableBody.innerHTML = `<tr><td colspan="5" class="error">An error occurred: ${error.message}</td></tr>`;
    }
}

function renderSaaSUsersTable(users) {
    saasUsersTableBody.innerHTML = '';
    if (users.length === 0) {
        saasUsersTableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
        return;
    }

    const currentUserId = JSON.parse(localStorage.getItem('user')).id;

    users.forEach(user => {
        const row = document.createElement('tr');
        const createdAtDate = new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

        const isCurrentUser = user.id === currentUserId;
        const deleteButton = isCurrentUser
            ? `<button class="btn-action btn-delete" data-id="${user.id}" disabled title="Cannot delete yourself"><i class="fas fa-trash"></i></button>`
            : `<button class="btn-action btn-delete" data-id="${user.id}"><i class="fas fa-trash"></i></button>`;

        row.innerHTML = `
            <td>
                <div class="user-info">
                    <span class="user-name">${user.username}</span>
                    <span class="user-email">${user.email}</span>
                </div>
            </td>
            <td><span class="role-badge role-${user.role}">${user.role}</span></td>
            <td>${user.companyName || 'N/A'}</td>
            <td>${createdAtDate}</td>
            <td class="actions">
                <button class="btn-action btn-edit" data-id="${user.id}"><i class="fas fa-edit"></i></button>
                ${deleteButton}
            </td>
        `;
        saasUsersTableBody.appendChild(row);
    });
}

// --- Modals & Forms ---

async function showSaaSUserModal(user = null) {
    saasUserForm.reset();
    const isEdit = user !== null;
    const modalTitle = saasUserModal.querySelector('h2');
    
    modalTitle.textContent = isEdit ? 'Edit SaaS User' : 'Add New SaaS User';
    document.getElementById('saas-user-id').value = isEdit ? user.id : '';
    document.getElementById('saas-username').value = isEdit ? user.username : '';
    document.getElementById('saas-email').value = isEdit ? user.email : '';
    document.getElementById('saas-role').value = isEdit ? user.role : 'admin';
    
    const passwordInput = document.getElementById('saas-password');
    const passwordLabel = passwordInput.previousElementSibling;
    if (isEdit) {
        passwordLabel.textContent = 'New Password';
        passwordInput.placeholder = 'Leave blank to keep current password';
        passwordInput.required = false;
    } else {
        passwordLabel.textContent = 'Password';
        passwordInput.placeholder = 'Enter password';
        passwordInput.required = true;
    }

    // Populate and manage company dropdown
    const companySelect = document.getElementById('saas-company');
    await populateCompanyDropdown(companySelect, user?.companyId);
    toggleCompanyDropdown();

    saasUserModal.style.display = 'flex';
}

async function populateCompanyDropdown(selectElement, selectedCompanyId = null) {
    try {
        const response = await fetchData(SAAS_API.companies + '?limit=1000'); // Get all companies
        const companies = response?.data || [];
        
        selectElement.innerHTML = '<option value="">-- Select Company --</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.name;
            if (company.id == selectedCompanyId) option.selected = true;
            selectElement.appendChild(option);
        });
    } catch (error) {
        selectElement.innerHTML = '<option value="">Error loading companies</option>';
    }
}

function hideSaaSUserModal() {
    saasUserModal.style.display = 'none';
}

async function handleSaaSUserFormSubmit(e) {
    e.preventDefault();
    if (!saasUserForm.checkValidity()) {
        saasUserForm.reportValidity();
        return;
    }

    const userId = document.getElementById('saas-user-id').value;
    const isEdit = !!userId;

    const userData = {
        username: document.getElementById('saas-username').value,
        email: document.getElementById('saas-email').value,
        role: document.getElementById('saas-role').value,
    };
    if (userData.role === 'admin') {
        userData.companyId = document.getElementById('saas-company').value;
    }

    const password = document.getElementById('saas-password').value;
    if (password) {
        userData.password = password;
    }

    const endpoint = isEdit ? `${SAAS_API.users}/${userId}` : SAAS_API.users;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const result = await fetchData(endpoint, {
            method: method,
            body: JSON.stringify(userData),
            headers: { 'Content-Type': 'application/json' }
        });

        if (result) {
            alert(`User successfully ${isEdit ? 'updated' : 'created'}!`);
            hideSaaSUserModal();
            loadSaaSUsers();
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function handleEditSaaSUser(userId) {
    const user = await fetchData(`${SAAS_API.users}/${userId}`);
    if (user) {
        showSaaSUserModal(user);
    }
}

async function handleDeleteSaaSUser(userId, username) {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
        const result = await fetchData(`${SAAS_API.users}/${userId}`, { method: 'DELETE' });
        if (result) {
            // Backend sekarang mengirim pesan sukses, jadi kita bisa menampilkannya.
            alert(result.message || 'User deleted successfully.');
            loadSaaSUsers();
        }
    }
}

function handleUserSearch() {
    loadSaaSUsers();
}

function toggleCompanyDropdown() {
    const role = document.getElementById('saas-role').value;
    const companyGroup = document.getElementById('saas-company-group');
    const companySelect = document.getElementById('saas-company');
    if (role === 'admin') {
        companyGroup.style.display = 'block';
        companySelect.required = true;
    } else {
        companyGroup.style.display = 'none';
        companySelect.required = false;
    }
}

// --- Initialization ---
export function initSaaSUsersModule(config) {
    fetchData = config.fetchData;
    SAAS_API = config.SAAS_API;

    saasUsersTableBody = config.dom.saasUsersTableBody;
    saasUserModal = config.dom.saasUserModal;
    saasUserForm = config.dom.saasUserForm;
    searchUserInput = config.dom.searchUserInput;

    const roleSelect = document.getElementById('saas-role');
    if (roleSelect) {
        roleSelect.addEventListener('change', toggleCompanyDropdown);
    }

    config.dom.addSaaSUserBtn.addEventListener('click', () => showSaaSUserModal());
    config.dom.closeSaaSUserModalBtn.addEventListener('click', hideSaaSUserModal);
    saasUserForm.addEventListener('submit', handleSaaSUserFormSubmit);
    
    searchUserInput.addEventListener('input', () => {
        clearTimeout(searchUserInput.debounce);
        searchUserInput.debounce = setTimeout(() => {
            handleUserSearch();
        }, 300);
    });

    saasUsersTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
            handleEditSaaSUser(editBtn.dataset.id);
        }

        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn && !deleteBtn.disabled) {
            const userId = deleteBtn.dataset.id;
            const username = deleteBtn.closest('tr')?.querySelector('.user-name')?.textContent || 'this user';
            handleDeleteSaaSUser(userId, username);
        }
    });
}