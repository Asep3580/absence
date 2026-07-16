import { fetchData, state } from './api.js';
import { ui } from './admin.js';

/**
 * This file contains all functions related to user management.
 * It must be loaded before admin.js.
 */
/**
 * Loads and displays the list of users.
 */
export async function loadUsers() {
    // Add scope=management to get the correct user list for this page
    const users = await fetchData('/admin/users?scope=management');
    ui.usersTableBody.innerHTML = ''; // Clear the table
    if (users && users.length > 0) {
        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b';
 
            const isCurrentUser = user.id === state.user.id;
 
            // Create cells safely
            const nameCell = document.createElement('td');
            nameCell.className = 'px-6 py-4 font-medium text-slate-900';
            nameCell.textContent = user.username;
 
            const emailCell = document.createElement('td');
            emailCell.className = 'px-6 py-4';
            emailCell.textContent = user.email;
 
            const roleCell = document.createElement('td');
            roleCell.className = 'px-6 py-4';
            const roleSpan = document.createElement('span');
            roleSpan.className = `capitalize px-2 py-1 text-xs font-medium rounded-full ${user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`;
            roleSpan.textContent = user.role;
            roleCell.appendChild(roleSpan);
 
            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 space-x-2';
            actionsCell.innerHTML = `
                <button class="btn-edit-user font-medium text-blue-600 hover:underline" data-user-id="${user.id}">Edit</button>
                ${isCurrentUser
                    ? `<button class="font-medium text-slate-400 cursor-not-allowed" disabled>Delete</button>`
                    : `<button class="btn-delete-user font-medium text-red-600 hover:underline" data-user-id="${user.id}">Delete</button>`
                }`; // Using innerHTML here is safe as we control the content
 
            row.appendChild(nameCell);
            row.appendChild(emailCell);
            row.appendChild(roleCell);
            row.appendChild(actionsCell);
 
            ui.usersTableBody.appendChild(row);
        });
    } else {
        ui.usersTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4">No user data found.</td></tr>`;
    }

    // After loading users, run the search function to apply any existing filter
    handleUserSearch();
}

/**
 * Filters the user list in the table based on the search input.
 * Search is performed on username and email columns.
 */
export function handleUserSearch() {
    // Ensure the search input element exists before proceeding
    if (!ui.searchUserInput) return;

    const searchTerm = ui.searchUserInput.value.toLowerCase();
    const rows = ui.usersTableBody.querySelectorAll('tr');

    rows.forEach(row => {
        // Ensure the processed row is a data row, not a message row (like "No data").
        if (row.cells.length > 1) {
            const username = row.cells[0].textContent.toLowerCase();
            const email = row.cells[1].textContent.toLowerCase();

            // Show the row if it matches the search, hide it if not.
            if (username.includes(searchTerm) || email.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
}

/**
 * Displays the modal for adding or editing a user.
 * @param {object|null} user - The user object to edit, or null for adding a new user.
 */
export function showUserModal(user = null) {
    ui.userForm.reset();
    const isEdit = user !== null;
    ui.userModalTitle.textContent = isEdit ? 'Edit User' : 'Add New User';
    document.getElementById('user-id').value = isEdit ? user.id : '';
    document.getElementById('user-username').value = isEdit ? (user.username || '') : '';
    document.getElementById('user-email').value = isEdit ? (user.email || '') : '';
    document.getElementById('user-role').value = isEdit ? (user.role || 'user') : 'user';
    
    ui.passwordHint.style.display = isEdit ? 'block' : 'none';
    document.getElementById('user-password').required = !isEdit;

    ui.userModal.classList.remove('hidden');
    ui.userModal.classList.add('flex');
}

export function hideUserModal() {
    ui.userModal.classList.add('hidden');
    ui.userModal.classList.remove('flex');
}

export async function handleUserFormSubmit(e) {
    e.preventDefault();

    if (!ui.userForm.checkValidity()) {
        ui.userForm.reportValidity();
        return;
    }

    const userId = document.getElementById('user-id').value;
    const userData = {
        username: document.getElementById('user-username').value,
        email: document.getElementById('user-email').value,
        role: document.getElementById('user-role').value,
    };
    const password = document.getElementById('user-password').value;
    if (password) {
        userData.password = password;
    }

    const endpoint = userId ? `/admin/users/${userId}` : '/admin/users';
    const method = userId ? 'PUT' : 'POST';

    const result = await fetchData(endpoint, {
        method: method,
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' }
    });

    if (result) {
        hideUserModal();
        await loadUsers();
        // Fire an event so other parts of the app (like the employee list) can refresh
        document.dispatchEvent(new CustomEvent('user-data-changed'));
    }
}

async function handleEditUser(userId) {
    const user = await fetchData(`/admin/users/${userId}`);
    if (user) {
        if (!user.id) {
            user.id = userId;
        }
        showUserModal(user);
    }
}

async function handleDeleteUser(userId) {
    if (parseInt(userId, 10) === state.user.id) {
        alert('You cannot delete your own account.');
        return;
    }

    if (confirm('Are you sure you want to delete this user?')) {
        const result = await fetchData(`/admin/users/${userId}`, { method: 'DELETE' });
        if (result) {
            await loadUsers();
        }
    }
}

/**
 * Initializes event listeners for the users table using event delegation.
 */
export function initUserEventListeners() {
    ui.usersTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-user');
        if (editBtn) {
            e.preventDefault();
            handleEditUser(editBtn.dataset.userId);
        }

        const deleteBtn = e.target.closest('.btn-delete-user');
        if (deleteBtn) {
            e.preventDefault();
            handleDeleteUser(deleteBtn.dataset.userId);
        }
    });
}