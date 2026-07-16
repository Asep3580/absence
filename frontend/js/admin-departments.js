import { fetchData } from './api.js';
import { ui } from './admin.js';

/**
 * This file contains all functions related to department management.
 * It must be loaded before admin.js.
 */
/**
 * Loads and displays the list of departments.
 */
export async function loadDepartments() {
    const departments = await fetchData('/admin/departments');
    ui.departmentsTableBody.innerHTML = ''; // Clear the table
    if (departments && departments.length > 0) {
        departments.forEach(department => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b';

            const nameCell = document.createElement('td');
            nameCell.className = 'px-6 py-4 font-medium text-slate-900';
            nameCell.textContent = department.name;

            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 space-x-2';
            if (department.id) {
                actionsCell.innerHTML = `
                        <button class="btn-edit-department font-medium text-blue-600 hover:underline" data-department-id="${department.id}">Edit</button>
                        <button class="btn-delete-department font-medium text-red-600 hover:underline" data-department-id="${department.id}">Delete</button>
                `;
            } else {
                actionsCell.textContent = 'N/A';
            }

            row.appendChild(nameCell);
            row.appendChild(actionsCell);
            ui.departmentsTableBody.appendChild(row);
        });
    } else {
        ui.departmentsTableBody.innerHTML = `<tr><td colspan="2" class="text-center py-4">No departments configured yet.</td></tr>`;
    }

}

/**
 * Displays the modal for adding or editing a department.
 * @param {object|null} department - The department object to edit, or null to add a new one.
 */
export function showDepartmentModal(department = null) {
    ui.departmentForm.reset();
    const isEdit = department !== null;

    ui.departmentModalTitle.textContent = isEdit ? 'Edit Department' : 'Add New Department';
    document.getElementById('department-id').value = isEdit ? department.id : '';
    document.getElementById('department-name').value = isEdit ? (department.name || '') : '';

    ui.departmentModal.classList.remove('hidden');
    ui.departmentModal.classList.add('flex');
}

export function hideDepartmentModal() {
    ui.departmentModal.classList.add('hidden');
    ui.departmentModal.classList.remove('flex');
}

export async function handleDepartmentFormSubmit(e) {
    e.preventDefault();
    if (!ui.departmentForm.checkValidity()) {
        ui.departmentForm.reportValidity();
        return;
    }

    const departmentId = document.getElementById('department-id').value;
    const departmentData = {
        name: document.getElementById('department-name').value,
    };

    const endpoint = departmentId ? `/admin/departments/${departmentId}` : '/admin/departments';
    const method = departmentId ? 'PUT' : 'POST';

    const result = await fetchData(endpoint, {
        method: method,
        body: JSON.stringify(departmentData),
        headers: { 'Content-Type': 'application/json' }
    });

    if (result) {
        hideDepartmentModal();
        await loadDepartments();
    }
}

async function handleEditDepartment(departmentId) {
    const department = await fetchData(`/admin/departments/${departmentId}`);
    if (department) {
        // Defensively ensure the ID from the URL parameter is on the object
        // if the API response is missing it. This prevents the ID from becoming
        // 'undefined' in the form.
        if (!department.id) {
            // This is the fix: ensure the ID from the click event is used
            // if the API response doesn't include one.
            department.id = departmentId;
        }
        showDepartmentModal(department);
    }
}

async function handleDeleteDepartment(departmentId) {
    if (confirm('Are you sure you want to delete this department?')) {
        const result = await fetchData(`/admin/departments/${departmentId}`, { method: 'DELETE' });
        if (result) {
            await loadDepartments();
        }
    }
}

/**
 * Initializes event listeners for the departments table using event delegation.
 */
export function initDepartmentEventListeners() {
    ui.departmentsTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-department');
        if (editBtn) {
            e.preventDefault();
            handleEditDepartment(editBtn.dataset.departmentId);
        }

        const deleteBtn = e.target.closest('.btn-delete-department');
        if (deleteBtn) {
            e.preventDefault();
            handleDeleteDepartment(deleteBtn.dataset.departmentId);
        }
    });
}
