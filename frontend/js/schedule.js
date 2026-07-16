'use strict';

import { fetchData } from './api.js';
import { toggleModal } from './ui.js';

/**
 * Menghitung ringkasan jadwal dari daftar penugasan harian.
 * @param {Array} assignments - Array of daily assignment objects.
 * @returns {object} - Objek ringkasan (e.g., { work: 20, off: 8, absence: 2, absenceDetails: { AL: 2 } }).
 */
function calculateSummary(assignments) {
    const summary = {
        work: 0,
        off: 0,
        absence: 0,
        absenceDetails: {}
    };

    if (!assignments) return summary;

    assignments.forEach(item => {
        // Backend mengirim 'assignment_type', bukan 'type'
        const type = item.assignment_type;
        if (!type) return;

        // Perbaikan: Penanganan khusus untuk Tipe Absensi dengan kode 'OFF'.
        // Jika ada absensi dengan kode 'OFF', kita anggap itu sebagai hari libur biasa
        // untuk menghindari duplikasi ringkasan di UI.
        if (type === 'absence' && item.absence_code && item.absence_code.toUpperCase() === 'OFF') {
            summary.off++; // Tambahkan ke hitungan 'Off' utama.
            return; // Hentikan proses untuk item ini agar tidak dihitung sebagai 'Absence'.
        }

        // Tambahkan ke penghitung utama (logika asli)
        if (summary.hasOwnProperty(type)) {
            summary[type]++;
        }

        // Jika tipenya 'absence', hitung juga berdasarkan kodenya (misal: AL, SICK)
        if (type === 'absence' && item.absence_code) {
            const code = item.absence_code;
            summary.absenceDetails[code] = (summary.absenceDetails[code] || 0) + 1;
        }
    });

    return summary;
}
/**
 * Renders the user's work schedule for a given month and year.
 * @param {object} app The main application object.
 */
export async function renderSchedule(app) {
    const { month, year } = app.state.currentSchedule;
    const scheduleList = app.dom.scheduleList;
    const monthYearDisplay = app.dom.scheduleMonthYear;
    const summaryContainer = app.dom.scheduleSummaryContainer;

    // 1. Update header and show loading state
    const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long' });
    monthYearDisplay.textContent = `${monthName} ${year}`;
    scheduleList.innerHTML = `
        <div class="text-center py-10 text-gray-500">
            <div class="flex items-center justify-center">
                <i data-lucide="loader-2" class="animate-spin mr-2 w-6 h-6"></i>
                <span>Loading schedule...</span>
            </div>
        </div>`;
    summaryContainer.innerHTML = `
        <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex-1 text-center animate-pulse">
            <p class="h-2 bg-gray-200 rounded w-3/4 mx-auto mb-2"></p>
            <p class="h-4 bg-gray-300 rounded w-1/2 mx-auto"></p>
        </div>`;
    lucide.createIcons();

    // 2. Fetch schedule data from the API
    // The backend needs to provide this endpoint. It should return the user's schedule.
    // The user-specific endpoint for their own schedule.
    const rawData = await fetchData(`/user/schedule?year=${year}&month=${month + 1}`);

    // The frontend should be robust and handle different possible API responses.
    // The ideal response is an object: { assignments: [], summary: {} }
    // A possible response (like the admin panel) is a flat array: []
    let assignments = null;
    let summary = null;

    if (Array.isArray(rawData)) {
        // Case 1: Backend returns a flat array of assignments.
        assignments = rawData;
        // We must calculate the summary on the frontend.
        summary = calculateSummary(assignments);
    } else if (rawData && rawData.assignments) {
        // Case 2: Backend returns the ideal object structure.
        assignments = rawData.assignments;
        summary = rawData.summary || calculateSummary(assignments); // Use provided summary or calculate as a fallback.
    }

    if (assignments === null) {
        scheduleList.innerHTML = `<div class="text-center py-10 text-red-500">Failed to load schedule data. Please try again later.</div>`;
        summaryContainer.innerHTML = `<div class="bg-white p-3 rounded-xl border border-red-200 text-center text-red-600 text-xs font-semibold">Error</div>`;
        return;
    }

    // 3. Process and render the data
    renderSummary(summary, summaryContainer);
    renderList(assignments, scheduleList, app);

    lucide.createIcons();
}

/**
 * Renders the summary cards.
 * @param {object} summary - Summary data from API (e.g., { workDays: 20, offDays: 2 })
 * @param {HTMLElement} container - The container element for the summary cards.
 */
