import { fetchData } from './api.js';
import { ui } from './admin.js';

/**
 * This file contains all functions related to employee status management.
 */

/**
 * Loads and displays the list of employee statuses from the API.
 */
export async function loadEmployeeStatuses() {
    const statuses = await fetchData('/admin/employee-statuses');
    
    ui.employeeStatusesTableBody.innerHTML = ''; // Clear the table
    if (statuses && statuses.length > 0) {
        statuses.forEach(status => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b';

            const nameCell = document.createElement('td');
            nameCell.className = 'px-6 py-4 font-medium text-slate-900';
            nameCell.textContent = status.name;

            const descriptionCell = document.createElement('td');
            descriptionCell.className = 'px-6 py-4';
            descriptionCell.textContent = status.description || 'No description provided.';

            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 space-x-2';
            actionsCell.innerHTML = `
                <button class="btn-edit-employee-status font-medium text-blue-600 hover:underline" data-status-id="${status.id}">Edit</button>
                <button class="btn-delete-employee-status font-medium text-red-600 hover:underline" data-status-id="${status.id}">Delete</button>
            `;

            row.append(nameCell, descriptionCell, actionsCell);
            ui.employeeStatusesTableBody.appendChild(row);
        });
    } else {
        // This message is shown if the API returns no data or if the call fails.
        ui.employeeStatusesTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-slate-500">No employee statuses configured yet.</td></tr>`;
    }
}

/**
 * Displays the modal for adding or editing an employee status.
 * @param {object|null} status - The status object to edit, or null to add a new one.
 */
export function showEmployeeStatusModal(status = null) {
    ui.employeeStatusForm.reset();
    const isEdit = status !== null;

    ui.employeeStatusModalTitle.textContent = isEdit ? 'Edit Employee Status' : 'Add New Employee Status';
    document.getElementById('employee-status-id').value = isEdit ? status.id : '';
    document.getElementById('employee-status-name').value = isEdit ? (status.name || '') : '';
    document.getElementById('employee-status-description').value = isEdit ? (status.description || '') : '';

    ui.employeeStatusModal.classList.remove('hidden');
    ui.employeeStatusModal.classList.add('flex');
}

/**
 * Hides the modal for adding or editing an employee status.
 */
export function hideEmployeeStatusModal() {
    ui.employeeStatusModal.classList.add('hidden');
    ui.employeeStatusModal.classList.remove('flex');
}

/**
 * Handles the submission of the employee status form.
 * @param {Event} e - The form submission event.
 */
export async function handleEmployeeStatusFormSubmit(e) {
    e.preventDefault();
    if (!ui.employeeStatusForm.checkValidity()) {
        ui.employeeStatusForm.reportValidity();
        return;
    }

    const statusId = document.getElementById('employee-status-id').value;
    const statusData = {
        name: document.getElementById('employee-status-name').value,
        description: document.getElementById('employee-status-description').value,
    };

    const endpoint = statusId ? `/admin/employee-statuses/${statusId}` : '/admin/employee-statuses';
    const method = statusId ? 'PUT' : 'POST';

    const result = await fetchData(endpoint, {
        method: method,
        body: JSON.stringify(statusData),
        headers: { 'Content-Type': 'application/json' }
    });

    if (result) {
        hideEmployeeStatusModal();
        await loadEmployeeStatuses();
    }
}

/**
 * Fetches a single employee status and shows the edit modal.
 * @param {string} statusId - The ID of the status to edit.
 */
async function handleEditEmployeeStatus(statusId) {
    const status = await fetchData(`/admin/employee-statuses/${statusId}`);
    if (status) {
        if (!status.id) status.id = statusId;
        showEmployeeStatusModal(status);
    }
}

/**
 * Deletes an employee status after confirmation.
 * @param {string} statusId - The ID of the status to delete.
 */
async function handleDeleteEmployeeStatus(statusId) {
    if (confirm('Are you sure you want to delete this employee status?')) {
        const result = await fetchData(`/admin/employee-statuses/${statusId}`, { method: 'DELETE' });
        if (result) await loadEmployeeStatuses();
    }
}

/**
 * Initializes event listeners for the employee statuses table and add button.
 */
export function initEmployeeStatusEventListeners() {
    // Event delegation for edit and delete buttons in the table
    ui.employeeStatusesTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-employee-status');
        if (editBtn) {
            e.preventDefault();
            handleEditEmployeeStatus(editBtn.dataset.statusId);
        }

        const deleteBtn = e.target.closest('.btn-delete-employee-status');
        if (deleteBtn) {
            e.preventDefault();
            handleDeleteEmployeeStatus(deleteBtn.dataset.statusId);
        }
    });
}