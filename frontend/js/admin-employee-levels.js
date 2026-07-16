import { fetchData } from './api.js';
import { ui } from './admin.js';

/**
 * This file contains all functions related to employee level management.
 */

/**
 * Loads and displays the list of employee levels.
 */
export async function loadEmployeeLevels() {
    // Assuming the endpoint is /admin/employee-levels
    const levels = await fetchData('/admin/employee-levels');
    ui.employeeLevelsTableBody.innerHTML = ''; // Clear the table
    if (levels && levels.length > 0) {
        levels.forEach(level => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b';
            
            const nameCell = document.createElement('td');
            nameCell.className = 'px-6 py-4 font-medium text-slate-900';
            nameCell.textContent = level.name;

            const descriptionCell = document.createElement('td');
            descriptionCell.className = 'px-6 py-4';
            descriptionCell.textContent = level.description || '-';

            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 space-x-2';
            actionsCell.innerHTML = `
                <button class="btn-edit-employee-level font-medium text-blue-600 hover:underline" data-level-id="${level.id}">Edit</button>
                <button class="btn-delete-employee-level font-medium text-red-600 hover:underline" data-level-id="${level.id}">Delete</button>`;

            row.appendChild(nameCell);
            row.appendChild(descriptionCell);
            row.appendChild(actionsCell);
            ui.employeeLevelsTableBody.appendChild(row);
        });
    } else {
        ui.employeeLevelsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-slate-500">No employee levels configured yet.</td></tr>`;
    }
}

/**
 * Displays the modal for adding or editing an employee level.
 * @param {object|null} level - The level object to edit, or null for adding a new level.
 */
export function showEmployeeLevelModal(level = null) {
    ui.employeeLevelForm.reset();
    const isEdit = level !== null;

    ui.employeeLevelModalTitle.textContent = isEdit ? 'Edit Employee Level' : 'Add New Employee Level';
    document.getElementById('employee-level-id').value = isEdit ? level.id : '';
    document.getElementById('employee-level-name').value = isEdit ? (level.name || '') : '';
    document.getElementById('employee-level-description').value = isEdit ? (level.description || '') : '';

    ui.employeeLevelModal.classList.remove('hidden');
    ui.employeeLevelModal.classList.add('flex');
}

/**
 * Hides the modal for employee levels.
 */
export function hideEmployeeLevelModal() {
    ui.employeeLevelModal.classList.add('hidden');
    ui.employeeLevelModal.classList.remove('flex');
}

/**
 * Handles the submission of the employee level form.
 * @param {Event} e - The form submission event.
 */
export async function handleEmployeeLevelFormSubmit(e) {
    e.preventDefault();
    if (!ui.employeeLevelForm.checkValidity()) {
        ui.employeeLevelForm.reportValidity();
        return;
    }

    const levelId = document.getElementById('employee-level-id').value;
    const levelData = {
        name: document.getElementById('employee-level-name').value,
        description: document.getElementById('employee-level-description').value,
    };

    const endpoint = levelId ? `/admin/employee-levels/${levelId}` : '/admin/employee-levels';
    const method = levelId ? 'PUT' : 'POST';

    const result = await fetchData(endpoint, {
        method: method,
        body: JSON.stringify(levelData),
        headers: { 'Content-Type': 'application/json' }
    });

    if (result) {
        hideEmployeeLevelModal();
        await loadEmployeeLevels();
    }
}

async function handleEditEmployeeLevel(levelId) {
    const level = await fetchData(`/admin/employee-levels/${levelId}`);
    if (level) {
        if (!level.id) level.id = levelId;
        showEmployeeLevelModal(level);
    }
}

async function handleDeleteEmployeeLevel(levelId) {
    if (confirm('Are you sure you want to delete this employee level?')) {
        const result = await fetchData(`/admin/employee-levels/${levelId}`, { method: 'DELETE' });
        if (result) {
            await loadEmployeeLevels();
        }
    }
}

/**
 * Initializes event listeners for the employee levels table using event delegation.
 */
export function initEmployeeLevelEventListeners() {
    ui.employeeLevelsTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-employee-level');
        if (editBtn) {
            e.preventDefault();
            handleEditEmployeeLevel(editBtn.dataset.levelId);
        }

        const deleteBtn = e.target.closest('.btn-delete-employee-level');
        if (deleteBtn) {
            e.preventDefault();
            handleDeleteEmployeeLevel(deleteBtn.dataset.levelId);
        }
    });
}