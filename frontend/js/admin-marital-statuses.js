import { fetchData } from './api.js';
import { ui } from './admin.js';

/**
 * This file contains all functions related to marital status management.
 */

/**
 * Loads and displays the list of marital statuses from the API.
 */
export async function loadMaritalStatuses() {
    const statuses = await fetchData('/admin/marital-statuses');
    
    ui.maritalStatusesTableBody.innerHTML = ''; // Clear the table
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
                <button class="btn-edit-marital-status font-medium text-blue-600 hover:underline" data-status-id="${status.id}">Edit</button>
                <button class="btn-delete-marital-status font-medium text-red-600 hover:underline" data-status-id="${status.id}">Delete</button>
            `;

            row.append(nameCell, descriptionCell, actionsCell);
            ui.maritalStatusesTableBody.appendChild(row);
        });
    } else {
        ui.maritalStatusesTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-slate-500">No marital statuses configured yet.</td></tr>`;
    }
}

/**
 * Displays the modal for adding or editing a marital status.
 * @param {object|null} status - The status object to edit, or null to add a new one.
 */
export function showMaritalStatusModal(status = null) {
    ui.maritalStatusForm.reset();
    const isEdit = status !== null;

    ui.maritalStatusModalTitle.textContent = isEdit ? 'Edit Marital Status' : 'Add New Marital Status';
    document.getElementById('marital-status-id').value = isEdit ? status.id : '';
    document.getElementById('marital-status-name').value = isEdit ? (status.name || '') : '';
    document.getElementById('marital-status-description').value = isEdit ? (status.description || '') : '';

    ui.maritalStatusModal.classList.remove('hidden');
    ui.maritalStatusModal.classList.add('flex');
}

/**
 * Hides the modal for adding or editing a marital status.
 */
export function hideMaritalStatusModal() {
    ui.maritalStatusModal.classList.add('hidden');
    ui.maritalStatusModal.classList.remove('flex');
}

/**
 * Handles the submission of the marital status form.
 * @param {Event} e - The form submission event.
 */
export async function handleMaritalStatusFormSubmit(e) {
    e.preventDefault();
    if (!ui.maritalStatusForm.checkValidity()) {
        ui.maritalStatusForm.reportValidity();
        return;
    }

    const statusId = document.getElementById('marital-status-id').value;
    const statusData = {
        name: document.getElementById('marital-status-name').value,
        description: document.getElementById('marital-status-description').value,
    };

    const endpoint = statusId ? `/admin/marital-statuses/${statusId}` : '/admin/marital-statuses';
    const method = statusId ? 'PUT' : 'POST';

    const result = await fetchData(endpoint, { method, body: JSON.stringify(statusData), headers: { 'Content-Type': 'application/json' } });

    if (result) {
        hideMaritalStatusModal();
        await loadMaritalStatuses();
    }
}

async function handleEditMaritalStatus(statusId) {
    const status = await fetchData(`/admin/marital-statuses/${statusId}`);
    if (status) {
        if (!status.id) status.id = statusId;
        showMaritalStatusModal(status);
    }
}

async function handleDeleteMaritalStatus(statusId) {
    if (confirm('Are you sure you want to delete this marital status?')) {
        const result = await fetchData(`/admin/marital-statuses/${statusId}`, { method: 'DELETE' });
        if (result) await loadMaritalStatuses();
    }
}

export function initMaritalStatusEventListeners() {
    ui.maritalStatusesTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-marital-status');
        if (editBtn) e.preventDefault(), handleEditMaritalStatus(editBtn.dataset.statusId);

        const deleteBtn = e.target.closest('.btn-delete-marital-status');
        if (deleteBtn) e.preventDefault(), handleDeleteMaritalStatus(deleteBtn.dataset.statusId);
    });
}
