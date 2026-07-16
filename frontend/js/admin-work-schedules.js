import { fetchData } from './api.js';
import { ui } from './admin.js';

/**
 * This file contains all functions related to work schedule management.
 * It must be loaded before admin.js.
 */
/**
 * Loads and displays the list of work schedules.
 */
export async function loadWorkSchedules() {
    const schedules = await fetchData('/admin/work-schedules');

    // Directly get the element to avoid potential issues with module import timing.
    const tableBody = document.getElementById('work-schedules-table-body');
    if (!tableBody) {
        console.error("Work schedules table body not found in the DOM.");
        return;
    }

    tableBody.innerHTML = ''; // Clear the table
    if (schedules && schedules.length > 0) {
        schedules.forEach(schedule => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b border-slate-300 hover:bg-slate-50';

            const codeCell = document.createElement('td');
            codeCell.className = 'px-6 py-4 font-medium text-slate-900';
            codeCell.textContent = schedule.code;

            const nameCell = document.createElement('td');
            nameCell.className = 'px-6 py-4';
            nameCell.textContent = schedule.name;

            const startCell = document.createElement('td');
            startCell.className = 'px-6 py-4';
            startCell.textContent = schedule.start_time;

            const endCell = document.createElement('td');
            endCell.className = 'px-6 py-4';
            endCell.textContent = schedule.end_time;

            const actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 space-x-2';
            actionsCell.innerHTML = `
                    <button class="btn-edit-work-schedule font-medium text-blue-600 hover:underline" data-schedule-id="${schedule.id}">Edit</button>
                    <button class="btn-delete-work-schedule font-medium text-red-600 hover:underline" data-schedule-id="${schedule.id}">Delete</button>
            `;

            row.append(codeCell, nameCell, startCell, endCell, actionsCell);
            tableBody.appendChild(row);
        });
    } else {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No work schedules configured yet.</td></tr>`;
    }

}

/**
 * Displays the modal for adding or editing a work schedule.
 * @param {object|null} schedule - The schedule object to edit, or null to add a new one.
 */
export function showWorkScheduleModal(schedule = null) {
    ui.workScheduleForm.reset();
    const isEdit = schedule !== null;

    ui.workScheduleModalTitle.textContent = isEdit ? 'Edit Work Schedule' : 'Add New Work Schedule';
    document.getElementById('work-schedule-id').value = isEdit ? schedule.id : '';
    document.getElementById('work-schedule-code').value = isEdit ? (schedule.code || '') : '';
    document.getElementById('work-schedule-name').value = isEdit ? (schedule.name || '') : '';
    document.getElementById('work-schedule-start-time').value = isEdit ? (schedule.start_time || '') : '';
    document.getElementById('work-schedule-end-time').value = isEdit ? (schedule.end_time || '') : '';

    ui.workScheduleModal.classList.remove('hidden');
    ui.workScheduleModal.classList.add('flex');
}

export function hideWorkScheduleModal() {
    ui.workScheduleModal.classList.add('hidden');
    ui.workScheduleModal.classList.remove('flex');
}

export async function handleWorkScheduleFormSubmit(e) {
    e.preventDefault();
    if (!ui.workScheduleForm.checkValidity()) {
        ui.workScheduleForm.reportValidity();
        return;
    }

    const scheduleId = document.getElementById('work-schedule-id').value;
    const scheduleData = {
        code: document.getElementById('work-schedule-code').value,
        name: document.getElementById('work-schedule-name').value,
        start_time: document.getElementById('work-schedule-start-time').value,
        end_time: document.getElementById('work-schedule-end-time').value,
    };

    const endpoint = scheduleId ? `/admin/work-schedules/${scheduleId}` : '/admin/work-schedules';
    const method = scheduleId ? 'PUT' : 'POST';

    const result = await fetchData(endpoint, { method, body: JSON.stringify(scheduleData), headers: { 'Content-Type': 'application/json' } });

    if (result) {
        hideWorkScheduleModal();
        await loadWorkSchedules();
    }
}

async function handleEditWorkSchedule(scheduleId) {
    const schedule = await fetchData(`/admin/work-schedules/${scheduleId}`);
    if (schedule) {
        // Defensively ensure the ID is on the object if the API is inconsistent
        if (!schedule.id) {
            schedule.id = scheduleId;
        }
        showWorkScheduleModal(schedule);
    }
}

async function handleDeleteWorkSchedule(scheduleId) {
    if (confirm('Are you sure you want to delete this work schedule?')) {
        const result = await fetchData(`/admin/work-schedules/${scheduleId}`, { method: 'DELETE' });
        if (result) await loadWorkSchedules();
    }
}

/**
 * Initializes event listeners for the work schedules table using event delegation.
 */
export function initWorkScheduleEventListeners() {
    ui.workSchedulesTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-work-schedule');
        if (editBtn) {
            e.preventDefault();
            handleEditWorkSchedule(editBtn.dataset.scheduleId);
        }

        const deleteBtn = e.target.closest('.btn-delete-work-schedule');
        if (deleteBtn) {
            e.preventDefault();
            handleDeleteWorkSchedule(deleteBtn.dataset.scheduleId);
        }
    });
}