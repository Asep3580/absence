import { fetchData } from './api.js';

/**
 * This file contains all functions related to generating reports.
 */

/**
 * Initializes the attendance report page.
 * - Sets default date range.
 * - Populates department filter.
 * - Adds event listeners.
 */
export async function initAttendanceReportPage() {
    // Set default dates (e.g., this month)
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startDateInput = document.getElementById('report-start-date');
    const endDateInput = document.getElementById('report-end-date');
    if (startDateInput) {
        startDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
    }
    if (endDateInput) {
        endDateInput.value = lastDayOfMonth.toISOString().split('T')[0];
    }

    // Populate department filter
    const departmentSelect = document.getElementById('report-department-filter');
    if (departmentSelect) {
        try {
            const departments = await fetchData('/admin/departments');
            if (departments) {
                departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.id;
                    option.textContent = dept.name;
                    departmentSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load departments for report filter:', error);
        }
    }

    // Add event listener for generate button
    const generateBtn = document.getElementById('btn-generate-attendance-report');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerateAttendanceReport);
    }
    
    // Add event listener for export button
    const exportBtn = document.getElementById('btn-export-generated-report');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportAttendanceReport);
    }

    // Add event listener for details buttons via delegation
    const tableBody = document.getElementById('attendance-report-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', handleDailyLogButtonClick);
    }

    // Add event listener for closing the new modal
    const closeBtn = document.getElementById('btn-close-daily-log-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('daily-log-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
    }
}

/**
 * Handles the "Generate Report" button click.
 */
async function handleGenerateAttendanceReport() {
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    const departmentId = document.getElementById('report-department-filter').value;

    if (!startDate || !endDate) {
        alert('Please select both a start and end date.');
        return;
    }

    const resultsContainer = document.getElementById('attendance-report-results-container');
    const placeholder = document.getElementById('attendance-report-placeholder');
    const tableBody = document.getElementById('attendance-report-table-body');
    
    placeholder.classList.add('hidden');
    resultsContainer.classList.remove('hidden');

    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center py-8">
                <div class="flex items-center justify-center text-slate-500">
                    <i data-lucide="loader-2" class="animate-spin mr-2"></i>
                    <span>Generating report...</span>
                </div>
            </td>
        </tr>`;
    lucide.createIcons();

    try {
        const query = new URLSearchParams({
            startDate,
            endDate,
            departmentId: departmentId || ''
        }).toString();

        // NOTE: This endpoint is assumed to exist. You will need to create it on your backend.
        const reportData = await fetchData(`/admin/reports/attendance?${query}`);

        renderAttendanceReport(reportData, { startDate, endDate });
    } catch (error) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-8 text-red-500">
                    Failed to generate report: ${error.message}
                </td>
            </tr>`;
    }
}

/**
 * Renders the generated attendance report data into the table.
 * @param {Array<object>} data - The report data from the API.
 * @param {object} filters - The filters used for the report.
 */
