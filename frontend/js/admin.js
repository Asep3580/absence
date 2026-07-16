import { state, logout, fetchData, API_URL } from './api.js';
import { loadEmployeeTable, showEmployeeProfile, handleEmployeeSearch, showProfileDetailsModal, hideProfileDetailsModal, handleProfileDetailsFormSubmit, showAddEmployeeModal, hideAddEmployeeModal, handleAddEmployeeFormSubmit, showBulkImportModal, initBulkImportEvents } from './admin-employees.js';
import { loadUsers, handleUserSearch, showUserModal, hideUserModal, handleUserFormSubmit as handleUserSubmit, initUserEventListeners } from './admin-users.js';
import { loadRoles, showRoleModal, hideRoleModal, handleRoleFormSubmit as handleRoleSubmit, initRoleEventListeners } from './admin-roles.js';
import { loadPositions, showPositionModal, hidePositionModal, handlePositionFormSubmit as handlePositionSubmit, initPositionEventListeners } from './admin-positions.js';
import { loadDepartments, showDepartmentModal, hideDepartmentModal, handleDepartmentFormSubmit as handleDepartmentSubmit, initDepartmentEventListeners } from './admin-departments.js';
import { loadWorkSchedules, showWorkScheduleModal, hideWorkScheduleModal, handleWorkScheduleFormSubmit as handleWorkScheduleSubmit, initWorkScheduleEventListeners } from './admin-work-schedules.js';
import { loadEmployeeStatuses, initEmployeeStatusEventListeners, showEmployeeStatusModal, hideEmployeeStatusModal, handleEmployeeStatusFormSubmit } from './admin-employee-statuses.js';
import { loadEmployeeLevels, initEmployeeLevelEventListeners, showEmployeeLevelModal, hideEmployeeLevelModal, handleEmployeeLevelFormSubmit } from './admin-employee-levels.js';
import { loadMaritalStatuses, initMaritalStatusEventListeners, showMaritalStatusModal, hideMaritalStatusModal, handleMaritalStatusFormSubmit } from './admin-marital-statuses.js';
import { loadAbsenceTypes, initAbsenceTypeEventListeners, showAbsenceTypeModal, hideAbsenceTypeModal, handleAbsenceTypeFormSubmit } from './admin-absence-types.js';
import { loadLocationSettings, initLocationSettingsEventListeners } from './admin-location-settings.js';
import { initAttendanceReportPage, initLeaveReportPage } from './admin-reports.js';

export const ui = {};