function renderSummary(summary, container) {
    container.innerHTML = ''; // Clear loading state
    if (!summary || (summary.work === 0 && summary.off === 0 && summary.absence === 0)) {
        container.innerHTML = '<p class="text-xs text-gray-400">No summary available.</p>';
        return;
    }

    // Tampilkan kartu ringkasan utama
    const summaryCards = [
        { label: 'Work', value: summary.work || 0, color: 'text-blue-600' },
        { label: 'Off', value: summary.off || 0, color: 'text-gray-600' },
        { label: 'Absence', value: summary.absence || 0, color: 'text-red-600' },
    ];

    summaryCards.forEach(item => {
        container.innerHTML += `
            <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex-1 text-center min-w-[70px]">
                <p class="text-[10px] font-bold text-gray-400 uppercase">${item.label}</p>
                <p class="text-xl font-bold ${item.color}">${item.value}</p>
            </div>`;
    });

    // Tampilkan kartu untuk setiap tipe absensi
    if (summary.absenceDetails) {
        for (const [code, count] of Object.entries(summary.absenceDetails)) {
            container.innerHTML += `
                <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex-1 text-center min-w-[70px]">
                    <p class="text-[10px] font-bold text-gray-400 uppercase">${code}</p>
                    <p class="text-xl font-bold text-orange-600">${count}</p>
                </div>`;
        }
    }
}

/**
 * Renders the list of daily schedules.
 * @param {Array} assignments - Array of daily assignment objects.
 * @param {HTMLElement} listElement - The list container element.
 * @param {object} app - The main application object.
 */
function renderList(assignments, listElement, app) {
    listElement.innerHTML = ''; // Clear loading/previous state

    const { month, year } = app.state.currentSchedule;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Create a map for quick lookups. Key is the day of the month (1-31).
    const assignmentsMap = new Map();
    if (assignments && assignments.length > 0) {
        assignments.forEach(item => {
            // Ensure assignment_date exists and is a valid string
            if (item.assignment_date && typeof item.assignment_date === 'string') {
                // To avoid timezone issues, we only take the date part (YYYY-MM-DD)
                // and parse it as a UTC date. This correctly handles both '2026-06-01'
                // and '2026-05-31T17:00:00.000Z' (which is June 1st in another timezone).
                const dateOnlyString = item.assignment_date.split('T')[0];
                const date = new Date(dateOnlyString + 'T00:00:00Z');
                // Check if the date is valid and belongs to the current month
                if (!isNaN(date.getTime()) && date.getUTCMonth() === month) {
                    const day = date.getUTCDate();
                    assignmentsMap.set(day, item);
                }
            }
        });
    }

    // Loop through all days of the month to build the calendar view
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(year, month, day));
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        const dayNumber = String(day).padStart(2, '0');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentDate = new Date(year, month, day); // Local date for comparison with local today
        const isToday = currentDate.getTime() === today.getTime();
        const isPast = currentDate < today;

        let statusBadge = '';
        let scheduleInfo = '';
        let actionButton = '';

        const item = assignmentsMap.get(day);
        // Response dari backend user schedule memakai field assignment_type & work_schedule_name/absence_name
        const type = item?.assignment_type;
        const name = item?.work_schedule_name || item?.absence_name || 'Day Off';

        if (item && type) { // An actual assignment exists

            switch (type) {
                case 'work':
                    statusBadge = `<div class="px-2 py-0.5 text-[9px] font-bold text-blue-800 bg-blue-100 rounded-full">WORK</div>`;
                    scheduleInfo = `
                        <h4 class="font-bold text-gray-800 text-sm">${name}</h4>
                        <p class="text-xs text-gray-500">${item.start_time?.substring(0, 5) || '--:--'} - ${item.end_time?.substring(0, 5) || '--:--'}</p>
                    `;
                    if (!isPast) {
                        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        actionButton = `
                            <button class="btn-change-schedule p-2 rounded-full text-gray-400 hover:bg-gray-100" data-date="${dateString}" title="Request Change Schedule">
                                <i data-lucide="repeat" class="w-4 h-4 pointer-events-none"></i>
                            </button>`;
                    }
                    break;
                case 'absence':
                    statusBadge = `<div class="px-2 py-0.5 text-[9px] font-bold text-orange-800 bg-orange-100 rounded-full">${item.absence_code || 'ABSENCE'}</div>`;
                    scheduleInfo = `<h4 class="font-bold text-gray-800 text-sm">${name}</h4><p class="text-xs text-gray-500">Not scheduled to work</p>`;
                    break;
                case 'off':
                    statusBadge = `<div class="px-2 py-0.5 text-[9px] font-bold text-gray-800 bg-gray-100 rounded-full">OFF</div>`;
                    scheduleInfo = `<h4 class="font-bold text-gray-800 text-sm">${name}</h4><p class="text-xs text-gray-500">Not scheduled to work</p>`;
                    break;
            }
        } else {
            // Blok ini seharusnya tidak pernah dieksekusi karena backend selalu mengembalikan data untuk setiap hari.
            // Namun, sebagai fallback, kita bisa menampilkannya sebagai hari libur.
            statusBadge = `<div class="px-2 py-0.5 text-[9px] font-bold text-gray-800 bg-gray-100 rounded-full">OFF</div>`;
            scheduleInfo = `<h4 class="font-bold text-gray-800 text-sm">Day Off</h4><p class="text-xs text-gray-500">No scheduled work</p>`;
        }

        const dayElement = document.createElement('div');
        dayElement.className = `bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 ${isToday ? 'ring-2 ring-blue-500' : ''} ${isPast ? 'opacity-60' : ''}`;
        dayElement.innerHTML = `
            <div class="text-center w-12">
                <p class="text-[10px] font-bold ${date.getUTCDay() === 0 ? 'text-red-500' : 'text-gray-500'} uppercase">${dayName}</p>
                <p class="text-2xl font-bold text-gray-800">${dayNumber}</p>
            </div>
            <div class="h-12 w-px bg-gray-100"></div>
            <div class="flex-1">
                ${scheduleInfo}
            </div>
            <div class="flex flex-col items-center space-y-1 w-16 text-center">
                ${statusBadge}
                ${actionButton}
            </div>
        `;
        listElement.appendChild(dayElement);
    }

    // Add event listeners for the change schedule buttons
    listElement.querySelectorAll('.btn-change-schedule').forEach(button => {
        button.addEventListener('click', (e) => {
            const date = e.currentTarget.dataset.date;
            openChangeScheduleModal(app, date);
        });
    });
}

