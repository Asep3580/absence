import { fetchData } from './api.js';
import { ui } from './admin.js';

/**
 * This file contains all functions related to absence type management.
 */

/**
 * Loads and displays the list of absence types.
 */
export async function loadAbsenceTypes() {
    if (!ui.absenceTypesTableBody) return;
    ui.absenceTypesTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4"><div class="flex items-center justify-center text-slate-500"><i data-lucide="loader-2" class="animate-spin mr-2"></i>Loading absence types...</div></td></tr>`;
    lucide.createIcons();

    const absenceTypes = await fetchData('/admin/absence-types');
    ui.absenceTypesTableBody.innerHTML = ''; // Clear the table
    if (absenceTypes && absenceTypes.length > 0) {
        absenceTypes.forEach(type => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b';
            row.innerHTML = `
                <td class="px-6 py-4 font-mono text-slate-900">${type.code}</td>
                <td class="px-6 py-4">${type.name}</td>
                <td class="px-6 py-4 text-slate-500">${type.description || '-'}</td>
                <td class="px-6 py-4 capitalize">${(type.category || 'other').replace('_', ' ')}</td>
                <td class="px-6 py-4 space-x-2">
                    <button class="btn-edit-absence-type font-medium text-blue-600 hover:underline" data-type-id="${type.id}">Edit</button>
                    <button class="btn-delete-absence-type font-medium text-red-600 hover:underline" data-type-id="${type.id}">Delete</button>
                </td>
            `;
            ui.absenceTypesTableBody.appendChild(row);
        });
    } else {
        ui.absenceTypesTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-slate-500">No absence types configured yet.</td></tr>`;
    }
}

/**
 * Displays the modal for adding or editing an absence type.
 * @param {object|null} type - The type object to edit, or null for adding a new one.
 */
export function showAbsenceTypeModal(type = null) {
    ui.absenceTypeForm.reset();
    const isEdit = type !== null;

    ui.absenceTypeModalTitle.textContent = isEdit ? 'Edit Absence Type' : 'Add New Absence Type';
    document.getElementById('absence-type-id').value = isEdit ? type.id : '';
    document.getElementById('absence-type-code').value = isEdit ? (type.code || '') : '';
    document.getElementById('absence-type-name').value = isEdit ? (type.name || '') : '';
    document.getElementById('absence-type-description').value = isEdit ? (type.description || '') : '';
    document.getElementById('absence-type-category').value = isEdit ? (type.category || 'leave') : 'leave';

    ui.absenceTypeModal.classList.remove('hidden');
    ui.absenceTypeModal.classList.add('flex');
}

export function hideAbsenceTypeModal() {
    ui.absenceTypeModal.classList.add('hidden');
    ui.absenceTypeModal.classList.remove('flex');
}

export async function handleAbsenceTypeFormSubmit(e) {
    e.preventDefault();
    if (!ui.absenceTypeForm.checkValidity()) {
        ui.absenceTypeForm.reportValidity();
        return;
    }

    const typeId = document.getElementById('absence-type-id').value;
    const typeData = {
        code: document.getElementById('absence-type-code').value,
        name: document.getElementById('absence-type-name').value,
        description: document.getElementById('absence-type-description').value,
        category: document.getElementById('absence-type-category').value,
    };

    const endpoint = typeId ? `/admin/absence-types/${typeId}` : '/admin/absence-types';
    const method = typeId ? 'PUT' : 'POST';

    const result = await fetchData(endpoint, {
        method: method,
        body: JSON.stringify(typeData),
        headers: { 'Content-Type': 'application/json' }
    });

    if (result) {
        hideAbsenceTypeModal();
        await loadAbsenceTypes();
    }
}

async function handleEditAbsenceType(typeId) {
    const type = await fetchData(`/admin/absence-types/${typeId}`);
    if (type) {
        if (!type.id) type.id = typeId;
        showAbsenceTypeModal(type);
    }
}

async function handleDeleteAbsenceType(typeId) {
    if (confirm('Are you sure you want to delete this absence type? This might affect existing schedules.')) {
        const result = await fetchData(`/admin/absence-types/${typeId}`, { method: 'DELETE' });
        if (result) {
            await loadAbsenceTypes();
        }
    }
}

/**
 * Initializes event listeners for the absence types table using event delegation.
 */
export function initAbsenceTypeEventListeners() {
    if (!ui.absenceTypesTableBody) return;
    ui.absenceTypesTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-absence-type');
        if (editBtn) {
            e.preventDefault();
            handleEditAbsenceType(editBtn.dataset.typeId);
        }

        const deleteBtn = e.target.closest('.btn-delete-absence-type');
        if (deleteBtn) {
            e.preventDefault();
            handleDeleteAbsenceType(deleteBtn.dataset.typeId);
        }
    });
}