// State for chart navigation
let weeklyChartInstance = null;
let genderChartInstance = null;
let chartEndDate = new Date(); // The end date for the weekly chart, defaults to today.

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // New state variables for schedule editing
    let isScheduleEditMode = false;
    let scheduleChanges = {}; // To store { userId: { day: scheduleId } }
    let currentAssignments = []; // To store the full assignment data for the current month
    let currentAbsenceTypeCodes = []; // To hold absence codes for the current month view

    // --- Konfigurasi dan State ---
    // Jika user atau token tidak ada (sudah divalidasi di HTML, tapi double check), hentikan eksekusi.
    if (!state.user || !state.token) {
        console.error("User data or token not found.", { user: !!state.user, token: !!state.token });
        alert('Sesi login tidak valid (token tidak ditemukan). Silakan login ulang.');
        window.location.href = 'login.html';
        return;
    }

    // Pastikan hanya admin perusahaan yang bisa mengakses halaman ini
    if (state.user.role !== 'admin') {
        console.error(`Access Denied: User role is '${state.user.role}', but 'admin' is required.`);
        alert(`Akses ditolak. Role Anda (${state.user.role}) tidak diizinkan mengakses halaman ini.`);
        window.location.href = 'login.html'; // Redirect ke halaman yang sesuai
        return;
    }

    // --- Elemen UI ---
    ui.companyNameHeader = document.getElementById('company-name-header');
    ui.companyLogoContainer = document.getElementById('company-logo-container');
    ui.adminNameElement = document.getElementById('sidebar-admin-name');
    ui.adminRoleElement = document.getElementById('sidebar-admin-role');
    ui.logoutButton = document.querySelector('.logout-button');

    // Mobile Navigation
    ui.sidebar = document.getElementById('sidebar');
    ui.sidebarOverlay = document.getElementById('sidebar-overlay');
    ui.hamburgerBtn = document.getElementById('hamburger-btn');
    ui.mobilePageTitle = document.getElementById('mobile-page-title');

    // Navigation & Views
    ui.navLinks = document.querySelectorAll('.nav-link');
    ui.mainViews = {
        'nav-dashboard': document.getElementById('view-dashboard'),
        'nav-employees': document.getElementById('view-employees'), // Employee grid view
        'nav-reports': document.getElementById('view-reports'),
        'nav-requests': document.getElementById('view-requests'),
        'nav-settings': document.getElementById('view-settings')
    };

    // Settings & User Management
    ui.viewSettingsUser = document.getElementById('view-settings-user');
    ui.usersTableBody = document.getElementById('users-table-body');
    ui.btnAddUser = document.getElementById('btn-add-user');
    ui.userModal = document.getElementById('user-modal');
    ui.userModalTitle = document.getElementById('user-modal-title');
    ui.userForm = document.getElementById('user-form');
    ui.btnCancelUserModal = document.getElementById('btn-cancel-user-modal');
    ui.passwordHint = document.getElementById('password-hint');
    ui.searchUserInput = document.getElementById('search-user-input');

    // Employee Views
    ui.viewEmployeeProfile = document.getElementById('view-employee-profile');
    ui.employeeTableBody = document.getElementById('employee-table-body');
    ui.searchEmployeeInput = document.getElementById('search-employee-input');
    ui.btnAddEmployee = document.getElementById('btn-add-employee');
    ui.btnBulkImportEmployee = document.getElementById('btn-bulk-import-employee');
    ui.tabActiveEmployees = document.getElementById('tab-active-employees');
    ui.tabInactiveEmployees = document.getElementById('tab-inactive-employees');

    // Add Employee Modal (New)
    ui.addEmployeeModal = document.getElementById('add-employee-modal');
    ui.addEmployeeForm = document.getElementById('add-employee-form');
    ui.btnCancelAddEmployeeModal = document.getElementById('btn-cancel-add-employee-modal');
    ui.employeeLevel = document.getElementById('employee-level');

    // Employee Profile Details Modal
    ui.profileDetailsModal = document.getElementById('profile-details-modal');
    ui.profileDetailsForm = document.getElementById('profile-details-form');
    ui.btnCancelProfileDetailsModal = document.getElementById('btn-cancel-profile-details-modal');

    // Profile Settings Modal
    ui.btnProfileSettings = document.getElementById('btn-profile-settings');
    ui.profileModal = document.getElementById('profile-modal');
    ui.profileForm = document.getElementById('profile-form');
    ui.btnCancelProfileModal = document.getElementById('btn-cancel-profile-modal');
    ui.profileAvatarPreview = document.getElementById('profile-avatar-preview');
    ui.profileAvatarUpload = document.getElementById('profile-avatar-upload');

    // Role Management
    ui.viewSettingsRole = document.getElementById('view-settings-role');
    ui.rolesTableBody = document.getElementById('roles-table-body');
    ui.btnAddRole = document.getElementById('btn-add-role');
    ui.roleModal = document.getElementById('role-modal');
    ui.roleModalTitle = document.getElementById('role-modal-title');
    ui.roleForm = document.getElementById('role-form');
    ui.btnCancelRoleModal = document.getElementById('btn-cancel-role-modal');
    ui.rolePermissionsContainer = document.getElementById('role-permissions-container');

    // Position Management
    ui.viewSettingsPosition = document.getElementById('view-settings-position');
    ui.positionsTableBody = document.getElementById('positions-table-body');
    ui.btnAddPosition = document.getElementById('btn-add-position');
    ui.positionModal = document.getElementById('position-modal');
    ui.positionModalTitle = document.getElementById('position-modal-title');
    ui.positionForm = document.getElementById('position-form');
    ui.btnCancelPositionModal = document.getElementById('btn-cancel-position-modal');

    // Department Management
    ui.viewSettingsDepartment = document.getElementById('view-settings-department');
    ui.departmentsTableBody = document.getElementById('departments-table-body');
    ui.btnAddDepartment = document.getElementById('btn-add-department');
    ui.departmentModal = document.getElementById('department-modal');
    ui.departmentModalTitle = document.getElementById('department-modal-title');
    ui.departmentForm = document.getElementById('department-form');
    ui.btnCancelDepartmentModal = document.getElementById('btn-cancel-department-modal');

    // Work Schedule Management
    ui.viewSettingsWorkSchedule = document.getElementById('view-settings-work-schedule');
    ui.workSchedulesTableBody = document.getElementById('work-schedules-table-body');
    ui.btnAddWorkSchedule = document.getElementById('btn-add-work-schedule');
    ui.workScheduleModal = document.getElementById('work-schedule-modal');
    ui.workScheduleModalTitle = document.getElementById('work-schedule-modal-title');
    ui.workScheduleForm = document.getElementById('work-schedule-form');
    ui.btnCancelWorkScheduleModal = document.getElementById('btn-cancel-work-schedule-modal');
    ui.tabWorkSchedules = document.getElementById('tab-work-schedules');
    ui.tabAbsenceTypes = document.getElementById('tab-absence-types');

    // Employee Status Management
    ui.viewSettingsEmployeeStatus = document.getElementById('view-settings-employee-status');
    ui.employeeStatusesTableBody = document.getElementById('employee-statuses-table-body');
    ui.btnAddEmployeeStatus = document.getElementById('btn-add-employee-status');
    ui.employeeStatusModal = document.getElementById('employee-status-modal');
    ui.employeeStatusModalTitle = document.getElementById('employee-status-modal-title');
    ui.employeeStatusForm = document.getElementById('employee-status-form');
    ui.btnCancelEmployeeStatusModal = document.getElementById('btn-cancel-employee-status-modal');

    // Employee Level Management
    ui.viewSettingsEmployeeLevels = document.getElementById('view-settings-employee-levels');
    ui.employeeLevelsTableBody = document.getElementById('employee-levels-table-body');
    ui.btnAddEmployeeLevel = document.getElementById('btn-add-employee-level');
    ui.employeeLevelModal = document.getElementById('employee-level-modal');
    ui.employeeLevelModalTitle = document.getElementById('employee-level-modal-title');
    ui.employeeLevelForm = document.getElementById('employee-level-form');
    ui.btnCancelEmployeeLevelModal = document.getElementById('btn-cancel-employee-level-modal');

    // Marital Status Management
    ui.viewSettingsMaritalStatus = document.getElementById('view-settings-marital-status');
    ui.maritalStatusesTableBody = document.getElementById('marital-status-table-body');
    ui.btnAddMaritalStatus = document.getElementById('btn-add-marital-status');
    ui.maritalStatusModal = document.getElementById('marital-status-modal');
    ui.maritalStatusModalTitle = document.getElementById('marital-status-modal-title');
    ui.maritalStatusForm = document.getElementById('marital-status-form');
    ui.btnCancelMaritalStatusModal = document.getElementById('btn-cancel-marital-status-modal');

    // Absence Type Management
    ui.absenceTypesTableBody = document.getElementById('absence-types-table-body');
    ui.btnAddAbsenceType = document.getElementById('btn-add-absence-type');
    ui.absenceTypeModal = document.getElementById('absence-type-modal');
    ui.absenceTypeModalTitle = document.getElementById('absence-type-modal-title');
    ui.absenceTypeForm = document.getElementById('absence-type-form');
    ui.btnCancelAbsenceTypeModal = document.getElementById('btn-cancel-absence-type-modal');

    // Location Settings
    ui.viewSettingsLocation = document.getElementById('view-settings-location');
    ui.locationSettingsForm = document.getElementById('location-settings-form');
    ui.locationSettingMap = document.getElementById('location-setting-map');
    ui.locationLatitudeInput = document.getElementById('location-latitude');
    ui.locationLongitudeInput = document.getElementById('location-longitude');
    ui.locationRadiusInput = document.getElementById('location-radius');

    // Stat cards
    ui.statTotalEmployees = document.getElementById('stat-total-employees');
    ui.statPresentToday = document.getElementById('stat-present-today');
    ui.statAbsentToday = document.getElementById('stat-absent-today');
    ui.statPendingRequests = document.getElementById('stat-pending-requests');
    ui.dashboardDepartmentFilter = document.getElementById('dashboard-department-filter');

    // Attendance Log
    ui.viewAttendanceLog = document.getElementById('view-attendance-log');
    ui.attendanceLogTableBody = document.getElementById('attendance-log-table-body');
    ui.attendanceDatePicker = document.getElementById('attendance-date-picker');
    ui.btnExportAttendance = document.getElementById('btn-export-attendance');

    // Work Schedule Assignment (New)
    ui.viewSchedule = document.getElementById('view-schedule');
    ui.scheduleTableBody = document.getElementById('schedule-table-body');
    ui.scheduleTableHeader = document.getElementById('schedule-table-header');
    ui.scheduleTableFooter = document.getElementById('schedule-table-footer');
    ui.scheduleMonthSelect = document.getElementById('schedule-month-select');
    ui.scheduleYearSelect = document.getElementById('schedule-year-select');
    ui.scheduleTableContainer = document.querySelector('.schedule-table-container');
    // Schedule Edit Controls
    ui.btnUploadScheduleTemplate = document.getElementById('btn-upload-schedule-template');
    ui.scheduleUploadInput = document.getElementById('schedule-upload-input');
    ui.btnExportScheduleTemplate = document.getElementById('btn-export-schedule-template');
    ui.btnEditSchedule = document.getElementById('btn-edit-schedule');
    ui.scheduleEditButtons = document.getElementById('schedule-edit-buttons');
    ui.btnCancelScheduleEdit = document.getElementById('btn-cancel-schedule-edit');
    ui.btnSaveScheduleChanges = document.getElementById('btn-save-schedule-changes');

    // Daily Schedule Change Modal
    ui.scheduleChangeModal = document.getElementById('schedule-change-modal');
    ui.scheduleChangeForm = document.getElementById('schedule-change-form');
    ui.scheduleChangeModalTitle = document.getElementById('schedule-change-modal-title');
    ui.scheduleChangeModalSubtitle = document.getElementById('schedule-change-modal-subtitle');
    ui.scheduleChangeSelect = document.getElementById('schedule-change-select');
    ui.btnCancelScheduleChangeModal = document.getElementById('btn-cancel-schedule-change-modal');

    // Copy Schedule Modal
    ui.copyScheduleModal = document.getElementById('copy-schedule-modal');
    ui.copyScheduleForm = document.getElementById('copy-schedule-form');
    ui.copyScheduleModalTitle = document.getElementById('copy-schedule-modal-title');
    ui.copyScheduleModalSubtitle = document.getElementById('copy-schedule-modal-subtitle');
    ui.copyScheduleTargetList = document.getElementById('copy-schedule-target-list');
    ui.copyScheduleSearch = document.getElementById('copy-schedule-search');
    ui.copyScheduleSelectAll = document.getElementById('copy-schedule-select-all');
    ui.btnCancelCopyScheduleModal = document.getElementById('btn-cancel-copy-schedule-modal');

    // Tabel
    ui.recentRequestsTable = document.getElementById('recent-requests-table');
    ui.recentActivityList = document.getElementById('recent-activity-list');

    // Chart Navigation
    ui.btnPrevWeek = document.getElementById('btn-prev-week');
    ui.btnNextWeek = document.getElementById('btn-next-week');
    ui.btnThisWeek = document.getElementById('btn-this-week');
    ui.weeklyAttendanceChartContainer = document.getElementById('weekly-attendance-chart-container');
    ui.genderDistributionChartContainer = document.getElementById('gender-chart-container');

    // Requests View
    ui.viewRequests = document.getElementById('view-requests');
    ui.requestsTableBody = document.getElementById('requests-table-body');
    ui.requestTabs = document.querySelectorAll('.request-tab');
    ui.requestsCountBadge = document.getElementById('requests-count-badge');
    ui.requestDetailModal = document.getElementById('request-detail-modal');
    ui.requestDetailBody = document.getElementById('request-detail-body');
    ui.requestDetailActions = document.getElementById('request-detail-actions');
    ui.requestDetailCloseBtn = document.getElementById('request-detail-close-btn');

    // Reports View
    ui.viewReports = document.getElementById('view-reports');
    ui.viewReportAttendance = document.getElementById('view-report-attendance');
    ui.viewReportLeave = document.getElementById('view-report-leave');

    /**
     * Render UI dasar yang bergantung pada data user dan perusahaan.
     */
    async function renderBaseUI() {
        // Ambil data detail perusahaan
        // Asumsi ada endpoint untuk mendapatkan detail perusahaan berdasarkan ID dari user
        // Admin company should load its own company profile via company-admin scoped endpoint.
        // If your backend doesn't support it, we fall back to displaying only name from localStorage.
        const companyData = await fetchData(`/admin/companies/me`);
        if (companyData) {
            state.company = companyData;
            ui.companyNameHeader.textContent = state.company.name;
            ui.companyLogoContainer.innerHTML = `<i data-lucide="building-2" class="w-5 h-5 text-white"></i>`;
        }

        // Tampilkan nama admin
        if (state.user.username) {
            ui.adminNameElement.textContent = state.user.username;
            ui.adminRoleElement.textContent = 'Admin'; // Role bisa dibuat lebih dinamis jika perlu
        }

        // Render ikon Lucide
        lucide.createIcons();
    }

    /**
     * Opens the sidebar on mobile.
     */
    function openSidebar() {
        if (ui.sidebar && ui.sidebarOverlay) {
            ui.sidebar.classList.remove('-translate-x-full');
            ui.sidebarOverlay.classList.remove('hidden');
        }
    }

    /**
     * Closes the sidebar on mobile.
     */
    function closeSidebar() {
        if (ui.sidebar && ui.sidebarOverlay) {
            ui.sidebar.classList.add('-translate-x-full');
            ui.sidebarOverlay.classList.add('hidden');
        }
    }


    /**
     * Mengisi dropdown filter departemen di dashboard.
     */
    async function populateDepartmentFilter() {
        if (!ui.dashboardDepartmentFilter) return;

        const departments = await fetchData('/admin/departments');
        if (departments) {
            // Kosongkan opsi yang ada kecuali yang pertama ("All Departments")
            ui.dashboardDepartmentFilter.innerHTML = '<option value="">All Departments</option>';
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.id;
                option.textContent = dept.name;
                ui.dashboardDepartmentFilter.appendChild(option);
            });
        }
    }

    /**
     * Render data untuk kartu statistik di dashboard.
     * @param {string} [departmentId] - ID departemen opsional untuk memfilter statistik.
     */
    async function renderDashboardStats(departmentId = '') {
        const endpoint = departmentId ? `/admin/dashboard-stats?departmentId=${departmentId}` : `/admin/dashboard-stats`;
        const stats = await fetchData(endpoint);
        if (stats) {
            ui.statTotalEmployees.textContent = stats.totalEmployees || '0';
            ui.statPresentToday.textContent = stats.presentToday || '0';
            ui.statAbsentToday.textContent = stats.absentToday || '0';
            ui.statPendingRequests.textContent = stats.pendingRequests || '0';
        }
    }

    /**
     * Renders the weekly attendance chart by fetching data for a specific 7-day period.
     * @param {Date} [endDate=new Date()] The end date of the 7-day period.
     * @param {string} [departmentId=''] The ID of the department to filter by.
     */
    async function renderWeeklyAttendanceChart(endDate = new Date(), departmentId = '') {
        if (weeklyChartInstance) {
            weeklyChartInstance.destroy();
        }

        if (!ui.weeklyAttendanceChartContainer) return;
        ui.weeklyAttendanceChartContainer.innerHTML = `<div class="flex items-center justify-center h-full text-slate-500"><i data-lucide="loader-2" class="animate-spin mr-2"></i>Loading chart data...</div>`;
        lucide.createIcons();

        // Build query parameters
        const params = new URLSearchParams();
        params.append('endDate', endDate.toISOString().split('T')[0]);
        if (departmentId) {
            params.append('departmentId', departmentId);
        }

        // Fetch real data from the backend
        const weeklyData = await fetchData(`/admin/weekly-attendance?${params.toString()}`);

        // Restore the canvas element
        ui.weeklyAttendanceChartContainer.innerHTML = `<canvas id="weeklyAttendanceChart"></canvas>`;
        const ctx = document.getElementById('weeklyAttendanceChart')?.getContext('2d');
        if (!ctx) {
            console.error("Canvas context could not be found after recreating it.");
            return;
        }

        // If data fetching fails or returns no data, display an error message.
        if (!weeklyData || !weeklyData.labels || weeklyData.labels.length === 0) {
            console.error("Failed to load weekly attendance data or data is empty.");
            ui.weeklyAttendanceChartContainer.innerHTML = `<div class="flex items-center justify-center h-full text-slate-500"><i data-lucide="alert-triangle" class="w-5 h-5 mr-2 text-yellow-500"></i>Could not load chart data.</div>`;
            lucide.createIcons();
            updateChartNavButtons(endDate);
            return;
        }

        weeklyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: weeklyData, // Use data directly from the backend
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                interaction: { mode: 'index', intersect: false }
            }
        });

        updateChartNavButtons(endDate);
    }

    /**
     * Renders the gender distribution doughnut chart.
     * @param {string} [departmentId=''] The ID of the department to filter by.
     */
    async function renderGenderDistributionChart(departmentId = '') {
        if (genderChartInstance) {
            genderChartInstance.destroy();
        }

        if (!ui.genderDistributionChartContainer) return;
        ui.genderDistributionChartContainer.innerHTML = `<div class="flex items-center justify-center h-full text-slate-500"><i data-lucide="loader-2" class="animate-spin mr-2"></i>Loading chart data...</div>`;
        lucide.createIcons();

        const endpoint = departmentId ? `/admin/gender-distribution?departmentId=${departmentId}` : '/admin/gender-distribution';
        const genderData = await fetchData(endpoint);

        ui.genderDistributionChartContainer.innerHTML = `<canvas id="genderDistributionChart"></canvas>`;
        const ctx = document.getElementById('genderDistributionChart')?.getContext('2d');
        if (!ctx) return;

        const totalEmployees = genderData?.datasets?.[0]?.data?.reduce((a, b) => a + b, 0) || 0;

        if (!genderData || totalEmployees === 0) {
            ui.genderDistributionChartContainer.innerHTML = `<div class="flex items-center justify-center h-full text-slate-500"><i data-lucide="users" class="w-5 h-5 mr-2 text-slate-400"></i>No employee data to display.</div>`;
            lucide.createIcons();
            return;
        }

        genderChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: genderData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    const value = context.parsed;
                                    const percentage = ((value / totalEmployees) * 100).toFixed(1) + '%';
                                    label += `${value} (${percentage})`;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Updates the state of the chart navigation buttons (prev, next, this week).
     * @param {Date} currentEndDate - The current end date of the chart.
     */
    function updateChartNavButtons(currentEndDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const chartEnd = new Date(currentEndDate);
        chartEnd.setHours(0, 0, 0, 0);

        const isThisWeek = chartEnd.getTime() >= today.getTime();

        ui.btnNextWeek.disabled = isThisWeek;
        ui.btnNextWeek.classList.toggle('opacity-50', isThisWeek);
        ui.btnNextWeek.classList.toggle('cursor-not-allowed', isThisWeek);

        ui.btnThisWeek.disabled = isThisWeek;
        ui.btnThisWeek.classList.toggle('bg-slate-200', isThisWeek);
    }

    /**
     * Render data pengajuan terbaru di daftar aktivitas.
     */
    async function renderRecentActivity() {
        const requests = await fetchData(`/admin/recent-requests`);
        if (!ui.recentActivityList) return;

        ui.recentActivityList.innerHTML = ''; // Clear previous entries

        if (requests && requests.length > 0) {
            requests.forEach(req => {
                const activityItem = document.createElement('div');
                activityItem.className = 'flex items-center space-x-4';
                const avatarSrc = req.avatarUrl ? `${API_URL.replace(/\/api$/, '')}${req.avatarUrl}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(req.fullName || 'N A')}&background=random&color=fff`;
                const statusMap = { 'pending': { text: 'Pending', icon: 'clock', color: 'orange' }, 'approved': { text: 'Approved', icon: 'check-circle', color: 'green' }, 'rejected': { text: 'Rejected', icon: 'x-circle', color: 'red' } };
                const status = statusMap[req.status] || { text: req.status, icon: 'help-circle', color: 'slate' };

                activityItem.innerHTML = `
                    <div class="flex-shrink-0"><img class="w-10 h-10 rounded-full object-cover" src="${avatarSrc}" alt="${req.fullName} avatar"></div>
                    <div class="flex-1 min-w-0"><p class="text-sm font-medium text-slate-900 truncate">${req.fullName}</p><p class="text-sm text-slate-500">Submitted a <span class="font-semibold">${req.requestTypeName}</span> request.</p></div>
                    <div class="inline-flex items-center text-xs font-semibold text-${status.color}-600"><i data-lucide="${status.icon}" class="w-4 h-4 mr-1.5"></i>${status.text}</div>`;
                ui.recentActivityList.appendChild(activityItem);
            });
        } else {
            ui.recentActivityList.innerHTML = `<p class="text-sm text-center text-slate-500 py-4">No recent activity.</p>`;
        }
        lucide.createIcons();
    }

    /**
     * Switches between tabs in the Requests view.
     * @param {string} activeStatus - 'pending' or 'history'.
     */
    function switchRequestTab(activeStatus) {
        const activeClasses = ['text-blue-600', 'border-blue-600'];
        const inactiveClasses = ['text-slate-500', 'border-transparent', 'hover:text-slate-700', 'hover:border-slate-300'];

        ui.requestTabs.forEach(tab => {
            if (tab.dataset.status === activeStatus) {
                tab.classList.add(...activeClasses);
                tab.classList.remove(...inactiveClasses);
            } else {
                tab.classList.remove(...activeClasses);
                tab.classList.add(...inactiveClasses);
            }
        });
    }

    /**
     * Loads requests from the API and renders them.
     * @param {string} [status='pending'] - The status to filter by ('pending', 'history').
     */
    async function loadRequests(status = 'pending') {
        if (!ui.requestsTableBody) return;

        switchRequestTab(status);
        ui.requestsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8"><div class="flex items-center justify-center text-slate-500"><i data-lucide="loader-2" class="animate-spin mr-2"></i>Loading requests...</div></td></tr>`;
        lucide.createIcons();

        const requests = await fetchData(`/admin/requests?status=${status}`);

        if (requests) {
            renderRequestsTable(requests, status);
            if (status === 'pending') {
                updateRequestCountBadge(requests.length);
            }
        } else {
            ui.requestsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500">Failed to load requests.</td></tr>`;
        }
    }

    /**
     * Renders the requests into the table.
     * @param {Array} requests - The array of request objects.
     * @param {string} statusContext - The current status view ('pending' or 'history').
     */
    function renderRequestsTable(requests, statusContext) {
        ui.requestsTableBody.innerHTML = '';

        if (requests.length === 0) {
            ui.requestsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500">No ${statusContext} requests found.</td></tr>`;
            return;
        }

        const dateFormat = { day: 'numeric', month: 'short', year: 'numeric' };

        requests.forEach(req => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b hover:bg-slate-50';

            const avatarSrc = req.avatarUrl ? `${API_URL.replace(/\/api$/, '')}${req.avatarUrl}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(req.fullName || 'N A')}&background=random&color=fff`;
            const startDate = new Date(req.startDate).toLocaleDateString('en-GB', dateFormat);
            const endDate = new Date(req.endDate).toLocaleDateString('en-GB', dateFormat);
            const submittedDate = new Date(req.submittedDate).toLocaleDateString('en-GB', dateFormat);

            const statusMap = {
                'pending': { text: 'Pending', class: 'bg-orange-100 text-orange-800' },
                'approved': { text: 'Approved', class: 'bg-green-100 text-green-800' },
                'rejected': { text: 'Rejected', class: 'bg-red-100 text-red-800' },
            };
            const statusInfo = statusMap[req.status] || { text: req.status, class: 'bg-slate-100 text-slate-800' };

            const reqJson = encodeURIComponent(JSON.stringify(req));
            const actionsHTML = `
                <div class="flex justify-center items-center gap-1">
                    <button title="View Detail" data-req="${reqJson}" class="request-view-btn p-2 rounded-full text-blue-600 hover:bg-blue-100">
                        <i data-lucide="eye" class="w-5 h-5 pointer-events-none"></i>
                    </button>
                    <button title="Hapus Request" data-request-id="${req.id}" class="request-delete-btn p-2 rounded-full text-red-400 hover:bg-red-50 hover:text-red-600">
                        <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                </div>`;

            row.innerHTML = `
            <td class="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                <div class="flex items-center">
                    <img class="w-8 h-8 rounded-full mr-3 object-cover" src="${avatarSrc}" alt="${req.fullName} avatar">
                    <span>${req.fullName || 'N/A'}</span>
                </div>
            </td>
            <td class="px-6 py-4">${req.requestTypeName}</td>
            <td class="px-6 py-4">${startDate === endDate ? startDate : `${startDate} - ${endDate}`}</td>
            <td class="px-6 py-4 max-w-xs truncate" title="${req.reason}">${req.reason || '-'}</td>
            <td class="px-6 py-4">${submittedDate}</td>
            <td class="px-6 py-4"><span class="${statusInfo.class} text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">${statusInfo.text}</span></td>
            <td class="px-6 py-4 text-center">${actionsHTML}</td>
        `;
            ui.requestsTableBody.appendChild(row);
        });
        lucide.createIcons();
    }

    /**
     * Fetches the count of pending requests and updates the sidebar badge.
     */
    async function updatePendingRequestCount() {
        const pendingRequests = await fetchData(`/admin/requests?status=pending`);
        if (pendingRequests) {
            updateRequestCountBadge(pendingRequests.length);
        }
    }

    /**
     * Updates the UI of the request count badge.
     * @param {number} count The number of pending requests.
     */
    function updateRequestCountBadge(count) {
        if (!ui.requestsCountBadge) return;
        if (count > 0) {
            ui.requestsCountBadge.textContent = count;
            ui.requestsCountBadge.classList.remove('hidden');
        } else {
            ui.requestsCountBadge.classList.add('hidden');
        }
    }

    /**
     * Switches between tabs in the Schedule Settings view.
     * @param {'work-schedules'|'absence-types'} activeTab 
     */
    function switchScheduleSettingsTab(activeTab) {
        const activeClasses = ['text-blue-600', 'border-blue-600'];
        const inactiveClasses = ['text-slate-500', 'border-transparent', 'hover:text-slate-700', 'hover:border-slate-300'];

        document.querySelectorAll('.tab-content-schedule-settings').forEach(content => content.classList.add('hidden'));

        if (activeTab === 'work-schedules') {
            document.getElementById('tab-content-work-schedules').classList.remove('hidden');
            ui.tabWorkSchedules.classList.add(...activeClasses);
            ui.tabWorkSchedules.classList.remove(...inactiveClasses);
            ui.tabAbsenceTypes.classList.add(...inactiveClasses);
            ui.tabAbsenceTypes.classList.remove(...activeClasses);
            loadWorkSchedules();
        } else if (activeTab === 'absence-types') {
            document.getElementById('tab-content-absence-types').classList.remove('hidden');
            ui.tabAbsenceTypes.classList.add(...activeClasses);
            ui.tabAbsenceTypes.classList.remove(...inactiveClasses);
            ui.tabWorkSchedules.classList.add(...inactiveClasses);
            ui.tabWorkSchedules.classList.remove(...activeClasses);
            loadAbsenceTypes();
        }
    }

    /**
     * Menampilkan modal untuk pengaturan profil.
     */
    function showProfileModal() {
        ui.profileForm.reset();
        // Set avatar preview dari data user yang ada di sidebar
        const userAvatar = document.getElementById('sidebar-avatar');
        if (userAvatar) {
            ui.profileAvatarPreview.src = userAvatar.src;
        }

        // Mengisi teks role pengguna saat ini di modal
        if (state.user && state.user.role) {
            document.getElementById('profile-role').textContent = state.user.role;
        }

        ui.profileModal.classList.remove('hidden');
        ui.profileModal.classList.add('flex');
    }

    /**
     * Menyembunyikan modal pengaturan profil.
     */
    function hideProfileModal() {
        ui.profileModal.classList.add('hidden');
        ui.profileModal.classList.remove('flex');
    }

    /**
     * Menangani perubahan pada input file avatar untuk menampilkan preview.
     */
    function handleProfileAvatarChange(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                ui.profileAvatarPreview.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    /**
     * Menangani submit form untuk update profil (password & foto).
     * Menggunakan FormData agar bisa mengirim file dan teks sekaligus.
     */
    async function handleProfileFormSubmit(e) {
        e.preventDefault();

        const newPassword = document.getElementById('profile-password').value;
        const confirmPassword = document.getElementById('profile-password-confirm').value;
        const avatarFile = ui.profileAvatarUpload.files[0];

        let hasChanges = false;
        const formData = new FormData();

        // Validasi dan siapkan data password
        if (newPassword) {
            if (newPassword.length < 6) {
                alert('Password baru harus minimal 6 karakter.');
                return;
            }
            if (newPassword !== confirmPassword) {
                alert('Konfirmasi password tidak cocok.');
                return;
            }
            formData.append('password', newPassword);
            hasChanges = true;
        }

        // Siapkan data file foto
        if (avatarFile) {
            formData.append('avatar', avatarFile);
            hasChanges = true;
        }

        if (!hasChanges) {
            alert('Tidak ada perubahan yang disimpan.');
            hideProfileModal();
            return;
        }

        // Asumsi ada endpoint PUT /api/admin/profile untuk update data admin yang sedang login.
        // Endpoint ini perlu dibuat di backend dan harus bisa menangani `multipart/form-data`.
        const result = await fetchData(`/admin/profile`, {
            method: 'PUT',
            body: formData,
            // Penting: Jangan set header 'Content-Type', browser akan melakukannya secara otomatis
            // dengan boundary yang benar saat mengirim FormData.
        });

        if (result) {
            alert('Profil berhasil diperbarui. Halaman akan dimuat ulang untuk menampilkan perubahan.');
            hideProfileModal();
            // Reload halaman untuk melihat perubahan (terutama foto profil di sidebar)
            window.location.reload();
        }
    }

    /**
     * Memuat dan menampilkan log absensi untuk tanggal yang dipilih.
     * @param {string} [date] - Tanggal dalam format YYYY-MM-DD. Jika tidak ada, gunakan tanggal hari ini.
     */
    async function loadAttendanceLog(date) {
        if (!ui.attendanceLogTableBody) return;

        const targetDate = date || new Date().toISOString().split('T')[0];

        // Set nilai date picker jika belum sesuai
        if (ui.attendanceDatePicker.value !== targetDate) {
            ui.attendanceDatePicker.value = targetDate;
        }

        ui.attendanceLogTableBody.innerHTML = `<tr><td colspan="10" class="text-center py-8"><div class="flex items-center justify-center text-slate-500"><i data-lucide="loader-2" class="animate-spin mr-2"></i>Loading attendance data...</div></td></tr>`;
        lucide.createIcons();

        const attendanceData = await fetchData(`/admin/attendance?date=${targetDate}`);

        if (attendanceData) {
            renderAttendanceLogTable(attendanceData);
        } else {
            ui.attendanceLogTableBody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-500">Failed to load attendance data.</td></tr>`;
        }
    }

    /**
     * Merender tabel log absensi.
     * @param {Array} data - Array data absensi.
     */
    function renderAttendanceLogTable(data) {
        if (!ui.attendanceLogTableBody) return;
        ui.attendanceLogTableBody.innerHTML = '';

        if (data.length === 0) {
            ui.attendanceLogTableBody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-500">No attendance records found for this date.</td></tr>`;
            return;
        }

        const timeFmt = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

        data.forEach(record => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b hover:bg-slate-50 text-sm';

            const checkInDT  = record.checkInTime  ? new Date(record.checkInTime)  : null;
            const checkOutDT = record.checkOutTime ? new Date(record.checkOutTime) : null;

            const checkInFormatted  = checkInDT  ? checkInDT.toLocaleTimeString('en-US', timeFmt)  : '-';
            const checkOutFormatted = checkOutDT ? checkOutDT.toLocaleTimeString('en-US', timeFmt) : '-';

            // Build scheduled time Date objects on the same day as check-in (or today)
            const baseDate = checkInDT || new Date();
            function schedToDate(timeStr) {
                if (!timeStr) return null;
                const [h, m, s] = timeStr.split(':').map(Number);
                const d = new Date(baseDate);
                d.setHours(h, m, s || 0, 0);
                return d;
            }

            const schedInDT  = schedToDate(record.scheduledStartTime);
            const schedOutDT = schedToDate(record.scheduledEndTime);

            const schedInFormatted  = record.scheduledStartTime || '-';
            const schedOutFormatted = record.scheduledEndTime   || '-';

            // Late check-in badge
            let lateCell = '';
            if (checkInDT && schedInDT && checkInDT > schedInDT) {
                const mins = Math.floor((checkInDT - schedInDT) / 60000);
                const h = Math.floor(mins / 60), m = mins % 60;
                const dur = h > 0 ? `${h}j ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
                lateCell = `<span class="text-xs font-semibold text-red-600">Late Check In (${dur})</span>`;
            }

            // Early check-out badge
            let earlyCell = '';
            if (checkOutDT && schedOutDT && checkOutDT < schedOutDT) {
                const mins = Math.floor((schedOutDT - checkOutDT) / 60000);
                const h = Math.floor(mins / 60), m = mins % 60;
                const dur = h > 0 ? `${h}j ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
                earlyCell = `<span class="text-xs font-semibold text-orange-500">Early Check Out (${dur})</span>`;
            }

            const statusMap = {
                'present':  { text: 'Present',  cls: 'bg-green-100 text-green-800' },
                'absent':   { text: 'Absent',   cls: 'bg-red-100 text-red-800' },
                'on_leave': { text: 'On Leave', cls: 'bg-blue-100 text-blue-800' },
                'sick':     { text: 'Sick',     cls: 'bg-yellow-100 text-yellow-800' },
            };
            const st = statusMap[record.status] || { text: record.status, cls: 'bg-slate-100 text-slate-800' };

            const avatarSrc = record.avatarUrl
                ? `${API_URL.replace(/\/api$/, '')}${record.avatarUrl}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(record.fullName || 'N A')}&background=random&color=fff`;

            const empStatusBadge = record.isActive === false
                ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Resigned</span>`
                : `<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>`;

            row.innerHTML = `
                <td class="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    <div class="flex items-center">
                        <img class="w-8 h-8 rounded-full mr-3 object-cover" src="${avatarSrc}" alt="">
                        <span>${record.fullName || 'N/A'}</span>
                    </div>
                </td>
                <td class="px-4 py-3">${empStatusBadge}</td>
                <td class="px-4 py-3 text-slate-600">${schedInFormatted}</td>
                <td class="px-4 py-3 font-medium text-slate-800">${checkInFormatted}</td>
                <td class="px-4 py-3">${lateCell}</td>
                <td class="px-4 py-3 text-slate-600">${schedOutFormatted}</td>
                <td class="px-4 py-3 font-medium text-slate-800">${checkOutFormatted}</td>
                <td class="px-4 py-3">${earlyCell}</td>
                <td class="px-4 py-3"><span class="${st.cls} text-xs font-medium px-2.5 py-0.5 rounded-full">${st.text}</span></td>
                <td class="px-4 py-3 text-slate-500">${record.notes || '-'}</td>
            `;
            ui.attendanceLogTableBody.appendChild(row);
        });
    }

    /**
     * Menangani ekspor data log absensi ke file Excel.
     */
    async function handleExportAttendance() {
        const date = ui.attendanceDatePicker.value;
        if (!date) {
            alert('Please select a date first.');
            return;
        }

        // Tampilkan status loading pada tombol
        const exportButton = ui.btnExportAttendance;
        const originalText = exportButton.querySelector('span').textContent;
        exportButton.disabled = true;
        exportButton.querySelector('span').textContent = 'Exporting...';

        const attendanceData = await fetchData(`/admin/attendance?date=${date}`);

        if (attendanceData && attendanceData.length > 0) {
            // 1. Format data untuk Excel
            const timeFmt = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
            const dataForExcel = attendanceData.map(record => {
                const checkInDT  = record.checkInTime  ? new Date(record.checkInTime)  : null;
                const checkOutDT = record.checkOutTime ? new Date(record.checkOutTime) : null;
                const baseDate   = checkInDT || new Date();

                function schedToDate(timeStr) {
                    if (!timeStr) return null;
                    const [h, m, s] = timeStr.split(':').map(Number);
                    const d = new Date(baseDate);
                    d.setHours(h, m, s || 0, 0);
                    return d;
                }

                const schedInDT  = schedToDate(record.scheduledStartTime);
                const schedOutDT = schedToDate(record.scheduledEndTime);

                let lateLabel = '';
                if (checkInDT && schedInDT && checkInDT > schedInDT) {
                    const mins = Math.floor((checkInDT - schedInDT) / 60000);
                    const h = Math.floor(mins / 60), m = mins % 60;
                    lateLabel = `Late Check In (${h > 0 ? h + 'j ' : ''}${m}m)`;
                }

                let earlyLabel = '';
                if (checkOutDT && schedOutDT && checkOutDT < schedOutDT) {
                    const mins = Math.floor((schedOutDT - checkOutDT) / 60000);
                    const h = Math.floor(mins / 60), m = mins % 60;
                    earlyLabel = `Early Check Out (${h > 0 ? h + 'j ' : ''}${m}m)`;
                }

                return {
                    'Employee Name':          record.fullName || 'N/A',
                    'Sched. Check In Time':   record.scheduledStartTime || '-',
                    'Check In Time':          checkInDT  ? checkInDT.toLocaleTimeString('en-US', timeFmt)  : '-',
                    'Late Check In':          lateLabel,
                    'Sched. Check Out Time':  record.scheduledEndTime   || '-',
                    'Check Out Time':         checkOutDT ? checkOutDT.toLocaleTimeString('en-US', timeFmt) : '-',
                    'Early Check Out':        earlyLabel,
                    'Status':                 record.status,
                    'Notes':                  record.notes || '-'
                };
            });

            // 2. Buat worksheet dan workbook
            const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Log');

            // 3. Trigger download
            const fileName = `Attendance_Log_${date}.xlsx`;
            XLSX.writeFile(workbook, fileName);

        } else if (attendanceData) {
            alert('No attendance data to export for the selected date.');
        }
        // Jika fetchData gagal, ia sudah menampilkan alert.

        // Kembalikan state tombol ke semula
        exportButton.disabled = false;
        exportButton.querySelector('span').textContent = originalText;
    }

    /**
     * Handles approve/reject actions on a request.
     * @param {Event} e The click event.
     */
    async function handleRequestAction(e) {
        const button = e.target.closest('.request-action-btn');
        if (!button) return;

        const requestId = button.dataset.requestId;
        const action = button.dataset.action;

        if (!confirm(`Are you sure you want to ${action} this request?`)) return;

        await processRequestAction(requestId, action);
    }

    async function processRequestAction(requestId, action, processorNotes = '') {
        const result = await fetchData(`/admin/requests/${requestId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: action, processorNotes }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (result) {
            closeRequestDetailModal();
            loadRequests('pending');
            updatePendingRequestCount();
        }
    }

    function closeRequestDetailModal() {
        if (ui.requestDetailModal) {
            ui.requestDetailModal.classList.add('hidden');
            ui.requestDetailModal.classList.remove('flex');
        }
    }

    async function showRequestDetailModal(req) {
        // Buka modal dengan loading state dulu
        ui.requestDetailBody.innerHTML = `<div class="flex items-center justify-center py-12 text-slate-400"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mr-2"></i> Loading...</div>`;
        ui.requestDetailActions.innerHTML = '';
        ui.requestDetailModal.classList.remove('hidden');
        ui.requestDetailModal.classList.add('flex');
        lucide.createIcons();

        const dateFormat = { day: 'numeric', month: 'long', year: 'numeric' };
        const startDate = new Date(req.startDate).toLocaleDateString('id-ID', dateFormat);
        const endDate   = new Date(req.endDate).toLocaleDateString('id-ID', dateFormat);
        const submittedDate = new Date(req.submittedDate).toLocaleDateString('id-ID', { ...dateFormat, hour: '2-digit', minute: '2-digit' });
        const avatarSrc = req.avatarUrl
            ? `${API_URL.replace(/\/api$/, '')}${req.avatarUrl}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(req.fullName || 'N A')}&background=random&color=fff`;

        const statusMap = {
            pending:  { text: 'Pending',  cls: 'bg-orange-100 text-orange-800' },
            approved: { text: 'Approved', cls: 'bg-green-100 text-green-800' },
            rejected: { text: 'Rejected', cls: 'bg-red-100 text-red-800' },
        };
        const statusInfo = statusMap[req.status] || { text: req.status, cls: 'bg-slate-100 text-slate-800' };
        const totalDays = Math.round((new Date(req.endDate) - new Date(req.startDate)) / 86400000) + 1;
        const isChangeSchedule = req.requestType === 'change_schedule';

        // Fetch contract & leave balance untuk semua tipe request (bukan hanya leave)
        let extraHTML = '';
        let remainingLeave = null;
        if (req.userId) {
            const extra = await fetchData(`/admin/employees/${req.userId}/extra-details`);
            if (extra) {
                remainingLeave = extra.remainingLeave;

                const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                const contractStart = fmtDate(extra.contractStartDate);
                const contractEnd   = fmtDate(extra.contractEndDate);

                const leaveColor = remainingLeave <= 0 ? 'text-red-600' : remainingLeave <= 3 ? 'text-orange-500' : 'text-green-700';
                const leaveBg    = remainingLeave <= 0 ? 'bg-red-50 border border-red-200' : remainingLeave <= 3 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200';

                extraHTML = `
                <div class="rounded-xl overflow-hidden border border-slate-200">
                    <div class="bg-slate-100 px-4 py-2">
                        <p class="text-xs font-bold text-slate-600 uppercase tracking-wide">Employee Info</p>
                    </div>
                    <div class="grid grid-cols-3 divide-x divide-slate-200">
                        <div class="px-4 py-3">
                            <p class="text-xs text-slate-500 mb-0.5">Contract Start</p>
                            <p class="text-sm font-semibold text-slate-800">${contractStart}</p>
                        </div>
                        <div class="px-4 py-3">
                            <p class="text-xs text-slate-500 mb-0.5">Contract End</p>
                            <p class="text-sm font-semibold text-slate-800">${contractEnd}</p>
                        </div>
                        <div class="px-4 py-3 ${leaveBg}">
                            <p class="text-xs text-slate-500 mb-0.5">Remaining Leave</p>
                            <p class="text-sm font-bold ${leaveColor}">${remainingLeave} days</p>
                        </div>
                    </div>
                </div>`;
            }
        }

        let attachmentHTML = '';
        if (req.attachmentUrl) {
            const fullUrl = `${API_URL.replace(/\/api$/, '')}${req.attachmentUrl}`;
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(req.attachmentUrl);
            attachmentHTML = `
                <div>
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Attachment</p>
                    ${isImage
                        ? `<a href="${fullUrl}" target="_blank"><img src="${fullUrl}" class="max-h-48 rounded-xl border border-slate-200 object-cover cursor-pointer hover:opacity-90"></a>`
                        : `<a href="${fullUrl}" target="_blank" class="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm"><i data-lucide="file-text" class="w-4 h-4"></i> View Document</a>`
                    }
                </div>`;
        }

        let processedHTML = '';
        if (req.status !== 'pending' && req.processedAt) {
            const processedDate = new Date(req.processedAt).toLocaleDateString('id-ID', dateFormat);
            processedHTML = `
                <div class="bg-slate-50 rounded-xl p-4 space-y-1">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Processed By</p>
                    <p class="text-sm text-slate-800">${req.processedByName || 'Admin'} &middot; ${processedDate}</p>
                    ${req.processorNotes ? `<p class="text-sm text-slate-600 italic">"${req.processorNotes}"</p>` : ''}
                </div>`;
        }

        // ── Change Schedule: approval chain block ──────────────────────────
        let changeScheduleHTML = '';
        if (isChangeSchedule) {
            const fmtD = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

            const l1Status = req.level1Status || 'skipped';
            const l1Map = {
                pending:  { icon: '⏳', label: 'Waiting',  cls: 'text-amber-600 bg-amber-50 border-amber-200' },
                approved: { icon: '✅', label: 'Approved', cls: 'text-green-700 bg-green-50 border-green-200' },
                rejected: { icon: '❌', label: 'Rejected', cls: 'text-red-700 bg-red-50 border-red-200' },
                skipped:  { icon: '—',  label: 'No Supervisor', cls: 'text-slate-500 bg-slate-50 border-slate-200' },
            };
            const l1Info = l1Map[l1Status] || l1Map.skipped;

            const mgrStatus = req.status === 'approved' ? 'approved' : req.status === 'rejected' ? 'rejected' : 'pending';
            const mgrMap = {
                pending:  { icon: '⏳', label: 'Waiting',  cls: 'text-amber-600 bg-amber-50 border-amber-200' },
                approved: { icon: '✅', label: 'Approved', cls: 'text-green-700 bg-green-50 border-green-200' },
                rejected: { icon: '❌', label: 'Rejected', cls: 'text-red-700 bg-red-50 border-red-200' },
            };
            const mgrInfo = mgrMap[mgrStatus] || mgrMap.pending;

            changeScheduleHTML = `
            <div class="rounded-xl overflow-hidden border border-indigo-200">
                <div class="bg-indigo-50 px-4 py-2 flex items-center justify-between">
                    <p class="text-xs font-bold text-indigo-700 uppercase tracking-wide">Change Schedule Request</p>
                </div>
                <div class="grid grid-cols-2 divide-x divide-indigo-100 bg-white">
                    <div class="px-4 py-3">
                        <p class="text-xs text-slate-500 mb-0.5">Target Date</p>
                        <p class="text-sm font-semibold text-slate-800">${fmtD(req.targetDate)}</p>
                    </div>
                    <div class="px-4 py-3">
                        <p class="text-xs text-slate-500 mb-0.5">Target Shift</p>
                        <p class="text-sm font-semibold text-slate-800">${req.targetScheduleName || '-'} ${req.targetScheduleStart ? `<span class="text-slate-400 font-normal">(${req.targetScheduleStart}–${req.targetScheduleEnd})</span>` : ''}</p>
                    </div>
                </div>
                ${req.colleagueName ? `<div class="px-4 py-2 bg-white border-t border-indigo-100"><p class="text-xs text-slate-500">Colleague: <span class="font-semibold text-slate-700">${req.colleagueName}</span></p></div>` : ''}
                <div class="bg-white border-t border-indigo-100 px-4 py-3">
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Approval Chain</p>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="rounded-lg border px-3 py-2 ${l1Info.cls}">
                            <p class="text-[10px] font-bold uppercase tracking-wide mb-1">Supervisor ${req.level1ApproverName ? `(${req.level1ApproverName})` : ''}</p>
                            <p class="text-xs font-semibold">${l1Info.icon} ${l1Info.label}</p>
                            ${req.level1Notes ? `<p class="text-[10px] mt-1 opacity-70">"${req.level1Notes}"</p>` : ''}
                        </div>
                        <div class="rounded-lg border px-3 py-2 ${mgrInfo.cls}">
                            <p class="text-[10px] font-bold uppercase tracking-wide mb-1">Manager</p>
                            <p class="text-xs font-semibold">${mgrInfo.icon} ${mgrInfo.label}</p>
                        </div>
                    </div>
                </div>
            </div>`;
        }
        // ──────────────────────────────────────────────────────────────────

        ui.requestDetailBody.innerHTML = `
            <div class="flex items-center gap-4">
                <img src="${avatarSrc}" class="w-14 h-14 rounded-full object-cover border-2 border-slate-200">
                <div>
                    <p class="font-bold text-slate-800 text-lg">${req.fullName || 'N/A'}</p>
                    <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusInfo.cls}">${statusInfo.text}</span>
                </div>
            </div>
            ${extraHTML}
            ${changeScheduleHTML}
            ${!isChangeSchedule ? `
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-50 rounded-xl p-4">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Request Type</p>
                    <p class="text-sm font-semibold text-slate-800">${req.requestTypeName}</p>
                </div>
                <div class="bg-slate-50 rounded-xl p-4">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Duration</p>
                    <p class="text-sm font-semibold text-slate-800">${totalDays} day${totalDays > 1 ? 's' : ''}</p>
                </div>
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Date</p>
                <p class="text-sm text-slate-800">${startDate}${startDate !== endDate ? ` &ndash; ${endDate}` : ''}</p>
            </div>` : ''}
            <div class="bg-slate-50 rounded-xl p-4">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Reason</p>
                <p class="text-sm text-slate-700">${req.reason || '-'}</p>
            </div>
            ${attachmentHTML}
            <p class="text-xs text-slate-400">Submitted: ${submittedDate}</p>
            ${processedHTML}
        `;

        if (req.status === 'pending') {
            const isLeave = req.requestType === 'leave';
            const insufficient = isLeave && remainingLeave !== null && remainingLeave < totalDays;
            const awaitingSupervisor = isChangeSchedule && req.level1Status === 'pending';

            let noticeHTML = '';
            if (awaitingSupervisor) {
                noticeHTML = `
                    <div class="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                        <i data-lucide="clock" class="w-4 h-4 mt-0.5 shrink-0"></i>
                        <span>Menunggu persetujuan <strong>Supervisor${req.level1ApproverName ? ` (${req.level1ApproverName})` : ''}</strong> terlebih dahulu. Anda belum bisa meng-Approve request ini.</span>
                    </div>`;
            } else if (insufficient) {
                noticeHTML = `
                    <div class="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                        <i data-lucide="alert-triangle" class="w-4 h-4 mt-0.5 shrink-0"></i>
                        <span>Sisa cuti karyawan <strong>${remainingLeave} hari</strong>, pengajuan ini membutuhkan <strong>${totalDays} hari</strong>. Approve akan menyebabkan saldo cuti negatif.</span>
                    </div>`;
            }

            const approveBtnCls = awaitingSupervisor
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : insufficient ? 'bg-orange-500 text-white hover:opacity-90' : 'bg-green-600 text-white hover:opacity-90';
            const approveBtnLabel = awaitingSupervisor
                ? 'Awaiting Supervisor'
                : insufficient ? 'Approve anyway' : 'Approve';

            ui.requestDetailActions.innerHTML = `
                <div class="space-y-2">
                    ${noticeHTML}
                    <textarea id="processor-notes-input" rows="2" placeholder="Catatan (opsional)..."
                        class="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"></textarea>
                    <div class="flex gap-3">
                        <button id="modal-reject-btn" class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 font-semibold hover:bg-red-100 transition-colors">
                            <i data-lucide="x-circle" class="w-4 h-4"></i> Reject
                        </button>
                        <button id="modal-approve-btn" ${awaitingSupervisor ? 'disabled' : ''} class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl ${approveBtnCls} font-semibold transition-colors">
                            <i data-lucide="check-circle" class="w-4 h-4"></i> ${approveBtnLabel}
                        </button>
                    </div>
                </div>`;

            if (!awaitingSupervisor) {
                document.getElementById('modal-approve-btn').addEventListener('click', async () => {
                    const notes = document.getElementById('processor-notes-input').value.trim();
                    await processRequestAction(req.id, 'approved', notes);
                });
            }
            document.getElementById('modal-reject-btn').addEventListener('click', async () => {
                const notes = document.getElementById('processor-notes-input').value.trim();
                await processRequestAction(req.id, 'rejected', notes);
            });
        } else {
            ui.requestDetailActions.innerHTML = '';
        }

        lucide.createIcons();
    }
    /**
     * Memuat tampilan utama untuk halaman penjadwalan.
     * Mengisi dropdown bulan & tahun dan memuat tabel.
     */
    function loadScheduleView() {
        if (!ui.scheduleMonthSelect || !ui.scheduleYearSelect) return;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11

        // Isi dropdown tahun (misal: 5 tahun ke belakang dan 1 tahun ke depan)
        if (ui.scheduleYearSelect.options.length === 0) {
            for (let i = currentYear - 5; i <= currentYear + 1; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                if (i === currentYear) option.selected = true;
                ui.scheduleYearSelect.appendChild(option);
            }
        }

        // Isi dropdown bulan
        if (ui.scheduleMonthSelect.options.length === 0) {
            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            months.forEach((month, index) => {
                const option = document.createElement('option');
                option.value = index; // 0-11
                option.textContent = month;
                if (index === currentMonth) option.selected = true;
                ui.scheduleMonthSelect.appendChild(option);
            });
        }

        // Muat tabel untuk bulan dan tahun yang dipilih
        renderScheduleTable(currentYear, currentMonth);
    }

    function enterScheduleEditMode() {
        isScheduleEditMode = true;
        scheduleChanges = {}; // Reset changes when entering edit mode
        ui.btnEditSchedule.classList.add('hidden');
        ui.scheduleEditButtons.classList.remove('hidden');
        ui.scheduleTableContainer.classList.add('edit-mode-active');
        lucide.createIcons();
    }

    function exitScheduleEditMode(shouldReload = false) {
        isScheduleEditMode = false;
        scheduleChanges = {};
        ui.btnEditSchedule.classList.remove('hidden');
        ui.scheduleEditButtons.classList.add('hidden');
        ui.scheduleTableContainer.classList.remove('edit-mode-active');
        if (shouldReload) {
            // Reload the table to discard local UI changes
            renderScheduleTable(parseInt(ui.scheduleYearSelect.value), parseInt(ui.scheduleMonthSelect.value));
        }
    }

    /**
     * Recalculates and updates the summary columns for a specific employee's row.
     * @param {string|number} userId The ID of the user whose row needs updating.
     */
    function updateRowSummary(userId) {
        const employee = currentAssignments.find(emp => emp.id.toString() === userId.toString());
        const targetRow = ui.scheduleTableBody.querySelector(`tr:has(td[data-user-id="${userId}"])`);
        if (!employee || !targetRow) return;

        const summary = { workDays: 0 };
        currentAbsenceTypeCodes.forEach(code => summary[code] = 0);

        // Calculate summary from the employee's dailyAssignments in the data model
        Object.values(employee.dailyAssignments).forEach(assignment => {
            if (assignment) {
                if (assignment.type === 'work') {
                    summary.workDays++;
                } else if (assignment.type === 'absence' && summary.hasOwnProperty(assignment.code)) {
                    summary[assignment.code]++;
                }
            }
        });

        let paidDays = summary.workDays;
        for (const code in summary) {
            if (Object.prototype.hasOwnProperty.call(summary, code) && code !== 'workDays' && code.toUpperCase() !== 'UL') {
                paidDays += summary[code];
            }
        }

        // Update the DOM for the summary cells
        const summaryCells = targetRow.querySelectorAll('.summary-col');
        if (summaryCells.length > 0) {
            summaryCells[0].textContent = summary.workDays;
            summaryCells[1].textContent = paidDays;
            currentAbsenceTypeCodes.forEach((code, index) => {
                if (summaryCells[2 + index]) summaryCells[2 + index].textContent = summary[code] || 0;
            });
        }
    }

    /**
     * Menangani ekspor template jadwal ke file Excel.
     * Template ini akan berisi dropdown untuk setiap hari.
     */
    async function handleExportScheduleTemplate() {
        const exportButton = ui.btnExportScheduleTemplate;
        const originalText = exportButton.querySelector('span').textContent;
        exportButton.disabled = true;
        exportButton.querySelector('span').textContent = 'Exporting...';

        try {
            // 1. Dapatkan tahun dan bulan yang dipilih
            const year = parseInt(ui.scheduleYearSelect.value, 10);
            const month = parseInt(ui.scheduleMonthSelect.value, 10); // 0-11
            const monthName = ui.scheduleMonthSelect.options[ui.scheduleMonthSelect.selectedIndex].text;

            // 2. Ambil data yang diperlukan secara paralel
            const [employeesResult, workSchedules, absenceTypes] = await Promise.all([
                fetchData(`/admin/users?status=active&limit=1000`), // Ambil semua karyawan aktif
                fetchData('/admin/work-schedules'),
                fetchData('/admin/absence-types')
            ]);

            if (!employeesResult?.data || !workSchedules || !absenceTypes) {
                alert('Gagal mengambil data yang diperlukan untuk templat.');
                return;
            }

            // 3. Siapkan data untuk Excel
            const employees = employeesResult.data.filter(u => u.role === 'user');
            const scheduleCodes = workSchedules.map(ws => ws.code);
            const absenceCodes = absenceTypes.map(at => at.code);
            const allCodes = [...scheduleCodes, ...absenceCodes, 'OFF']; // Tambahkan 'OFF' sebagai opsi
            const allCodesString = allCodes.join(',');

            const daysInMonth = new Date(year, month + 1, 0).getDate();

            const dataForExcel = employees.map(emp => {
                const row = { 'user_id': emp.id, 'full_name': emp.fullName || emp.username };
                for (let day = 1; day <= daysInMonth; day++) row[`day_${day}`] = '';
                return row;
            });

            // 4. Buat worksheet dan tambahkan validasi data (dropdown)
            const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
            for (let i = 0; i < employees.length; i++) {
                for (let day = 1; day <= daysInMonth; day++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: i + 1, c: day + 1 });
                    if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
                    worksheet[cellAddress].s = {
                        dataValidation: {
                            type: 'list', allowBlank: true, formula1: `"${allCodesString}"`,
                            showDropDown: true, errorStyle: 'warning',
                            error: 'Silakan pilih kode yang valid dari daftar.', errorTitle: 'Kode Tidak Valid'
                        }
                    };
                }
            }

            // 5. Buat sheet instruksi dan daftar kode
            const instructionsSheet = XLSX.utils.json_to_sheet([
                { A: 'Instruksi Pengisian' }, { A: '1. Jangan mengubah kolom user_id dan full_name.' },
                { A: '2. Isi setiap kolom hari (day_1, day_2, dst.) dengan kode jadwal dari dropdown.' },
                { A: '3. Daftar kode yang valid ada di sheet "Schedule Codes".' },
                { A: '4. Simpan file dan gunakan fitur "Upload Schedule" (fitur akan datang).' }
            ], { header: ["A"], skipHeader: true });
            instructionsSheet['!cols'] = [{ wch: 70 }];

            const codesSheet = XLSX.utils.json_to_sheet(allCodes.map(code => ({ 'Valid Codes': code })));
            codesSheet['!cols'] = [{ wch: 20 }];

            // 6. Buat workbook dan unduh file
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule Template');
            XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
            XLSX.utils.book_append_sheet(workbook, codesSheet, 'Schedule Codes');
            XLSX.writeFile(workbook, `Schedule_Template_${year}_${monthName}.xlsx`);

        } finally {
            // Kembalikan state tombol ke semula
            exportButton.disabled = false;
            exportButton.querySelector('span').textContent = originalText;
        }
    }

    /**
     * Handles the upload of a schedule template Excel file.
     * @param {Event} event - The file input change event.
     */
    async function handleUploadScheduleTemplate(event) {
        const file = event.target.files[0];
        if (!file) return;

        const uploadButton = ui.btnUploadScheduleTemplate;
        const originalText = uploadButton.querySelector('span').textContent;
        uploadButton.disabled = true;
        uploadButton.querySelector('span').textContent = 'Uploading...';

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    throw new Error("The Excel file is empty or in an incorrect format.");
                }

                // Transform data for the backend
                const changes = {};
                json.forEach(row => {
                    const userId = row.user_id;
                    if (!userId) return; // Skip rows without a user_id

                    changes[userId] = {};
                    for (const key in row) {
                        if (key.startsWith('day_')) {
                            const day = key.split('_')[1];
                            const code = row[key];
                            // Only include cells that have a value
                            if (code !== undefined && code !== null && String(code).trim() !== '') {
                                changes[userId][day] = code;
                            }
                        }
                    }
                });

                const year = ui.scheduleYearSelect.value;
                const month = parseInt(ui.scheduleMonthSelect.value) + 1; // 1-12

                const payload = { year, month, changes };

                const result = await fetchData('/admin/schedule-assignments/upload', { method: 'POST', body: JSON.stringify(payload) });

                if (result) {
                    alert(`Schedule uploaded successfully! ${result.insertedOrUpdated || 0} assignments were processed.`);
                    renderScheduleTable(year, month - 1); // Refresh table
                }
            } catch (error) {
                alert(`Failed to upload schedule: ${error.message}`);
            } finally {
                uploadButton.disabled = false;
                uploadButton.querySelector('span').textContent = originalText;
                event.target.value = ''; // Reset file input
            }
        };
        reader.readAsArrayBuffer(file);
    }

    /**
     * Merender tabel penjadwalan karyawan untuk bulan dan tahun tertentu.
     * @param {number} year 
     * @param {number} month - (0-11)
     */
    async function renderScheduleTable(year, month) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        ui.scheduleTableHeader.innerHTML = `<tr><th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Loading...</th></tr>`;
        ui.scheduleTableBody.innerHTML = `<tr><td class="px-6 py-4 text-center" colspan="36"><div class="flex items-center justify-center text-slate-500"><i data-lucide="loader-2" class="animate-spin mr-2"></i>Loading schedule data...</div></td></tr>`;
        lucide.createIcons();
    
        const daysInMonth = new Date(year, month + 1, 0).getDate();
    
        // Fetch all data in parallel
        const [allEmployeesResult, assignmentsData, absenceTypes] = await Promise.all([
            fetchData(`/admin/users?status=active&limit=1000`), // Fetch all active users
            fetchData(`/admin/schedule-assignments?year=${year}&month=${month + 1}`),
            fetchData('/admin/absence-types')
        ]);
        
        const allEmployees = allEmployeesResult?.data || [];
        const assignments = assignmentsData || [];
        const absenceTypeCodes = currentAbsenceTypeCodes = (absenceTypes || []).map(at => at.code).sort();
    
        if (!allEmployeesResult) {
             const colspan = 3 + daysInMonth + 2 + (absenceTypeCodes.length > 0 ? absenceTypeCodes.length : 0);
            ui.scheduleTableBody.innerHTML = `<tr><td class="px-6 py-4 text-center text-red-500" colspan="${colspan}">Failed to load employees.</td></tr>`;
            return;
        }
    
        // --- Group assignments by user ---
        const employeesMap = new Map();
        
        // 1. Initialize map with all active employees
        allEmployees.forEach(employee => {
            if (employee.role !== 'user') return;
            employeesMap.set(employee.id, {
                id: employee.id,
                username: employee.username,
                fullName: employee.fullName,
                position: employee.positionName,
                employeeStatus: employee.employeeStatusName || '-',
                department: employee.departmentName || 'No Department',
                role: employee.role,
                dailyAssignments: {}
            });
        });

        // 2. Populate assignments for employees who have them
        assignments.forEach(assignment => {
            if (employeesMap.has(assignment.userId)) {
                const employee = employeesMap.get(assignment.userId);
                // assignment_date dari backend bisa berupa YYYY-MM-DD atau ISO datetime (mis. 2026-06-28T17:00:00.000Z)
                let day;
                const raw = String(assignment.assignmentDate || '');
                const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (m) {
                    day = parseInt(m[3], 10);
                } else {
                    const dt = new Date(raw);
                    // pakai UTC date agar konsisten untuk skenario timezone offset
                    day = dt.getUTCDate();
                }

                if (!Number.isFinite(day)) {
                    console.warn('Invalid assignmentDate from backend, skipped:', assignment.assignmentDate);
                    return;
                }

                let assignmentDetails = null;
                if (assignment.workScheduleId) {
                    assignmentDetails = {
                        id: assignment.workScheduleId,
                        name: assignment.workScheduleName,
                        code: assignment.workScheduleCode,
                        type: 'work'
                    };
                } else if (assignment.absenceTypeId) {
                    assignmentDetails = {
                        id: assignment.absenceTypeId,
                        name: assignment.absenceTypeName,
                        code: assignment.absenceTypeCode,
                        type: 'absence'
                    };
                }
                employee.dailyAssignments[day] = assignmentDetails;
            }
        });

        const employees = Array.from(employeesMap.values());
        currentAssignments = employees; // Store grouped data

        // --- Render Header ---
        let headerHTML = `
            <tr>
                <th scope="col" class="sticky-col first-col px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Employee</th>
                <th scope="col" class="sticky-col second-col px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Position</th>
                <th scope="col" class="sticky-col third-col px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
        `;
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay(); // 0 for Sunday, 6 for Saturday
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            const isToday = date.getTime() === today.getTime();
            const dayAbbr = date.toLocaleDateString('en-US', { weekday: 'short' });

            let bgClass = '';
            let textClass = '';
            if (isToday) {
                bgClass = 'bg-blue-100 ring-1 ring-blue-300';
                textClass = 'text-blue-800';
            } else if (isSunday) {
                bgClass = 'bg-red-50';
                textClass = 'text-red-700';
            } else if (isSaturday) {
                bgClass = 'bg-slate-100';
            }
            headerHTML += `<th scope="col" class="day-col px-2 py-3 text-center text-xs font-medium text-slate-500 tracking-wider ${bgClass}"><div class="uppercase ${textClass}">${dayAbbr}</div><div class="mt-1 text-sm font-bold text-slate-700 ${textClass}">${String(day).padStart(2, '0')}</div></th>`;
        }
        // Add summary headers
        headerHTML += `<th scope="col" class="summary-col px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Work Days</th>`;
        headerHTML += `<th scope="col" class="summary-col px-4 py-3 text-center text-xs font-medium text-green-800 uppercase tracking-wider bg-green-50">Paid Days</th>`;
        absenceTypeCodes.forEach(code => {
            headerHTML += `<th scope="col" class="summary-col px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">${code}</th>`;
        });
        headerHTML += `</tr>`;
        ui.scheduleTableHeader.innerHTML = headerHTML;
    
        // --- Render Body ---
        ui.scheduleTableBody.innerHTML = '';
        const colspan = 3 + daysInMonth + 2 + absenceTypeCodes.length;
        if (employees.length === 0) {
            ui.scheduleTableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-8 text-slate-500">No active employees found.</td></tr>`;
            return;
        }

        // Group employees by department, preserving original order
        const deptGroups = [];
        const deptIndex = new Map();
        employees.forEach(emp => {
            const dept = emp.department;
            if (!deptIndex.has(dept)) {
                deptIndex.set(dept, deptGroups.length);
                deptGroups.push({ name: dept, employees: [] });
            }
            deptGroups[deptIndex.get(dept)].employees.push(emp);
        });

        // Daily stat accumulators
        const dailyStats = {};
        for (let d = 1; d <= daysInMonth; d++) {
            dailyStats[d] = { total: 0, byShift: {} };
        }
        const allShiftNames = new Set();

        deptGroups.forEach(group => {
            // Department header row
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `<td colspan="${colspan}" class="px-6 py-2 text-xs font-bold uppercase tracking-widest text-white bg-slate-500 border-b border-slate-600">${group.name}</td>`;
            ui.scheduleTableBody.appendChild(headerRow);

            group.employees.forEach(employee => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b border-slate-300 hover:bg-slate-50';

            const summary = { workDays: 0 };
            absenceTypeCodes.forEach(code => summary[code] = 0);

            let rowHTML = `
                <td class="sticky-col first-col px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    <span>${employee.fullName || employee.username}</span>
                    <button class="btn-copy-schedule p-1 ml-2 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600 align-middle" title="Copy this schedule" data-user-id="${employee.id}" data-username="${employee.username}">
                        <i data-lucide="copy" class="w-3 h-3 pointer-events-none"></i>
                    </button>
                </td>
                <td class="sticky-col second-col px-6 py-4 whitespace-nowrap text-sm text-slate-500">${employee.position || '-'}</td>
                <td class="sticky-col third-col px-4 py-4 whitespace-nowrap text-xs font-semibold text-slate-600">${employee.employeeStatus}</td>
            `;

            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dayOfWeek = date.getDay();
                const isSunday = dayOfWeek === 0;
                const isSaturday = dayOfWeek === 6;
                const isToday = date.getTime() === today.getTime();

                let bgClass = '';
                if (isToday) {
                    bgClass = 'bg-blue-50';
                } else if (isSunday) {
                    bgClass = 'bg-red-50';
                } else if (isSaturday) {
                    bgClass = 'bg-slate-100';
                }

                let assignmentText = '';
                let assignmentId = '';
                let scheduleClass = '';

                const dailyAssignment = employee.dailyAssignments[day];

                if (dailyAssignment) {
                     if (dailyAssignment.type === 'absence') {
                        assignmentText = dailyAssignment.name || '';
                        assignmentId = `absence-${dailyAssignment.id}`;
                        scheduleClass += ' text-red-500 font-semibold';
                        if (summary.hasOwnProperty(dailyAssignment.code)) {
                            summary[dailyAssignment.code]++;
                        }
                    } else { // 'work' or default
                        assignmentText = dailyAssignment.name || '';
                        assignmentId = `work-${dailyAssignment.id}`;
                        scheduleClass += ' font-semibold';
                        summary.workDays++;
                        // Accumulate daily stats
                        dailyStats[day].total++;
                        const sn = dailyAssignment.name || 'Other';
                        dailyStats[day].byShift[sn] = (dailyStats[day].byShift[sn] || 0) + 1;
                        allShiftNames.add(sn);
                    }
                }

                rowHTML += `
                    <td class="day-col schedule-cell px-2 py-4 text-sm text-center text-slate-700 ${bgClass} ${scheduleClass}"
                        data-user-id="${employee.id}"
                        data-day="${day}"
                        data-username="${employee.username}"
                        data-assignment-id="${assignmentId}">
                        ${assignmentText}
                    </td>`;
            }

            let paidDays = summary.workDays;
            for (const code in summary) {
                if (Object.prototype.hasOwnProperty.call(summary, code) && code !== 'workDays' && code.toUpperCase() !== 'UL') {
                    paidDays += summary[code];
                }
            }
            rowHTML += `<td class="summary-col px-4 py-4 text-sm text-center font-bold text-slate-800 bg-slate-50">${summary.workDays}</td>`;
            rowHTML += `<td class="summary-col px-4 py-4 text-sm text-center font-bold text-green-800 bg-green-50">${paidDays}</td>`;
            absenceTypeCodes.forEach(code => {
                rowHTML += `<td class="summary-col px-4 py-4 text-sm text-center font-bold text-slate-800 bg-slate-50">${summary[code] || 0}</td>`;
            });
            row.innerHTML = rowHTML;
            ui.scheduleTableBody.appendChild(row);
            }); // end group.employees.forEach
        }); // end deptGroups.forEach

        // --- Render Footer: total per day & per shift ---
        ui.scheduleTableFooter.innerHTML = '';
        const summaryCols = 2 + absenceTypeCodes.length;

        // Helper to build day cells for a footer row
        function buildFooterDayCells(getValue, bgBase) {
            let cells = '';
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dow = date.getDay();
                let bg = bgBase;
                if (date.getTime() === today.getTime()) bg = 'bg-blue-100';
                else if (dow === 0) bg = 'bg-red-50';
                else if (dow === 6) bg = 'bg-slate-100';
                const val = getValue(day);
                cells += `<td class="day-col px-2 py-2 text-xs text-center font-bold ${bg}">${val > 0 ? val : '-'}</td>`;
            }
            return cells;
        }

        // Row: Total Masuk
        const totalRow = document.createElement('tr');
        totalRow.className = 'bg-blue-50 border-t-2 border-blue-300';
        let totalHTML = `<td class="schedule-footer-label px-6 py-2 text-xs font-bold text-blue-800 bg-blue-50" colspan="3">Total Masuk</td>`;
        totalHTML += buildFooterDayCells(day => dailyStats[day].total, 'bg-blue-50');
        totalHTML += `<td class="summary-col px-4 py-2 bg-blue-50" colspan="${summaryCols}"></td>`;
        totalRow.innerHTML = totalHTML;
        ui.scheduleTableFooter.appendChild(totalRow);

        // Rows: per shift name (sorted)
        const shiftColors = [
            { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
            { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
            { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
            { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
        ];
        Array.from(allShiftNames).sort().forEach((shiftName, i) => {
            const c = shiftColors[i % shiftColors.length];
            const shiftRow = document.createElement('tr');
            shiftRow.className = `${c.bg} border-t ${c.border}`;
            let shiftHTML = `<td class="schedule-footer-label px-6 py-2 text-xs font-semibold ${c.text} ${c.bg}" colspan="3">${shiftName}</td>`;
            shiftHTML += buildFooterDayCells(day => dailyStats[day].byShift[shiftName] || 0, c.bg);
            shiftHTML += `<td class="summary-col px-4 py-2 ${c.bg}" colspan="${summaryCols}"></td>`;
            shiftRow.innerHTML = shiftHTML;
            ui.scheduleTableFooter.appendChild(shiftRow);
        });

        lucide.createIcons();
    }

    /**
     * Handles clicks on a schedule cell to open the change modal.
     */
    async function handleScheduleCellClick(e) {
        const cell = e.target.closest('.schedule-cell');
        if (!cell) return;

        const userId = cell.dataset.userId;
        const day = cell.dataset.day;
        const username = cell.dataset.username;
        const currentAssignmentId = cell.dataset.assignmentId; // e.g., "work-1", "absence-2"
        const year = ui.scheduleYearSelect.value;
        const month = ui.scheduleMonthSelect.value; // 0-11

        const date = new Date(year, month, day);
        const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // Fetch all available work schedules and absence types to populate the dropdown
        const [allSchedules, allAbsenceTypes] = await Promise.all([
            fetchData('/admin/work-schedules'),
            fetchData('/admin/absence-types')
        ]);

        if (!allSchedules || !allAbsenceTypes) {
            alert('Failed to load schedules or absence types for selection.');
            return;
        }

        showScheduleChangeModal({
            userId,
            username,
            date: `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            formattedDate,
            schedules: allSchedules,
            absenceTypes: allAbsenceTypes,
            currentAssignmentId
        });
    }

    /**
     * Shows and populates the daily schedule change modal.
     */
    function showScheduleChangeModal(options) {
        const { userId, username, date, formattedDate, schedules, absenceTypes, currentAssignmentId } = options;

        ui.scheduleChangeModalTitle.textContent = `Change Schedule`;
        ui.scheduleChangeModalSubtitle.textContent = `${username} on ${formattedDate}`;
        document.getElementById('schedule-change-user-id').value = userId;
        document.getElementById('schedule-change-date').value = date;

        const select = ui.scheduleChangeSelect;
        select.innerHTML = '';

        // Option to clear assignment (revert to default)
        const clearOption = document.createElement('option');
        clearOption.value = '';
        clearOption.textContent = 'Default Schedule';
        select.appendChild(clearOption);

        // Work Schedules
        const workGroup = document.createElement('optgroup');
        workGroup.label = 'Work Schedules';
        schedules.forEach(schedule => {
            const option = document.createElement('option');
            option.value = `work-${schedule.id}`;
            option.textContent = `${schedule.name} (${schedule.code})`;
            workGroup.appendChild(option);
        });
        select.appendChild(workGroup);

        // Absence Types
        const absenceGroup = document.createElement('optgroup');
        absenceGroup.label = 'Absence Types';
        absenceTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = `absence-${type.id}`;
            option.textContent = `${type.name} (${type.code})`;
            absenceGroup.appendChild(option);
        });
        select.appendChild(absenceGroup);

        select.value = currentAssignmentId;

        ui.scheduleChangeModal.classList.remove('hidden');
        ui.scheduleChangeModal.classList.add('flex');
    }

    function hideScheduleChangeModal() {
        ui.scheduleChangeModal.classList.add('hidden');
        ui.scheduleChangeModal.classList.remove('flex');
    }

    async function handleScheduleChangeSubmit(e) {
        e.preventDefault();
        // This function now only updates the local state and UI, not the database directly.
        const userId = document.getElementById('schedule-change-user-id').value;
        const dateStr = document.getElementById('schedule-change-date').value; // "YYYY-MM-DD"
        // Perbaikan: Menggunakan `new Date()` dapat menyebabkan masalah zona waktu.
        // Contoh: `new Date('2024-05-20T00:00:00')` di zona waktu UTC+13 akan menjadi
        // `2024-05-19T11:00:00.000Z`, dan `.getDate()` akan mengembalikan 19, bukan 20.
        // Mengurai hari langsung dari string 'YYYY-MM-DD' jauh lebih aman dan tidak terpengaruh timezone.
        const day = parseInt(dateStr.split('-')[2], 10);
        const newAssignmentId = ui.scheduleChangeSelect.value; // e.g., "work-1", "absence-2", or ""
        const selectedOption = ui.scheduleChangeSelect.options[ui.scheduleChangeSelect.selectedIndex];
        const newAssignmentText = selectedOption.textContent.split(' (')[0]; // Get "Shift Pagi" from "Shift Pagi (PAGI)"
        const newAssignmentCode = selectedOption.textContent.match(/\(([^)]+)\)/)?.[1] || newAssignmentText;

        // Store the change locally
        if (!scheduleChanges[userId]) {
            scheduleChanges[userId] = {};
        }
        // The backend will need to parse this prefixed ID.
        scheduleChanges[userId][day] = newAssignmentId;

        // Update the in-memory data model to reflect the change
        const employee = currentAssignments.find(emp => emp.id.toString() === userId);
        if (employee) {
            if (newAssignmentId) {
                const [type, id] = newAssignmentId.split('-');
                employee.dailyAssignments[day] = {
                    id: id,
                    type: type,
                    name: newAssignmentText,
                    code: newAssignmentCode,
                };
            } else {
                // If assignment is cleared, remove it from the model
                delete employee.dailyAssignments[day];
            }
        }

        // Update the UI of the cell directly
        const cell = ui.scheduleTableBody.querySelector(`td[data-user-id="${userId}"][data-day="${day}"]`);
        if (cell) {
            // Always show the name part for consistency
            cell.textContent = newAssignmentText;
            cell.dataset.assignmentId = newAssignmentId;
            // Update styling
            cell.classList.remove('text-red-500', 'font-semibold');
            if (newAssignmentId.startsWith('absence-')) {
                cell.classList.add('text-red-500', 'font-semibold');
            } else if (newAssignmentId) { // Any non-empty assignment is an override
                cell.classList.add('font-semibold');
            }
        }

        // Recalculate and update the summary columns for the row
        updateRowSummary(userId);

        hideScheduleChangeModal();
    }

    async function handleSaveScheduleChanges() {
        if (Object.keys(scheduleChanges).length === 0) {
            alert("No changes to save.");
            exitScheduleEditMode();
            return;
        }

        const year = ui.scheduleYearSelect.value;
        const month = parseInt(ui.scheduleMonthSelect.value) + 1; // 1-12 for backend

        const payload = { year, month, changes: scheduleChanges };

        console.log("Sending payload to backend:", JSON.stringify(payload, null, 2));

        ui.btnSaveScheduleChanges.disabled = true;
        ui.btnSaveScheduleChanges.querySelector('span').textContent = 'Saving...';

        const result = await fetchData('/admin/schedule-assignments/bulk', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });

        ui.btnSaveScheduleChanges.disabled = false;
        ui.btnSaveScheduleChanges.querySelector('span').textContent = 'Save Changes';

        if (result) {
            alert("Schedule changes saved successfully!");
            exitScheduleEditMode(true); // Force reload to confirm data persistence from backend
        }
    }

    /**
     * Handles clicks on the copy schedule button.
     */
    function handleCopyScheduleClick(e) {
        const button = e.target.closest('.btn-copy-schedule');
        if (!button) return;

        const sourceUserId = button.dataset.userId;
        const sourceUsername = button.dataset.username;

        // Filter out the source user from the list of targets
        const targetEmployees = currentAssignments.filter(emp => emp.id.toString() !== sourceUserId && emp.role === 'user');

        showCopyScheduleModal(sourceUserId, sourceUsername, targetEmployees);
    }

    /**
     * Shows and populates the copy schedule modal.
     */
    function showCopyScheduleModal(sourceUserId, sourceUsername, targets) {
        ui.copyScheduleModalTitle.textContent = 'Copy Schedule';
        ui.copyScheduleModalSubtitle.textContent = `From: ${sourceUsername}`;
        document.getElementById('copy-schedule-source-user-id').value = sourceUserId;

        const targetList = ui.copyScheduleTargetList;
        targetList.innerHTML = '';

        if (targets.length === 0) {
            targetList.innerHTML = '<p class="text-slate-500 text-sm text-center">No other employees to copy to.</p>';
        } else {
            targets.forEach(target => {
                const label = document.createElement('label');
                label.className = 'flex items-center p-2 rounded-md hover:bg-slate-50 cursor-pointer';
                label.innerHTML = `
                    <input type="checkbox" name="target_employees" value="${target.id}" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    <span class="ml-3 text-sm font-medium text-slate-800">${target.username}</span>
                `;
                label.dataset.name = target.username.toLowerCase();
                targetList.appendChild(label);
            });
        }

        // Reset search and select all
        ui.copyScheduleSearch.value = '';
        ui.copyScheduleSelectAll.checked = false;

        ui.copyScheduleModal.classList.remove('hidden');
        ui.copyScheduleModal.classList.add('flex');
    }

    /**
     * Hides the copy schedule modal.
     */
    function hideCopyScheduleModal() {
        ui.copyScheduleModal.classList.add('hidden');
        ui.copyScheduleModal.classList.remove('flex');
    }

    /**
     * Handles the submission of the copy/paste schedule form.
     */
    function handlePasteScheduleSubmit(e) {
        e.preventDefault();
        const sourceUserId = document.getElementById('copy-schedule-source-user-id').value;
        const targetUserIds = Array.from(document.querySelectorAll('#copy-schedule-target-list input:checked')).map(cb => cb.value);

        if (targetUserIds.length === 0) {
            alert('Please select at least one employee to paste the schedule to.');
            return;
        }

        const sourceEmployee = currentAssignments.find(emp => emp.id.toString() === sourceUserId);
        if (!sourceEmployee) {
            alert('Could not find the source employee data. Please try again.');
            return;
        }

        const year = parseInt(ui.scheduleYearSelect.value);
        const month = parseInt(ui.scheduleMonthSelect.value);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Apply changes
        targetUserIds.forEach(targetId => {
            const targetEmployee = currentAssignments.find(emp => emp.id.toString() === targetId);
            if (!targetEmployee) return;

            if (!scheduleChanges[targetId]) {
                scheduleChanges[targetId] = {};
            }

            for (let day = 1; day <= daysInMonth; day++) {
                // Determine the source assignment for the day
                const sourceAssignmentForDay = sourceEmployee.dailyAssignments[day];

                let assignmentId = '';
                let assignmentText = '';
                let scheduleClass = '';

                if (sourceAssignmentForDay) {
                    // Update the in-memory model for the target employee
                    targetEmployee.dailyAssignments[day] = sourceAssignmentForDay;

                    if (sourceAssignmentForDay.type === 'absence') {
                        assignmentId = `absence-${sourceAssignmentForDay.id}`;
                        assignmentText = sourceAssignmentForDay.name || '';
                        scheduleClass = 'text-red-500 font-semibold';
                    } else { // 'work' or default
                        assignmentId = `work-${sourceAssignmentForDay.id}`;
                        assignmentText = sourceAssignmentForDay.name || '';
                        scheduleClass = 'font-semibold';
                    }
                } else {
                    // If source has no assignment, clear it for the target
                    delete targetEmployee.dailyAssignments[day];
                }

                // Store the change
                scheduleChanges[targetId][day] = assignmentId;

                // Update the UI for the target cell
                const targetCell = ui.scheduleTableBody.querySelector(`td[data-user-id="${targetId}"][data-day="${day}"]`);
                if (targetCell) {
                    targetCell.textContent = assignmentText;
                    targetCell.dataset.assignmentId = assignmentId;
                    targetCell.className = targetCell.className.replace(/text-red-500|font-semibold/g, '').trim(); // Clear old styles
                    if (scheduleClass) targetCell.classList.add(...scheduleClass.split(' '));
                }
            }

            // After all days are processed for a user, update their summary row
            updateRowSummary(targetId);
        });

        hideCopyScheduleModal();
        alert(`Schedule copied to ${targetUserIds.length} employee(s). Click 'Save Changes' to make it permanent.`);
    }

    /**
     * Mengganti tab aktif di halaman daftar karyawan.
     * @param {'active'|'inactive'} activeTab 
     */
    function switchEmployeeTab(activeTab) {
        const activeClasses = ['text-blue-600', 'border-blue-600'];
        const inactiveClasses = ['text-slate-500', 'border-transparent', 'hover:text-slate-700', 'hover:border-slate-300'];

        if (activeTab === 'active') {
            ui.tabActiveEmployees.classList.add(...activeClasses);
            ui.tabActiveEmployees.classList.remove(...inactiveClasses);
            ui.tabInactiveEmployees.classList.add(...inactiveClasses);
            ui.tabInactiveEmployees.classList.remove(...activeClasses);
        } else {
            ui.tabInactiveEmployees.classList.add(...activeClasses);
            ui.tabInactiveEmployees.classList.remove(...inactiveClasses);
            ui.tabActiveEmployees.classList.add(...inactiveClasses);
            ui.tabActiveEmployees.classList.remove(...activeClasses);
        }
    }

    // --- End of Management Functions ---

    /**
     * Mengatur navigasi khusus untuk bagian pengaturan dengan mengubah hash URL.
     */
    function setupSettingsNavigation() {
        // Event listener untuk kartu di halaman pengaturan
        document.getElementById('card-settings-user')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#settings/users'; });
        document.getElementById('card-settings-role')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#settings/roles'; });
        document.getElementById('card-settings-position')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#settings/positions'; });
        document.getElementById('card-settings-department')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#settings/departments'; });
        document.getElementById('card-settings-work-schedule')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#settings/work-schedules'; });
        document.getElementById('card-settings-employee-status')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#settings/employee-status'; });
        document.getElementById('card-settings-employee-level')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#settings/employee-levels'; });
        document.getElementById('card-settings-marital-status')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#settings/marital-status'; });
        document.getElementById('card-settings-location')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#settings/location'; });
    }

    /**
     * Event delegation handler for actions within the schedule table.
     */
    function handleScheduleActions(e) {
        // Only allow actions in edit mode
        if (!isScheduleEditMode) return;

        const copyBtn = e.target.closest('.btn-copy-schedule');
        if (copyBtn) {
            handleCopyScheduleClick(e);
            return;
        }

        const scheduleCell = e.target.closest('.schedule-cell');
        if (scheduleCell) {
            handleScheduleCellClick(e);
            return;
        }
    }
    /**
     * Menangani perubahan hash di URL untuk navigasi SPA (Single Page Application).
     * Fungsi ini menampilkan view yang sesuai dan memperbarui state UI.
     */
    function handleRouteChange() {
        const hash = window.location.hash || '#dashboard';

        // Sembunyikan semua view utama dan sub-view
        Object.values(ui.mainViews).forEach(view => view?.classList.add('hidden'));
        ui.viewSettingsUser.classList.add('hidden');
        ui.viewReportAttendance.classList.add('hidden');
        ui.viewReportLeave.classList.add('hidden');
        ui.viewRequests.classList.add('hidden');
        ui.viewSettingsRole.classList.add('hidden');
        ui.viewSettingsPosition.classList.add('hidden');
        ui.viewSettingsDepartment.classList.add('hidden');
        ui.viewSettingsWorkSchedule.classList.add('hidden');
        ui.viewSettingsEmployeeStatus.classList.add('hidden');
        ui.viewSettingsEmployeeLevels.classList.add('hidden');
        ui.viewSettingsMaritalStatus.classList.add('hidden');
        ui.viewSettingsLocation.classList.add('hidden');
        ui.viewAttendanceLog.classList.add('hidden');
        ui.viewSchedule.classList.add('hidden');
        ui.viewEmployeeProfile.classList.add('hidden');

        // Reset semua style link navigasi
        ui.navLinks.forEach(nav => {
            nav.classList.remove('text-white', 'bg-blue-600', 'shadow-md');
            nav.classList.add('text-slate-600', 'hover:bg-slate-100');
        });

        let activeLink;
        let viewToShow;

        // Close sidebar on route change (for mobile)
        if (window.innerWidth < 1024) {
            closeSidebar();
        }

        if (hash.startsWith('#employees/')) {
            const userId = hash.split('/')[1];
            viewToShow = ui.viewEmployeeProfile;
            activeLink = document.getElementById('nav-employees');
            // Buat proses menjadi async untuk menyisipkan data tambahan setelah profil utama dimuat
            (async () => {
                // 1. Biarkan fungsi asli merender profil dasar
                await showEmployeeProfile(userId);

                // 2. Ambil detail tambahan dari endpoint baru kita
                const extraData = await fetchData(`/admin/employees/${userId}/extra-details`);
                if (!extraData) return;

                // 3. Temukan kartu "Job Information" dan sisipkan data baru
                // Asumsi kartu tersebut memiliki <h3> dengan teks "Job Information"
                const jobInfoCard = Array.from(ui.viewEmployeeProfile.querySelectorAll('h3'))
                                         .find(h3 => h3.textContent.trim() === 'Job Information')?.closest('.bg-white');

                if (jobInfoCard) {
                    const infoContainer = jobInfoCard.querySelector('.space-y-1'); // FIX: Selector yang benar adalah space-y-1
                    if (infoContainer) {
                        // Tambahkan kembali border bawah ke elemen terakhir yang sudah ada
                        if (infoContainer.lastElementChild) {
                            infoContainer.lastElementChild.classList.add('border-b');
                        }

                        // Format periode kontrak — parseLocal menghindari UTC midnight → wrong day shift
                        const parseLocal = (s) => { const [y, m, d] = String(s).substring(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
                        const fmtLocal = (s) => s ? parseLocal(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';
                        const startDate = fmtLocal(extraData.contractStartDate);
                        const endDate   = fmtLocal(extraData.contractEndDate);
                        const contractPeriod = `${startDate} - ${endDate}`;

                        // Buat dan tambahkan elemen Periode Kontrak
                        const contractDiv = document.createElement('div');
                        // FIX: Gunakan gaya yang konsisten dengan baris lainnya
                        contractDiv.className = 'flex justify-between items-start border-b border-slate-100 py-3';
                        contractDiv.innerHTML = `
                            <span class="text-sm text-slate-500">Contract Period</span>
                            <span class="text-sm font-semibold text-slate-700 text-right">${contractPeriod}</span>`;
                        infoContainer.appendChild(contractDiv);

                        // Buat dan tambahkan elemen Sisa Cuti dengan tombol edit adjustment
                        const leaveDiv = document.createElement('div');
                        leaveDiv.className = 'flex flex-col gap-2 border-b border-slate-100 py-3';
                        const leaveColor = extraData.remainingLeave <= 0 ? 'text-red-600' : extraData.remainingLeave <= 3 ? 'text-orange-500' : 'text-green-600';
                        const adjSign = extraData.leaveAdjustment > 0 ? '+' : '';
                        const adjNote = extraData.leaveAdjustment !== 0
                            ? `<span class="text-xs text-slate-400 ml-1">(adj: ${adjSign}${extraData.leaveAdjustment})</span>`
                            : '';
                        leaveDiv.innerHTML = `
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-slate-500">Remaining Annual Leave</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-semibold ${leaveColor}">${extraData.remainingLeave} days${adjNote ? '' : ''}</span>
                                    ${adjNote}
                                    <button id="btn-edit-leave-adj" title="Adjust Leave Balance" class="text-slate-400 hover:text-blue-600 transition-colors">
                                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            </div>
                            <div id="leave-adj-form" class="hidden bg-slate-50 rounded-xl p-3 flex flex-col gap-2 border border-slate-200">
                                <p class="text-xs text-slate-500">Base: ${extraData.leaveEntitlement} hari &nbsp;|&nbsp; Diambil: ${extraData.leaveTaken} hari</p>
                                <p class="text-xs text-slate-400">Adjustment = koreksi manual (+ untuk tambah, - untuk kurangi)</p>
                                <div class="flex items-center gap-2">
                                    <input id="leave-adj-input" type="number" value="${extraData.leaveAdjustment}"
                                        class="w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-400"
                                        placeholder="0" />
                                    <span class="text-xs text-slate-500">hari</span>
                                    <button id="btn-save-leave-adj" class="ml-auto bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700">Simpan</button>
                                    <button id="btn-cancel-leave-adj" class="text-slate-500 text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-slate-200">Batal</button>
                                </div>
                            </div>`;
                        infoContainer.appendChild(leaveDiv);

                        // Event listeners untuk edit leave adjustment
                        lucide.createIcons();
                        const leaveAdjForm = leaveDiv.querySelector('#leave-adj-form');
                        leaveDiv.querySelector('#btn-edit-leave-adj').addEventListener('click', () => {
                            leaveAdjForm.classList.toggle('hidden');
                        });
                        leaveDiv.querySelector('#btn-cancel-leave-adj').addEventListener('click', () => {
                            leaveAdjForm.classList.add('hidden');
                        });
                        leaveDiv.querySelector('#btn-save-leave-adj').addEventListener('click', async () => {
                            const newAdj = parseInt(leaveDiv.querySelector('#leave-adj-input').value, 10);
                            if (isNaN(newAdj)) return;
                            const saveBtn = leaveDiv.querySelector('#btn-save-leave-adj');
                            saveBtn.disabled = true;
                            saveBtn.textContent = 'Menyimpan...';
                            const result = await fetchData(`/admin/employees/${userId}/leave-adjustment`, {
                                method: 'PUT',
                                body: JSON.stringify({ adjustment: newAdj }),
                                headers: { 'Content-Type': 'application/json' }
                            });
                            if (result) {
                                // Reload profile untuk tampilkan nilai terbaru
                                window.location.hash = `#employees/${userId}`;
                            } else {
                                saveBtn.disabled = false;
                                saveBtn.textContent = 'Simpan';
                            }
                        });

                        // Hapus border dari elemen terakhir yang baru ditambahkan
                        if (infoContainer.lastElementChild) {
                            infoContainer.lastElementChild.classList.remove('border-b');
                        }
                    }
                }
            })();
        } else {
            switch (hash) {
                case '#dashboard':
                    viewToShow = ui.mainViews['nav-dashboard'];
                    activeLink = document.getElementById('nav-dashboard');
                    populateDepartmentFilter(); // Panggil fungsi baru untuk mengisi filter
                    renderDashboardStats(); // Render awal dengan semua departemen
                    renderWeeklyAttendanceChart(chartEndDate, ui.dashboardDepartmentFilter.value);
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Dashboard';
                    renderGenderDistributionChart(ui.dashboardDepartmentFilter.value);
                    break;
                case '#employees':
                    viewToShow = ui.mainViews['nav-employees'];
                    activeLink = document.getElementById('nav-employees');
                    loadEmployeeTable(); // Muat tabel karyawan
                    break;
                case '#requests':
                    viewToShow = ui.viewRequests;
                    activeLink = document.getElementById('nav-requests');
                    loadRequests('pending'); // Load pending requests by default
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Requests';
                    break;
                case '#reports':
                    viewToShow = ui.viewReports;
                    activeLink = document.getElementById('nav-reports');
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Reports';
                    break;
                case '#reports/attendance':
                    viewToShow = ui.viewReportAttendance;
                    activeLink = document.getElementById('nav-reports'); // Keep reports menu active
                    initAttendanceReportPage();
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Attendance Report';
                    break;
                case '#reports/leave':
                    viewToShow = ui.viewReportLeave;
                    activeLink = document.getElementById('nav-reports'); // Keep reports menu active
                    initLeaveReportPage();
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Leave Report';
                    break;
                case '#schedule':
                    viewToShow = ui.viewSchedule;
                    activeLink = document.getElementById('nav-schedule');
                    loadScheduleView();
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Schedule';
                    break;
                case '#attendance-log':
                    viewToShow = ui.viewAttendanceLog;
                    activeLink = document.getElementById('nav-attendance-log');
                    loadAttendanceLog(); // Muat log absensi
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Attendance Log';
                    break;
                case '#settings':
                    viewToShow = ui.mainViews['nav-settings'];
                    activeLink = document.getElementById('nav-settings');
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Settings';
                    break;
                case '#settings/users':
                    viewToShow = ui.viewSettingsUser;
                    activeLink = document.getElementById('nav-settings'); // Tetap aktifkan menu Pengaturan
                    loadUsers(); // Muat tabel manajemen user
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'User Settings';
                    break;
                case '#settings/roles':
                    viewToShow = ui.viewSettingsRole;
                    activeLink = document.getElementById('nav-settings'); // Tetap aktifkan menu Pengaturan
                    loadRoles(); // Muat data role saat view ini ditampilkan
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Role Settings';
                    break;
                case '#settings/positions':
                    viewToShow = ui.viewSettingsPosition;
                    activeLink = document.getElementById('nav-settings');
                    loadPositions(); // Muat data jabatan
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Position Settings';
                    break;
                case '#settings/departments':
                    viewToShow = ui.viewSettingsDepartment;
                    activeLink = document.getElementById('nav-settings');
                    loadDepartments(); // Muat data departemen
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Department Settings';
                    break;
                case '#settings/work-schedules':
                    viewToShow = ui.viewSettingsWorkSchedule;
                    activeLink = document.getElementById('nav-settings');
                    switchScheduleSettingsTab('work-schedules'); // Set default tab
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Schedule Settings';
                    break;
                case '#settings/employee-status':
                    viewToShow = ui.viewSettingsEmployeeStatus;
                    activeLink = document.getElementById('nav-settings');
                    loadEmployeeStatuses();
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Employee Status';
                    break;
                case '#settings/employee-levels':
                    viewToShow = ui.viewSettingsEmployeeLevels;
                    activeLink = document.getElementById('nav-settings');
                    loadEmployeeLevels();
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Employee Levels';
                    break;
                case '#settings/marital-status':
                    viewToShow = ui.viewSettingsMaritalStatus;
                    activeLink = document.getElementById('nav-settings');
                    loadMaritalStatuses();
                    if (ui.mobilePageTitle) ui.mobilePageTitle.textContent = 'Marital Status';
                    break;
                case '#settings/location':
                    viewToShow = ui.viewSettingsLocation;
                    activeLink = document.getElementById('nav-settings');
                    loadLocationSettings();
                    break;
                default:
                    viewToShow = ui.mainViews['nav-dashboard'];
                    activeLink = document.getElementById('nav-dashboard');
                    window.location.hash = '#dashboard'; // Perbaiki URL jika tidak valid
                    break;
            }
        }

        if (viewToShow) {
            viewToShow.classList.remove('hidden');
        }

        if (activeLink) {
            activeLink.classList.add('text-white', 'bg-blue-600', 'shadow-md');
            activeLink.classList.remove('text-slate-600', 'hover:bg-slate-100');
        }

        // Render ulang ikon untuk memastikan ikon di view baru ditampilkan
        lucide.createIcons();
    }

    /**
     * Inisialisasi Aplikasi Admin
     */
    async function init() {
        // Initialize event listeners for all tables that use delegation
        initUserEventListeners();
        initPositionEventListeners();
        initRoleEventListeners();
        initDepartmentEventListeners();
        initWorkScheduleEventListeners();
        initEmployeeStatusEventListeners();
        initEmployeeLevelEventListeners();
        initMaritalStatusEventListeners();
        initAbsenceTypeEventListeners();
        initLocationSettingsEventListeners();

        // Mobile navigation event listeners
        if (ui.hamburgerBtn) {
            ui.hamburgerBtn.addEventListener('click', openSidebar);
        }
        if (ui.sidebarOverlay) {
            ui.sidebarOverlay.addEventListener('click', closeSidebar);
        }
        // Close sidebar when a nav link is clicked on mobile
        ui.navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 1024) closeSidebar();
            });
        });

        // Event listener untuk filter departemen di dashboard
        if (ui.dashboardDepartmentFilter) {
            ui.dashboardDepartmentFilter.addEventListener('change', (e) => {
                const departmentId = e.target.value;
                renderDashboardStats(departmentId);
                renderWeeklyAttendanceChart(chartEndDate, departmentId); // Perbarui grafik juga
                renderGenderDistributionChart(departmentId); // Perbarui grafik gender juga
            });
        }

        // Event listeners for chart navigation
        if (ui.btnPrevWeek) {
            ui.btnPrevWeek.addEventListener('click', () => {
                chartEndDate.setDate(chartEndDate.getDate() - 7);
                const departmentId = ui.dashboardDepartmentFilter.value;
                renderWeeklyAttendanceChart(chartEndDate, departmentId);
            });
            ui.btnNextWeek.addEventListener('click', () => {
                chartEndDate.setDate(chartEndDate.getDate() + 7);
                const departmentId = ui.dashboardDepartmentFilter.value;
                renderWeeklyAttendanceChart(chartEndDate, departmentId);
            });
            ui.btnThisWeek.addEventListener('click', () => {
                chartEndDate = new Date();
                const departmentId = ui.dashboardDepartmentFilter.value;
                renderWeeklyAttendanceChart(chartEndDate, departmentId);
            });
        }

        // Initialize listeners for the copy schedule modal
        if (ui.copyScheduleModal) {
            ui.copyScheduleForm.addEventListener('submit', handlePasteScheduleSubmit);
            ui.btnCancelCopyScheduleModal.addEventListener('click', hideCopyScheduleModal);
            ui.copyScheduleSearch.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const labels = ui.copyScheduleTargetList.querySelectorAll('label');
                labels.forEach(label => {
                    const name = label.dataset.name || '';
                    label.style.display = name.includes(searchTerm) ? 'flex' : 'none';
                });
            });
            ui.copyScheduleSelectAll.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const checkboxes = ui.copyScheduleTargetList.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    // Only check visible checkboxes if a search is active
                    if (cb.closest('label').style.display !== 'none') cb.checked = isChecked;
                });
            });
        }

        setupSettingsNavigation();

        // Setup router berbasis hash
        window.addEventListener('hashchange', handleRouteChange);
        handleRouteChange(); // Panggil sekali untuk menangani route awal saat load

        // Menangani link navigasi yang belum diimplementasikan
        document.querySelectorAll('.nav-unimplemented').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                alert('Halaman untuk menu ini sedang dalam pengembangan.');
            });
        });

        // Add event listeners for the new request tabs
        ui.requestTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                loadRequests(tab.dataset.status);
            });
        });

        // Request table: approve/reject + view detail
        if (ui.requestsTableBody) {
            ui.requestsTableBody.addEventListener('click', async (e) => {
                const viewBtn = e.target.closest('.request-view-btn');
                if (viewBtn) {
                    const req = JSON.parse(decodeURIComponent(viewBtn.dataset.req));
                    await showRequestDetailModal(req);
                    return;
                }
                const deleteBtn = e.target.closest('.request-delete-btn');
                if (deleteBtn) {
                    const requestId = deleteBtn.dataset.requestId;
                    if (!confirm('Hapus pengajuan ini? Tindakan ini tidak bisa dibatalkan.')) return;
                    const result = await fetchData(`/admin/requests/${requestId}`, { method: 'DELETE' });
                    if (result) {
                        const activeTab = ui.requestTabs
                            ? [...ui.requestTabs].find(t => t.classList.contains('text-blue-600'))?.dataset.status || 'pending'
                            : 'pending';
                        loadRequests(activeTab);
                    }
                    return;
                }
                handleRequestAction(e);
            });
        }
        if (ui.requestDetailCloseBtn) {
            ui.requestDetailCloseBtn.addEventListener('click', closeRequestDetailModal);
        }
        if (ui.requestDetailModal) {
            ui.requestDetailModal.addEventListener('click', (e) => {
                if (e.target === ui.requestDetailModal) closeRequestDetailModal();
            });
        }

        // Listen for custom event to reload employee table when a user is changed from the user modal
        document.addEventListener('user-data-changed', async () => {
            if (window.location.hash === '#employees') {
                await loadEmployeeTable();
            }
        });

        // Event listener untuk modal user
        ui.btnAddUser.addEventListener('click', () => showUserModal());
        ui.btnCancelUserModal.addEventListener('click', hideUserModal);
        ui.userForm.addEventListener('submit', handleUserSubmit);

        // Event listener untuk modal role
        ui.btnAddRole.addEventListener('click', () => showRoleModal());
        ui.btnCancelRoleModal.addEventListener('click', hideRoleModal);
        ui.roleForm.addEventListener('submit', handleRoleSubmit);
        
        // Event listener untuk modal jabatan
        ui.btnAddPosition.addEventListener('click', () => showPositionModal());
        ui.btnCancelPositionModal.addEventListener('click', hidePositionModal);
        ui.positionForm.addEventListener('submit', handlePositionSubmit);
        
        // Event listener untuk modal departemen
        ui.btnAddDepartment.addEventListener('click', () => showDepartmentModal());
        ui.btnCancelDepartmentModal.addEventListener('click', hideDepartmentModal);
        ui.departmentForm.addEventListener('submit', handleDepartmentSubmit);

        // Event listener untuk tombol "Add Employee"
        if (ui.btnAddEmployee) {
            ui.btnAddEmployee.addEventListener('click', () => showAddEmployeeModal());
        }

        // Event listener untuk tombol "Import Excel"
        if (ui.btnBulkImportEmployee) {
            ui.btnBulkImportEmployee.addEventListener('click', () => showBulkImportModal());
        }
        initBulkImportEvents();

        // Event listener for new Add Employee Modal
        if (ui.addEmployeeModal) {
            ui.btnCancelAddEmployeeModal.addEventListener('click', hideAddEmployeeModal);
            ui.addEmployeeForm.addEventListener('submit', handleAddEmployeeFormSubmit);
        }

        // Event listener untuk modal jam kerja
        ui.btnAddWorkSchedule.addEventListener('click', () => showWorkScheduleModal());
        ui.btnCancelWorkScheduleModal.addEventListener('click', hideWorkScheduleModal);
        ui.workScheduleForm.addEventListener('submit', handleWorkScheduleSubmit);

        // Event listener untuk modal status karyawan
        ui.btnAddEmployeeStatus.addEventListener('click', () => showEmployeeStatusModal());
        ui.btnCancelEmployeeStatusModal.addEventListener('click', hideEmployeeStatusModal);
        ui.employeeStatusForm.addEventListener('submit', handleEmployeeStatusFormSubmit);

        // Event listener untuk modal employee level
        ui.btnAddEmployeeLevel.addEventListener('click', () => showEmployeeLevelModal());
        ui.btnCancelEmployeeLevelModal.addEventListener('click', hideEmployeeLevelModal);
        ui.employeeLevelForm.addEventListener('submit', handleEmployeeLevelFormSubmit);

        // Event listener untuk modal marital status
        ui.btnAddMaritalStatus.addEventListener('click', () => showMaritalStatusModal());
        ui.btnCancelMaritalStatusModal.addEventListener('click', hideMaritalStatusModal);
        ui.maritalStatusForm.addEventListener('submit', handleMaritalStatusFormSubmit);

        // Event listeners for schedule settings tabs
        if (ui.tabWorkSchedules) {
            ui.tabWorkSchedules.addEventListener('click', () => switchScheduleSettingsTab('work-schedules'));
        }
        if (ui.tabAbsenceTypes) {
            ui.tabAbsenceTypes.addEventListener('click', () => switchScheduleSettingsTab('absence-types'));
        }

        // Event listener untuk modal absence type
        ui.btnAddAbsenceType.addEventListener('click', () => showAbsenceTypeModal());
        ui.btnCancelAbsenceTypeModal.addEventListener('click', hideAbsenceTypeModal);
        ui.absenceTypeForm.addEventListener('submit', handleAbsenceTypeFormSubmit);

        // Event listener untuk modal detail profil karyawan
        ui.btnCancelProfileDetailsModal.addEventListener('click', hideProfileDetailsModal);
        ui.profileDetailsForm.addEventListener('submit', handleProfileDetailsFormSubmit);

        // Event listener untuk modal profil
        if (ui.btnProfileSettings) {
            ui.btnProfileSettings.addEventListener('click', showProfileModal);
        }
        if (ui.btnCancelProfileModal) {
            ui.btnCancelProfileModal.addEventListener('click', hideProfileModal);
        }
        if (ui.profileForm) {
            ui.profileForm.addEventListener('submit', handleProfileFormSubmit);
        }
        if (ui.profileAvatarUpload) {
            ui.profileAvatarUpload.addEventListener('change', handleProfileAvatarChange);
        }

        // Event listener untuk pencarian user
        if (ui.searchUserInput) {
            ui.searchUserInput.addEventListener('input', handleUserSearch);
        }

        // Event listener untuk pencarian karyawan (di grid)
        if (ui.searchEmployeeInput) {
            ui.searchEmployeeInput.addEventListener('input', handleEmployeeSearch);
        }

        // Event listener untuk tab karyawan
        if (ui.tabActiveEmployees) {
            ui.tabActiveEmployees.addEventListener('click', () => {
                switchEmployeeTab('active');
                loadEmployeeTable(1, 'active');
            });
        }
        if (ui.tabInactiveEmployees) {
            ui.tabInactiveEmployees.addEventListener('click', () => {
                switchEmployeeTab('inactive');
                loadEmployeeTable(1, 'inactive');
            });
        }

        // Event listener untuk date picker di halaman attendance log
        if (ui.attendanceDatePicker) {
            ui.attendanceDatePicker.addEventListener('change', (e) => {
                loadAttendanceLog(e.target.value);
            });
        }

        // Event listener untuk filter bulan dan tahun di halaman schedule
        if (ui.scheduleMonthSelect) {
            ui.scheduleMonthSelect.addEventListener('change', () => {
                renderScheduleTable(parseInt(ui.scheduleYearSelect.value), parseInt(ui.scheduleMonthSelect.value));
            });
        }
        if (ui.scheduleYearSelect) {
            ui.scheduleYearSelect.addEventListener('change', () => {
                renderScheduleTable(parseInt(ui.scheduleYearSelect.value), parseInt(ui.scheduleMonthSelect.value));
            });
        }
        if (ui.scheduleTableBody) {
            ui.scheduleTableBody.addEventListener('click', handleScheduleActions);
            ui.scheduleChangeForm.addEventListener('submit', handleScheduleChangeSubmit);
            ui.btnCancelScheduleChangeModal.addEventListener('click', hideScheduleChangeModal);
        }
        // Event listeners for schedule edit mode controls
        if (ui.btnEditSchedule) {
            ui.btnEditSchedule.addEventListener('click', enterScheduleEditMode);
        }
        if (ui.btnUploadScheduleTemplate) {
            ui.btnUploadScheduleTemplate.addEventListener('click', () => ui.scheduleUploadInput.click());
            ui.scheduleUploadInput.addEventListener('change', handleUploadScheduleTemplate);
        }
        if (ui.btnExportScheduleTemplate) {
            ui.btnExportScheduleTemplate.addEventListener('click', handleExportScheduleTemplate);
        }
        if (ui.btnCancelScheduleEdit) {
            ui.btnCancelScheduleEdit.addEventListener('click', () => exitScheduleEditMode(true)); // Discard changes and reload
        }
        if (ui.btnSaveScheduleChanges) {
            ui.btnSaveScheduleChanges.addEventListener('click', handleSaveScheduleChanges);
        }

        // Event listener untuk tombol export
        if (ui.btnExportAttendance) {
            ui.btnExportAttendance.addEventListener('click', handleExportAttendance);
        }

        // Render UI dasar terlebih dahulu
        await renderBaseUI();

        // Kemudian render data dinamis
        // (Catatan: Endpoint API di bawah ini adalah asumsi dan perlu dibuat di backend)
        // renderDashboardStats() sekarang dipanggil di dalam handleRouteChange
        await renderRecentActivity();
        await updatePendingRequestCount();
        // renderWeeklyAttendanceChart() sekarang dipanggil di dalam handleRouteChange

        // Tambahkan event listener
        ui.logoutButton.addEventListener('click', logout);
    }

    // --- Jalankan Aplikasi ---
    init();
});