import { fetchData } from './api.js';
import { ui } from './admin.js';

/**
 * This file contains all functions related to role management.
 * It must be loaded before admin.js.
 */

const PERMISSIONS = {
    'view_dashboard': 'View Dashboard',
    'view_settings': 'View Settings Menu',
    'manage_users': 'Manage Users (Add/Edit/Delete)',
    'manage_roles': 'Manage Roles & Permissions',
    'manage_positions': 'Manage Positions',
    'manage_departments': 'Manage Departments',
    'manage_work_schedules': 'Manage Work Schedules',
};

/**
 * Loads and displays the list of roles.
 */
export async function loadRoles() {
    const roles = await fetchData('/admin/roles');
    ui.rolesTableBody.innerHTML = ''; // Clear the table
    if (roles && roles.length > 0) {
        roles.forEach(role => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b';
            const userCount = role.userCount || 0;
            // Protect default 'admin' and 'user' roles from being modified
            const isUneditable = ['admin', 'user'].includes(role.name.toLowerCase());
            
            const nameCell = document.createElement('td');
            nameCell.className = 'px-6 py-4 font-medium text-slate-900 capitalize';
            nameCell.textContent = role.name;

            const countCell = document.createElement('td');
            countCell.className = 'px-6 py-4';
            countCell.textContent = `${userCount} Users`;

            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 space-x-2';
            actionsCell.innerHTML = isUneditable 
                ? `<span class="text-sm text-slate-400 italic">Cannot be modified</span>`
                : `<button class="btn-edit-role font-medium text-blue-600 hover:underline" data-role-id="${role.id}">Edit</button>
                   <button class="btn-delete-role font-medium text-red-600 hover:underline" data-role-id="${role.id}">Delete</button>`;

            row.appendChild(nameCell);
            row.appendChild(countCell);
            row.appendChild(actionsCell);
            ui.rolesTableBody.appendChild(row);
        });
    } else {
        ui.rolesTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4">No roles configured yet.</td></tr>`;
    }
}

/**
 * Displays the modal for adding or editing a role.
 * @param {object|null} role - The role object to edit, or null for adding a new role.
 */
export function showRoleModal(role = null) {
    ui.roleForm.reset();
    const isEdit = role !== null;

    ui.roleModalTitle.textContent = isEdit ? 'Edit Role' : 'Add New Role';
    document.getElementById('role-id').value = isEdit ? role.id : '';
    document.getElementById('role-name').value = isEdit ? (role.name || '') : '';
    document.getElementById('role-name').disabled = isEdit; // Role name cannot be changed on edit

    // Render checkboxes for permissions
    ui.rolePermissionsContainer.innerHTML = Object.entries(PERMISSIONS).map(([key, label]) => `
        <label class="flex items-center p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer">
            <input type="checkbox" name="permissions" value="${key}" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
            <span class="ml-3 text-sm font-medium text-slate-700">${label}</span>
        </label>
    `).join('');

    // If in edit mode, check the corresponding checkboxes
    if (isEdit && role.permissions) {
        role.permissions.forEach(permissionKey => {
            const checkbox = ui.rolePermissionsContainer.querySelector(`input[value="${permissionKey}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }

    ui.roleModal.classList.remove('hidden');
    ui.roleModal.classList.add('flex');
}

export function hideRoleModal() {
    ui.roleModal.classList.add('hidden');
    ui.roleModal.classList.remove('flex');
}

export async function handleRoleFormSubmit(e) {
    e.preventDefault();
    if (!ui.roleForm.checkValidity()) {
        ui.roleForm.reportValidity();
        return;
    }

    const roleId = document.getElementById('role-id').value;
    const selectedPermissions = Array.from(ui.roleForm.querySelectorAll('input[name="permissions"]:checked'))
                                     .map(input => input.value);

    const roleData = {
        name: document.getElementById('role-name').value,
        permissions: selectedPermissions,
    };

    const endpoint = roleId ? `/admin/roles/${roleId}` : '/admin/roles';
    const method = roleId ? 'PUT' : 'POST';

    const result = await fetchData(endpoint, {
        method: method,
        body: JSON.stringify(roleData),
        headers: { 'Content-Type': 'application/json' }
    });

    if (result) {
        hideRoleModal();
        await loadRoles();
    }
}

async function handleEditRole(roleId) {
    const role = await fetchData(`/admin/roles/${roleId}`);
    if (role) {
        // Defensively ensure the ID is on the object if the API is inconsistent
        if (!role.id) {
            role.id = roleId;
        }
        showRoleModal(role);
    }
}

async function handleDeleteRole(roleId) {
    if (confirm('Are you sure you want to delete this role? Users with this role may lose access.')) {
        const result = await fetchData(`/admin/roles/${roleId}`, { method: 'DELETE' });
        if (result) {
            await loadRoles();
        }
    }
}

/**
 * Initializes event listeners for the roles table using event delegation.
 */
export function initRoleEventListeners() {
    ui.rolesTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-role');
        if (editBtn) {
            e.preventDefault();
            handleEditRole(editBtn.dataset.roleId);
        }

        const deleteBtn = e.target.closest('.btn-delete-role');
        if (deleteBtn) {
            e.preventDefault();
            handleDeleteRole(deleteBtn.dataset.roleId);
        }
    });
}