/**
 * Opens the change schedule modal and populates it with data.
 * @param {object} app The main application object.
 * @param {string} date The selected date for the change.
 */
async function openChangeScheduleModal(app, date) {
    // Store raw date value for the submit handler to read
    const hiddenDate = document.getElementById('cs-selected-date');
    if (hiddenDate) hiddenDate.value = date;

    // Set the human-readable date in the modal
    const dateDisplay = document.getElementById('change-schedule-date');
    if (dateDisplay) {
        dateDisplay.textContent = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    const colleagueSelect = document.getElementById('cs-employee');
    const shiftSelect = document.getElementById('cs-target-shift');

    // Set loading states
    colleagueSelect.innerHTML = '<option value="">Loading colleagues...</option>';
    colleagueSelect.disabled = true;
    shiftSelect.innerHTML = '<option value="">Loading shifts...</option>';
    shiftSelect.disabled = true;

    toggleModal('change-schedule-modal', true);

    // Fetch data in parallel
    const [colleagues, workSchedules] = await Promise.all([
        fetchData('/user/colleagues'),
        fetchData('/user/work-schedules') // Use the new user-accessible endpoint
    ]);

    // Populate colleagues dropdown
    if (colleagues) {
        colleagueSelect.innerHTML = '<option value="">-- Select Colleague --</option>';
        colleagues.forEach(colleague => {
            const option = document.createElement('option');
            option.value = colleague.id;
            option.textContent = `${colleague.fullName} (${colleague.positionName || 'N/A'})`;
            colleagueSelect.appendChild(option);
        });
        colleagueSelect.disabled = false;
    } else {
        colleagueSelect.innerHTML = '<option value="">Failed to load colleagues</option>';
    }

    // Populate target shifts dropdown
    if (workSchedules) {
        shiftSelect.innerHTML = '<option value="">-- Select Target Shift --</option>';
        workSchedules.forEach(schedule => {
            const option = document.createElement('option');
            option.value = schedule.id;
            option.textContent = `${schedule.name} (${schedule.start_time?.substring(0,5)} - ${schedule.end_time?.substring(0,5)})`;
            shiftSelect.appendChild(option);
        });
        shiftSelect.disabled = false;
    } else {
        shiftSelect.innerHTML = '<option value="">Failed to load shifts</option>';
    }
}