function renderAttendanceReport(data, filters) {
    const tableBody = document.getElementById('attendance-report-table-body');
    const summaryText = document.getElementById('report-summary-text');

    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-CA');
    summaryText.textContent = `Report for ${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`;

    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-8 text-slate-500">
                    No attendance data found for the selected criteria.
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'bg-white border-b hover:bg-slate-50';
        
        const attendancePercentage = row.totalWorkdays > 0 ? ((row.present / row.totalWorkdays) * 100).toFixed(1) : '0.0';
        const percentageColor = attendancePercentage >= 90 ? 'text-green-600' : attendancePercentage >= 75 ? 'text-orange-500' : 'text-red-600';
        const inactiveBadge = row.isActive === false
            ? `<span class="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">Resigned</span>`
            : '';

        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                <div class="font-semibold">${row.fullName || row.username}${inactiveBadge}</div>
                <div class="text-xs text-slate-500">${row.departmentName || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 text-center">${row.present || 0}</td>
            <td class="px-6 py-4 text-center">${row.absent || 0}</td>
            <td class="px-6 py-4 text-center">${row.late || 0}</td>
            <td class="px-6 py-4 text-center">${row.onLeave || 0}</td>
            <td class="px-6 py-4 text-center font-medium">${row.totalWorkdays || 0}</td>
            <td class="px-6 py-4 text-center font-bold ${percentageColor}">${attendancePercentage}%</td>
            <td class="px-6 py-4 text-center">
                <button class="btn-view-daily-log text-blue-600 hover:text-blue-800 text-sm font-medium" 
                        data-user-id="${row.userId}" 
                        data-user-name="${row.fullName || row.username}">
                    Details
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

/**
 * Handles exporting the generated report table to an Excel file.
 */
function handleExportAttendanceReport() {
    const table = document.getElementById('attendance-report-table');
    if (!table) {
        alert('No report data to export.');
        return;
    }

    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    const filename = `Attendance_Report_${startDate}_to_${endDate}.xlsx`;

    // Convert table to worksheet
    const ws = XLSX.utils.table_to_sheet(table);

    // Create a new workbook and append the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');

    // Write the workbook and trigger download
    XLSX.writeFile(wb, filename);
}

/**
 * Handles clicks within the report table body, delegating to the correct function.
 * @param {Event} e The click event.
 */
function handleDailyLogButtonClick(e) {
    const detailsButton = e.target.closest('.btn-view-daily-log');
    if (detailsButton) {
        const userId = detailsButton.dataset.userId;
        const userName = detailsButton.dataset.userName;
        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;
        
        showDailyLogModal(userId, userName, startDate, endDate);
    }
}

/**
 * Shows the daily log modal and fetches the data for the selected employee.
 * @param {string} userId 
 * @param {string} userName 
 * @param {string} startDate 
 * @param {string} endDate 
 */
async function showDailyLogModal(userId, userName, startDate, endDate) {
    const modal = document.getElementById('daily-log-modal');
    const modalTitle = document.getElementById('daily-log-modal-title');
    const modalSubtitle = document.getElementById('daily-log-modal-subtitle');
    const modalBody = document.getElementById('daily-log-modal-body');

    modalTitle.textContent = `Daily Log for ${userName}`;
    modalSubtitle.textContent = `From ${startDate} to ${endDate}`;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    modalBody.innerHTML = `
        <div class="text-center py-8">
            <div class="flex items-center justify-center text-slate-500">
                <i data-lucide="loader-2" class="animate-spin mr-2"></i>
                <span>Loading daily log...</span>
            </div>
        </div>`;
    lucide.createIcons();

    try {
        // This endpoint needs to be created on the backend
        const query = new URLSearchParams({ startDate, endDate }).toString();
        const logData = await fetchData(`/admin/reports/attendance/${userId}/log?${query}`);
        renderDailyLog(logData, modalBody);
    } catch (error) {
        modalBody.innerHTML = `<div class="text-center py-8 text-red-500">Failed to load daily log: ${error.message}</div>`;
    }
}

/**
 * Renders the daily log data into the modal body.
 * @param {Array<object>} logData The daily log data from the API.
 * @param {HTMLElement} container The modal body element.
 */
function renderDailyLog(logData, container) {
    if (!logData || logData.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-500">No daily records found for this period.</div>`;
        return;
    }

    container.innerHTML = '<div class="space-y-3"></div>';
    const listContainer = container.querySelector('.space-y-3');

    const timeFormat = { hour: '2-digit', minute: '2-digit', hour12: true };
    const dateFormat = { weekday: 'long', day: 'numeric', month: 'short' };

    logData.forEach(record => {
        const recordDate = new Date(record.assignmentDate + 'T00:00:00'); // Ensure local timezone interpretation
        const card = document.createElement('div');
        card.className = 'bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center space-x-4';

        const statusMap = {
            'present': { text: 'Present', icon: 'calendar-check', color: 'green' },
            'absent': { text: 'Absent', icon: 'calendar-x', color: 'red' },
            'on_leave': { text: 'On Leave', icon: 'plane', color: 'blue' },
            'sick': { text: 'Sick', icon: 'thermometer', color: 'yellow' },
            'off': { text: 'Day Off', icon: 'calendar-off', color: 'slate' }
        };
        const statusInfo = statusMap[record.status] || { text: record.status, icon: 'help-circle', color: 'slate' };

        let timeDetails = '';
        if (record.status === 'present') {
            const checkIn = record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('en-US', timeFormat) : '-';
            const checkOut = record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('en-US', timeFormat) : '-';
            let lateInfo = '';
            if (record.isLate && record.lateMinutes) {
                const h = Math.floor(record.lateMinutes / 60);
                const m = record.lateMinutes % 60;
                const lateDuration = h > 0 ? `${h} jam ${m > 0 ? m + ' menit' : ''}`.trim() : `${m} menit`;
                lateInfo = `<span class="text-xs font-semibold text-red-600">(Terlambat ${lateDuration})</span>`;
            }
            timeDetails = `<p class="text-xs text-slate-500">In: ${checkIn} ${lateInfo} / Out: ${checkOut}</p>`;
        } else if (record.status === 'on_leave' || record.status === 'sick') {
            timeDetails = `<p class="text-xs text-slate-500">${record.absenceName || 'N/A'}</p>`;
        }

        card.innerHTML = `
            <div class="flex-shrink-0 p-3 bg-${statusInfo.color}-100 text-${statusInfo.color}-600 rounded-full">
                <i data-lucide="${statusInfo.icon}" class="w-5 h-5"></i>
            </div>
            <div class="flex-1">
                <div class="flex justify-between items-center">
                    <p class="font-semibold text-slate-800">${recordDate.toLocaleDateString('en-US', dateFormat)}</p>
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-${statusInfo.color}-100 text-${statusInfo.color}-800">${statusInfo.text}</span>
                </div>
                ${timeDetails}
            </div>
        `;
        listContainer.appendChild(card);
    });

    lucide.createIcons();
}

/**
 * Initializes the leave report page.
 */
export async function initLeaveReportPage() {
    // Set default dates
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    document.getElementById('leave-report-start-date').value = firstDayOfMonth.toISOString().split('T')[0];
    document.getElementById('leave-report-end-date').value = lastDayOfMonth.toISOString().split('T')[0];

    // Populate filters
    await populateLeaveReportFilters();

    // Add event listeners
    document.getElementById('btn-generate-leave-report').addEventListener('click', handleGenerateLeaveReport);
    document.getElementById('btn-export-leave-report').addEventListener('click', handleExportLeaveReport);
}

/**
 * Populates department and leave type filters for the leave report.
 */
async function populateLeaveReportFilters() {
    const departmentSelect = document.getElementById('leave-report-department-filter');
    const leaveTypeSelect = document.getElementById('leave-report-type-filter');

    try {
        const [departments, absenceTypes] = await Promise.all([
            fetchData('/admin/departments'),
            fetchData('/admin/absence-types')
        ]);

        if (departments && departmentSelect) {
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.id;
                option.textContent = dept.name;
                departmentSelect.appendChild(option);
            });
        }

        if (absenceTypes && leaveTypeSelect) {
            // Filter for types that are 'leave' or 'sick'
            const leaveCategories = ['leave', 'sick'];
            absenceTypes.filter(at => leaveCategories.includes(at.category)).forEach(type => {
                const option = document.createElement('option');
                option.value = type.id;
                option.textContent = type.name;
                leaveTypeSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load filters for leave report:', error);
    }
}

/**
 * Handles the "Generate Leave Report" button click.
 */
async function handleGenerateLeaveReport() {
    const startDate = document.getElementById('leave-report-start-date').value;
    const endDate = document.getElementById('leave-report-end-date').value;
    const departmentId = document.getElementById('leave-report-department-filter').value;
    const leaveTypeId = document.getElementById('leave-report-type-filter').value;

    if (!startDate || !endDate) {
        alert('Please select both a start and end date.');
        return;
    }

    const resultsContainer = document.getElementById('leave-report-results-container');
    const placeholder = document.getElementById('leave-report-placeholder');
    const tableBody = document.getElementById('leave-report-table-body');
    
    placeholder.classList.add('hidden');
    resultsContainer.classList.remove('hidden');

    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-8">
                <div class="flex items-center justify-center text-slate-500">
                    <i data-lucide="loader-2" class="animate-spin mr-2"></i>
                    <span>Generating report...</span>
                </div>
            </td>
        </tr>`;
    lucide.createIcons();

    try {
        const query = new URLSearchParams({
            startDate,
            endDate,
            departmentId: departmentId || '',
            leaveTypeId: leaveTypeId || ''
        }).toString();

        // This endpoint needs to be created on the backend.
        const reportData = await fetchData(`/admin/reports/leave?${query}`);

        renderLeaveReport(reportData, { startDate, endDate });
    } catch (error) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-red-500">
                    Failed to generate report: ${error.message}
                </td>
            </tr>`;
    }
}

/**
 * Renders the generated leave report data into the table.
 * @param {Array<object>} data - The report data from the API.
 * @param {object} filters - The filters used for the report.
 */
function renderLeaveReport(data, filters) {
    const tableBody = document.getElementById('leave-report-table-body');
    const summaryText = document.getElementById('leave-report-summary-text');

    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-CA');
    summaryText.textContent = `Report for ${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`;

    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-slate-500">
                    No leave data found for the selected criteria.
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = '';
    const dateFormat = { day: 'numeric', month: 'short', year: 'numeric' };

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'bg-white border-b hover:bg-slate-50';
        
        const statusMap = {
            'pending': { text: 'Pending', class: 'bg-orange-100 text-orange-800' },
            'approved': { text: 'Approved', class: 'bg-green-100 text-green-800' },
            'rejected': { text: 'Rejected', class: 'bg-red-100 text-red-800' },
        };
        const statusInfo = statusMap[row.status] || { text: row.status, class: 'bg-slate-100 text-slate-800' };

        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                <div class="font-semibold">${row.fullName || row.username}</div>
                <div class="text-xs text-slate-500">${row.departmentName || 'N/A'}</div>
            </td>
            <td class="px-6 py-4">${row.leaveTypeName || 'N/A'}</td>
            <td class="px-6 py-4">${new Date(row.startDate).toLocaleDateString('en-GB', dateFormat)}</td>
            <td class="px-6 py-4">${new Date(row.endDate).toLocaleDateString('en-GB', dateFormat)}</td>
            <td class="px-6 py-4 text-center">${row.totalDays || 0}</td>
            <td class="px-6 py-4 max-w-xs truncate" title="${row.reason || ''}">${row.reason || '-'}</td>
            <td class="px-6 py-4"><span class="${statusInfo.class} text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">${statusInfo.text}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}

/**
 * Handles exporting the generated leave report table to an Excel file.
 */
function handleExportLeaveReport() {
    const table = document.getElementById('leave-report-table');
    if (!table) {
        alert('No report data to export.');
        return;
    }

    const startDate = document.getElementById('leave-report-start-date').value;
    const endDate = document.getElementById('leave-report-end-date').value;
    const filename = `Leave_Report_${startDate}_to_${endDate}.xlsx`;

    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leave Report');
    XLSX.writeFile(wb, filename);
}