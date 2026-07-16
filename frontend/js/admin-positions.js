import { fetchData } from './api.js';
import { ui } from './admin.js';

/**
 * This file contains all functions related to position management.
 * It must be loaded before admin.js.
 */
/**
 * Loads and displays the list of positions.
 */
export async function loadPositions() {
    const positions = await fetchData('/admin/positions');
    ui.positionsTableBody.innerHTML = ''; // Clear the table
    if (positions && positions.length > 0) {
        positions.forEach(position => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b';

            const nameCell = document.createElement('td');
            nameCell.className = 'px-6 py-4 font-medium text-slate-900';
            nameCell.textContent = position.name;

            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 space-x-2';
            actionsCell.innerHTML = `
                    <button class="btn-edit-position font-medium text-blue-600 hover:underline" data-position-id="${position.id}">Edit</button>
                    <button class="btn-delete-position font-medium text-red-600 hover:underline" data-position-id="${position.id}">Delete</button>
            `;

            row.appendChild(nameCell);
            row.appendChild(actionsCell);
            ui.positionsTableBody.appendChild(row);
        });
    } else {
        ui.positionsTableBody.innerHTML = `<tr><td colspan="2" class="text-center py-4">No positions configured yet.</td></tr>`;
    }

}

/**
 * Displays the modal for adding or editing a position.
 * @param {object|null} position - The position object to edit, or null to add a new one.
 */
export function showPositionModal(position = null) {
    ui.positionForm.reset();
    const isEdit = position !== null;

    ui.positionModalTitle.textContent = isEdit ? 'Edit Position' : 'Add New Position';
    document.getElementById('position-id').value = isEdit ? position.id : '';
    document.getElementById('position-name').value = isEdit ? (position.name || '') : '';

    ui.positionModal.classList.remove('hidden');
    ui.positionModal.classList.add('flex');
}

export function hidePositionModal() {
    ui.positionModal.classList.add('hidden');
    ui.positionModal.classList.remove('flex');
}

export async function handlePositionFormSubmit(e) {
    e.preventDefault();
    if (!ui.positionForm.checkValidity()) {
        ui.positionForm.reportValidity();
        return;
    }

    const positionId = document.getElementById('position-id').value;
    const positionData = {
        name: document.getElementById('position-name').value,
    };

    const endpoint = positionId ? `/admin/positions/${positionId}` : '/admin/positions';
    const method = positionId ? 'PUT' : 'POST';

    const result = await fetchData(endpoint, {
        method: method,
        body: JSON.stringify(positionData),
        headers: { 'Content-Type': 'application/json' }
    });

    if (result) {
        hidePositionModal();
        await loadPositions();
    }
}

async function handleEditPosition(positionId) {
    const position = await fetchData(`/admin/positions/${positionId}`);
    if (position) {
        // Defensively ensure the ID is on the object if the API is inconsistent
        if (!position.id) {
            position.id = positionId;
        }
        showPositionModal(position);
    }
}

async function handleDeletePosition(positionId) {
    if (confirm('Are you sure you want to delete this position?')) {
        const result = await fetchData(`/admin/positions/${positionId}`, { method: 'DELETE' });
        if (result) {
            await loadPositions();
        }
    }
}

/**
 * Initializes event listeners for the positions table using event delegation.
 */
export function initPositionEventListeners() {
    ui.positionsTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-position');
        if (editBtn) {
            e.preventDefault();
            handleEditPosition(editBtn.dataset.positionId);
        }

        const deleteBtn = e.target.closest('.btn-delete-position');
        if (deleteBtn) {
            e.preventDefault();
            handleDeletePosition(deleteBtn.dataset.positionId);
        }
    });
}