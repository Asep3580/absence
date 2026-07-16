'use strict';

import { fetchData, logout } from './api.js';
import { loadAttendanceStatus, openAttendanceModal, handleAttendanceConfirmation, openLocationPreview } from './attendance.js';
import { renderSchedule } from './schedule.js';
import { loadUserProfile, personalizeView, initKPIChart, openEditProfileModal, saveProfileChanges } from './profile.js';
import { renderHistory } from './history.js';
import { updateClock, updateLocationData, initModalMap, toggleModal } from './ui.js';
import { loadInbox, openCsHistoryModal } from './requests.js';
import { requestNotificationPermission, scheduleReminders } from './reminder.js';

// --- SECURITY CHECK ---
// Redirect to login if not authenticated. This should be the very first thing.
const token = localStorage.getItem('accessToken');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
    window.location.href = 'login.html';
    // Use a function that never resolves to stop all further script execution
    await new Promise(() => {});
}
// If a superadmin somehow lands here, redirect them to their dashboard
if (user.role === 'superadmin') {
    window.location.href = 'saas-admin.html';
    await new Promise(() => {});
}

const app = {
    // --- STATE ---
    state: {
        user: user, // Initial user info from login
        token: token,
        modalMap: null,
        modalMarker: null,
        currentCoords: { lat: -6.2088, lng: 106.8456 },
        currentAddress: "Finding location...",
        isClockedIn: false,
        historyData: [],
        _geoWatchId: null,
        myRequests: [],
        currentSchedule: {
            month: new Date().getMonth(), // 0-11
            year: new Date().getFullYear()
        },
    },

    // --- DOM ELEMENTS ---
    dom: {},

    // --- INITIALIZATION ---
    async init() {
        this.cacheDom();
        this.bindEvents();
        lucide.createIcons();
        try {
            await loadUserProfile(this);
            await loadAttendanceStatus(this);
            personalizeView(this);
            this.renderInitialView();
        } catch (err) {
            console.error('Init error:', err);
            if (this.dom.headerUsername) this.dom.headerUsername.textContent = 'Koneksi gagal';
        }
    },

    cacheDom() {
        this.dom = {
            // General
            greetingText: document.getElementById('greeting-text'),
            greetingName: document.getElementById('greeting-name'),
            currentTime: document.getElementById('current-time'),
            currentDate: document.getElementById('current-date'),
            currentAddress: document.getElementById('current-address'),
            btnRefreshLocation: document.getElementById('btn-refresh-location'),
            iconRefreshLoc: document.getElementById('icon-refresh-loc'),
            logoutButton: document.getElementById('logout-btn'),

            // Header
            headerUsername: document.getElementById('header-username'),
            headerAvatar: document.getElementById('header-avatar'),

            // Profile View
            profileAvatar: document.getElementById('profile-avatar'),
            profileFullName: document.getElementById('profile-fullName'),
            profilePosition: document.getElementById('profile-position'),
            profileNik: document.getElementById('profile-nik'),
            profileEmployeeStatus: document.getElementById('profile-employeeStatus'),
            profileDepartment: document.getElementById('profile-department'),
            profileBranch: document.getElementById('profile-branch'),
            profileJoinDate: document.getElementById('profile-joinDate'),
            profileManager: document.getElementById('profile-manager'), // Note: No data source yet
            profileBirthdate: document.getElementById('profile-birthdate'),
            profileGender: document.getElementById('profile-gender'),
            profileReligion: document.getElementById('profile-religion'),
            profileMaritalStatus: document.getElementById('profile-maritalStatus'),
            profileEmail: document.getElementById('profile-email'),
            profilePhone: document.getElementById('profile-phone'),
            profileEmergencyContactName: document.getElementById('profile-emergencyContactName'),
            profileEmergencyContactPhone: document.getElementById('profile-emergencyContactPhone'),

            todayScheduleCard: document.getElementById('today-schedule-card'),

            // Modals & Attendance
            modalAddress: document.getElementById('modal-address'),
            btnAttendance: document.getElementById('btn-attendance'),
            btnText: document.getElementById('btn-text'),
            statusIn: document.getElementById('status-in'),
            statusOut: document.getElementById('status-out'),
            confirmAttendance: document.getElementById('confirm-attendance'),
            scheduleList: document.getElementById('schedule-list'),
            scheduleMonthYear: document.getElementById('schedule-month-year'),
            btnSchedulePrev: document.getElementById('btn-schedule-prev'),
            btnScheduleNext: document.getElementById('btn-schedule-next'),
            scheduleSummaryContainer: document.getElementById('schedule-summary-container'),
            historyList: document.getElementById('history-list'),
            messagesList: document.getElementById('messages-list'),
            
            // Navigation
            btnNotification: document.getElementById('btn-notification'),
            navHome: document.getElementById('nav-home'),
            navHistory: document.getElementById('nav-history'),
            navScheduleBtn: document.getElementById('nav-schedule-btn'),
            navMessages: document.getElementById('nav-messages'),
            navProfile: document.getElementById('nav-profile'),

            // Self Service Buttons
            btnServiceLeave: document.getElementById('btn-service-leave'),
            btnServicePermission: document.getElementById('btn-service-permission'),
            btnServiceOvertime: document.getElementById('btn-service-overtime'),
            btnServiceReimburse: document.getElementById('btn-service-reimburse'),
            btnServiceAll: document.getElementById('btn-service-all'),
            btnCloseAllServices: document.getElementById('btn-close-all-services'),
            modalServiceLeave: document.getElementById('modal-service-leave'),
            modalServicePermission: document.getElementById('modal-service-permission'),
            modalServiceOvertime: document.getElementById('modal-service-overtime'),
            modalServiceReimburse: document.getElementById('modal-service-reimburse'),
            
            // Modal Controls
            btnCloseGeoModal: document.getElementById('btn-close-geo-modal'),
            btnCloseLeaveModal: document.getElementById('btn-close-leave-modal'),
            remainingLeaveDisplay: document.getElementById('remaining-leave-display'), // Tampilan sisa cuti
            leaveTypeSelect: document.getElementById('leave-type-select'), // Dropdown baru
            btnSubmitLeave: document.getElementById('btn-submit-leave'),
            fileLeave: document.getElementById('file-leave'),
            btnClosePermissionModal: document.getElementById('btn-close-permission-modal'),
            btnSubmitPermission: document.getElementById('btn-submit-permission'),
            filePermission: document.getElementById('file-permission'),
            btnCloseOvertimeModal: document.getElementById('btn-close-overtime-modal'),
            btnSubmitOvertime: document.getElementById('btn-submit-overtime'),
            btnCloseReimburseModal: document.getElementById('btn-close-reimburse-modal'),
            btnSubmitReimburse: document.getElementById('btn-submit-reimburse'),
            fileReimburse: document.getElementById('file-reimburse'),
            btnCloseCsModal: document.getElementById('btn-close-cs-modal'),
            btnSubmitCs: document.getElementById('btn-submit-cs'),
            btnCsHistory: document.getElementById('btn-cs-history'),
            btnCloseCsHistory: document.getElementById('btn-close-cs-history'),
            btnEditProfile: document.getElementById('btn-edit-profile'),
            btnCloseEditProfile: document.getElementById('btn-close-edit-profile'),
            btnSaveProfile: document.getElementById('btn-save-profile'),
        };
    },

    bindEvents() {
        if (this.dom.logoutButton) {
            this.dom.logoutButton.addEventListener('click', this.handlers.handleLogout);
        }
        // Navigation
        if (this.dom.btnAttendance) this.dom.btnAttendance.addEventListener('click', () => openAttendanceModal(app));
        if (this.dom.btnRefreshLocation) this.dom.btnRefreshLocation.addEventListener('click', () => {
            const icon = this.dom.iconRefreshLoc;
            if (icon) icon.classList.add('animate-spin');
            setTimeout(() => { if (icon) icon.classList.remove('animate-spin'); }, 20000);
            openLocationPreview(app);
        });
        if (this.dom.confirmAttendance) this.dom.confirmAttendance.addEventListener('click', () => handleAttendanceConfirmation(app));
        if (this.dom.btnNotification) this.dom.btnNotification.addEventListener('click', () => this.handlers.switchTab('messages'));
        if (this.dom.navHome) this.dom.navHome.addEventListener('click', () => this.handlers.switchTab('home'));
        if (this.dom.navHistory) this.dom.navHistory.addEventListener('click', () => this.handlers.switchTab('history'));
        if (this.dom.navScheduleBtn) this.dom.navScheduleBtn.addEventListener('click', () => this.handlers.switchTab('schedule'));
        if (this.dom.navMessages) this.dom.navMessages.addEventListener('click', () => this.handlers.switchTab('messages'));
        if (this.dom.navProfile) this.dom.navProfile.addEventListener('click', () => this.handlers.switchTab('profile'));
        if (this.dom.btnSchedulePrev) this.dom.btnSchedulePrev.addEventListener('click', () => this.handlers.navigateSchedule('prev'));
        if (this.dom.btnScheduleNext) this.dom.btnScheduleNext.addEventListener('click', () => this.handlers.navigateSchedule('next'));
 
        // Self Service
        if (this.dom.btnServiceLeave) this.dom.btnServiceLeave.addEventListener('click', () => this.handlers.openLeaveRequestModal());
        if (this.dom.btnServicePermission) this.dom.btnServicePermission.addEventListener('click', () => this.handlers.openModalWithTodayDate('permission-modal', 'permission-date'));
        if (this.dom.btnServiceOvertime) this.dom.btnServiceOvertime.addEventListener('click', () => this.handlers.openModalWithTodayDate('overtime-modal', 'overtime-date'));
        const btnPromptOvertime = document.getElementById('btn-prompt-overtime');
        if (btnPromptOvertime) btnPromptOvertime.addEventListener('click', () => this.handlers.openModalWithTodayDate('overtime-modal', 'overtime-date'));
        if (this.dom.btnServiceReimburse) this.dom.btnServiceReimburse.addEventListener('click', () => this.handlers.openModalWithTodayDate('reimburse-modal', 'reimburse-date'));
        if (this.dom.btnServiceAll) this.dom.btnServiceAll.addEventListener('click', () => toggleModal('all-services-modal', true));
        if (this.dom.btnCloseAllServices) this.dom.btnCloseAllServices.addEventListener('click', () => toggleModal('all-services-modal', false));
        if (this.dom.modalServiceLeave) this.dom.modalServiceLeave.addEventListener('click', () => { toggleModal('all-services-modal', false); this.handlers.openLeaveRequestModal(); });
        if (this.dom.modalServicePermission) this.dom.modalServicePermission.addEventListener('click', () => { toggleModal('all-services-modal', false); this.handlers.openModalWithTodayDate('permission-modal', 'permission-date'); });
        if (this.dom.modalServiceOvertime) this.dom.modalServiceOvertime.addEventListener('click', () => { toggleModal('all-services-modal', false); this.handlers.openModalWithTodayDate('overtime-modal', 'overtime-date'); });
        if (this.dom.modalServiceReimburse) this.dom.modalServiceReimburse.addEventListener('click', () => { toggleModal('all-services-modal', false); this.handlers.openModalWithTodayDate('reimburse-modal', 'reimburse-date'); });

        // Modal Controls
        if (this.dom.btnCloseGeoModal) this.dom.btnCloseGeoModal.addEventListener('click', () => {
            toggleModal('geo-modal', false);
            // Stop GPS watch when modal is closed
            if (app.state._geoWatchId != null) {
                navigator.geolocation.clearWatch(app.state._geoWatchId);
                app.state._geoWatchId = null;
            }
            const btn = document.getElementById('confirm-attendance');
            if (btn) btn.classList.remove('hidden');
        });
        if (this.dom.btnCloseLeaveModal) this.dom.btnCloseLeaveModal.addEventListener('click', () => toggleModal('leave-modal', false));
        if (this.dom.btnSubmitLeave) this.dom.btnSubmitLeave.addEventListener('click', (e) => this.handlers.handleLeaveRequestSubmit(e));
        if (this.dom.btnClosePermissionModal) this.dom.btnClosePermissionModal.addEventListener('click', () => toggleModal('permission-modal', false));
        if (this.dom.btnSubmitPermission) this.dom.btnSubmitPermission.addEventListener('click', () => this.handlers.submitPermission());
        if (this.dom.btnCloseOvertimeModal) this.dom.btnCloseOvertimeModal.addEventListener('click', () => toggleModal('overtime-modal', false));
        if (this.dom.btnSubmitOvertime) this.dom.btnSubmitOvertime.addEventListener('click', () => this.handlers.submitOvertime());
        if (this.dom.btnCloseReimburseModal) this.dom.btnCloseReimburseModal.addEventListener('click', () => toggleModal('reimburse-modal', false));
        if (this.dom.btnSubmitReimburse) this.dom.btnSubmitReimburse.addEventListener('click', () => this.handlers.submitReimburse());
        if (this.dom.fileReimburse) this.dom.fileReimburse.addEventListener('change', () => {
            const file = this.dom.fileReimburse.files[0];
            const nameEl = document.getElementById('reimburse-attachment-name');
            const label  = document.getElementById('reimburse-attachment-label');
            if (nameEl && file) {
                nameEl.textContent = file.name;
                label?.classList.add('border-green-400', 'text-green-600');
                label?.classList.remove('border-gray-300');
            }
        });
        if (this.dom.btnCloseCsModal) this.dom.btnCloseCsModal.addEventListener('click', () => toggleModal('change-schedule-modal', false));
        if (this.dom.btnSubmitCs) this.dom.btnSubmitCs.addEventListener('click', () => this.handlers.submitChangeSchedule());
        if (this.dom.btnCsHistory) this.dom.btnCsHistory.addEventListener('click', () => openCsHistoryModal(app));
        if (this.dom.btnCloseCsHistory) this.dom.btnCloseCsHistory.addEventListener('click', () => toggleModal('cs-history-modal', false));
        if (this.dom.btnEditProfile) this.dom.btnEditProfile.addEventListener('click', () => openEditProfileModal(app));
        if (this.dom.btnCloseEditProfile) this.dom.btnCloseEditProfile.addEventListener('click', () => toggleModal('edit-profile-modal', false));
        if (this.dom.btnSaveProfile) this.dom.btnSaveProfile.addEventListener('click', () => saveProfileChanges(app));

        // File Inputs
        if (this.dom.fileLeave) this.dom.fileLeave.addEventListener('change', this.handlers.handleFileInput);
        if (this.dom.filePermission) this.dom.filePermission.addEventListener('change', this.handlers.handleFileInput);
        if (this.dom.fileReimburse) this.dom.fileReimburse.addEventListener('change', this.handlers.handleFileInput);
    },

    renderInitialView() {
        updateClock(this);
        updateLocationData(this);
        renderHistory(this);
        this.handlers.renderTodaySchedule(this);
        // Load inbox in background so badge updates on home screen
        loadInbox(this);
        setInterval(() => updateClock(this), 1000);
    },

    // --- HANDLERS ---
    handlers: {
        handleLogout() {
            logout(); // Use the imported logout function
        },

        async switchTab(tabName) {
            document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
            const view = document.getElementById('view-' + tabName);
            if (view) view.classList.remove('hidden');
            
            document.querySelectorAll('.nav-item').forEach(n => n.classList.replace('text-blue-600', 'text-gray-400'));
            app.dom.navScheduleBtn.classList.remove('bg-indigo-600', 'scale-110');
            app.dom.navScheduleBtn.classList.add('bg-blue-600');

            const nav = document.getElementById('nav-' + tabName);
            if (nav) nav.classList.replace('text-gray-400', 'text-blue-600');
            else if (tabName === 'schedule') app.dom.navScheduleBtn.classList.add('bg-indigo-600', 'scale-110');

            if (tabName === 'schedule') {
                renderSchedule(app);
            }
            if (tabName === 'messages') {
                await loadInbox(app);
                lucide.createIcons();
            }
            if (tabName === 'history') {
                await initKPIChart(app);
            }
        },

        navigateSchedule(direction) {
            let { month, year } = app.state.currentSchedule;

            if (direction === 'prev') {
                month--;
                if (month < 0) {
                    month = 11;
                    year--;
                }
            } else { // 'next'
                month++;
                if (month > 11) {
                    month = 0;
                    year++;
                }
            }

            app.state.currentSchedule = { month, year };
            renderSchedule(app); // Muat ulang jadwal untuk bulan/tahun yang baru
            lucide.createIcons(); // Render ulang ikon jika ada yang baru
        },

        async renderTodaySchedule(app) {
            const card = app.dom.todayScheduleCard;
            if (!card) return;
        
            card.innerHTML = ``;
        
            const schedule = await fetchData('/user/schedule/today');

            if (!schedule) {
                card.innerHTML = ``;
                app.state.todayScheduleEndTime = null;
                return;
            }

            let content = '';
            const type = schedule.assignment_type;
            const name = schedule.work_schedule_name || schedule.absence_name || 'Day Off';
            const startTime = schedule.start_time?.substring(0, 5) || '--:--';
            const endTime = schedule.end_time?.substring(0, 5) || '--:--';

            // Simpan jam selesai kerja untuk validasi clock-out
            app.state.todayScheduleEndTime = (type === 'work' && schedule.end_time)
                ? schedule.end_time.substring(0, 5) : null;

            // Jadwalkan pengingat Clock In & Clock Out
            if (type === 'work' && schedule.start_time && schedule.end_time) {
                requestNotificationPermission();
                scheduleReminders(app, startTime, endTime);
            }

            if (type === 'work') {
                content = `<span>🕐 ${name} &nbsp;·&nbsp; ${startTime} – ${endTime}</span>`;
            } else {
                content = `<span>📅 ${name}</span>`;
            }
            card.innerHTML = content;
        },

        openChangeScheduleModal(year, month, day) {
            toggleModal('change-schedule-modal', true);
        },

        async submitChangeSchedule() {
            const targetDate     = document.getElementById('cs-selected-date')?.value;
            const targetShiftId  = document.getElementById('cs-target-shift')?.value;
            const colleagueId    = document.getElementById('cs-employee')?.value || null;
            const reason         = document.getElementById('cs-reason')?.value.trim();
            const btn            = app.dom.btnSubmitCs;

            if (!targetDate) {
                alert('Tanggal belum dipilih. Buka modal dari daftar jadwal.');
                return;
            }
            if (!targetShiftId) {
                alert('Pilih shift yang dituju terlebih dahulu.');
                return;
            }
            if (!reason) {
                alert('Alasan perubahan jadwal harus diisi.');
                return;
            }

            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i><span>Submitting...</span>';
            lucide.createIcons();

            try {
                await fetchData('/requests/change-schedule', {
                    method: 'POST',
                    body: JSON.stringify({
                        target_date: targetDate,
                        target_schedule_id: targetShiftId,
                        colleague_id: colleagueId || undefined,
                        reason
                    }),
                    headers: { 'Content-Type': 'application/json' }
                });

                toggleModal('change-schedule-modal', false);

                // Toast notification
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl bg-indigo-600 transition-opacity duration-300';
                toast.textContent = '✅ Permintaan perubahan jadwal berhasil dikirim!';
                document.body.appendChild(toast);
                setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 350); }, 3000);

                // Refresh inbox in background
                await loadInbox(app);
            } catch (err) {
                alert(`Gagal mengirim permintaan: ${err.message}`);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                lucide.createIcons();
            }
        },

        async openLeaveRequestModal() {
            const select = app.dom.leaveTypeSelect;
            if (!select) {
                alert("Error: Komponen UI untuk pengajuan cuti tidak ditemukan.");
                return;
            }

            // Reset form dan tampilkan status loading
            document.getElementById('leave-form').reset();
            select.innerHTML = '<option>Memuat tipe...</option>';
            select.disabled = true;
            if (app.dom.remainingLeaveDisplay) {
                app.dom.remainingLeaveDisplay.textContent = 'Menghitung...';
            }

            toggleModal('leave-modal', true);

            // Ambil data tipe absensi dan sisa cuti secara paralel
            const [absenceTypes, leaveBalance] = await Promise.all([
                fetchData('/user/absence-types'),
                fetchData('/user/leave-balance')
            ]);

            // Isi dropdown tipe cuti
            if (absenceTypes && absenceTypes.length > 0) {
                select.innerHTML = '<option value="">-- Pilih Tipe Cuti --</option>';
                absenceTypes.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.id;
                    option.textContent = `${type.name} (${type.code})`;
                    select.appendChild(option);
                });
                select.disabled = false;
            } else {
                select.innerHTML = '<option>Tidak ada tipe cuti tersedia</option>';
            }

            // Perbarui tampilan sisa cuti
            if (app.dom.remainingLeaveDisplay) {
                if (leaveBalance && leaveBalance.remainingDays !== undefined) {
                    app.dom.remainingLeaveDisplay.textContent = `${leaveBalance.remainingDays} Hari Tersedia`;
                } else {
                    app.dom.remainingLeaveDisplay.textContent = 'N/A Hari';
                }
            }
        },

        async handleLeaveRequestSubmit(e) {
            e.preventDefault();
            const form = document.getElementById('leave-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const formData = new FormData();
            formData.append('absence_type_id', document.getElementById('leave-type-select').value);
            formData.append('start_date', document.getElementById('leave-start-date').value);
            formData.append('end_date', document.getElementById('leave-end-date').value);
            formData.append('reason', document.getElementById('leave-reason').value);

            const fileInput = document.getElementById('file-leave');
            if (fileInput.files.length > 0) {
                formData.append('attachment', fileInput.files[0]);
            }

            // Kirim data menggunakan fetchData yang sudah di-setup untuk FormData
            const result = await fetchData('/requests', {
                method: 'POST',
                body: formData,
                // Jangan set 'Content-Type', browser akan melakukannya
            });

            if (result) {
                alert('Pengajuan cuti Anda telah berhasil dikirim.');
                toggleModal('leave-modal', false);
            }
        },

        openModalWithTodayDate(modalId, dateInputId) {
            const dateInput = document.getElementById(dateInputId);
            if (dateInput) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
            toggleModal(modalId, true);
        },

        async submitOvertime() {
            const date      = document.getElementById('overtime-date').value;
            const startTime = document.getElementById('overtime-start-time').value;
            const endTime   = document.getElementById('overtime-end-time').value;
            const reason    = document.getElementById('overtime-reason').value.trim();

            if (!date)      { alert('Tanggal lembur harus diisi.'); return; }
            if (!startTime) { alert('Jam mulai lembur harus diisi.'); return; }
            if (!endTime)   { alert('Jam selesai lembur harus diisi.'); return; }
            if (!reason)    { alert('Deskripsi tugas lembur harus diisi.'); return; }

            const fullReason = `${startTime} – ${endTime} | ${reason}`;

            const formData = new FormData();
            formData.append('request_type', 'overtime');
            formData.append('start_date', date);
            formData.append('end_date', date);
            formData.append('reason', fullReason);

            const btn = document.getElementById('btn-submit-overtime');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i><span>Submitting...</span>';
            lucide.createIcons();

            try {
                const result = await fetchData('/requests', { method: 'POST', body: formData });
                if (result) {
                    toggleModal('overtime-modal', false);
                    // Reset form
                    ['overtime-date', 'overtime-start-time', 'overtime-end-time', 'overtime-reason'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    });
                    const toast = document.createElement('div');
                    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl bg-green-600 transition-opacity duration-300';
                    toast.textContent = '✅ Pengajuan lembur berhasil dikirim!';
                    document.body.appendChild(toast);
                    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 350); }, 2500);
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                lucide.createIcons();
            }
        },

        async submitReimburse() {
            const date        = document.getElementById('reimburse-date').value;
            const type        = document.getElementById('reimburse-type').value;
            const amount      = document.getElementById('reimburse-amount').value;
            const description = document.getElementById('reimburse-description').value.trim();
            const file        = document.getElementById('file-reimburse').files[0];

            if (!date)        { alert('Tanggal nota harus diisi.'); return; }
            if (!amount || Number(amount) <= 0) { alert('Nominal harus diisi.'); return; }
            if (!description) { alert('Keterangan / tujuan harus diisi.'); return; }
            if (!file)        { alert('Foto / scan nota wajib dilampirkan.'); return; }

            const formatted = Number(amount).toLocaleString('id-ID');
            const reason    = `[${type}] Rp ${formatted} | ${description}`;

            const formData = new FormData();
            formData.append('request_type', 'reimburse');
            formData.append('start_date', date);
            formData.append('end_date', date);
            formData.append('reason', reason);
            formData.append('attachment', file);

            const btn = document.getElementById('btn-submit-reimburse');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i><span>Submitting...</span>';
            lucide.createIcons();

            try {
                const result = await fetchData('/requests', { method: 'POST', body: formData });
                if (result) {
                    toggleModal('reimburse-modal', false);
                    // Reset form
                    ['reimburse-date', 'reimburse-amount', 'reimburse-description'].forEach(id => {
                        const el = document.getElementById(id); if (el) el.value = '';
                    });
                    document.getElementById('file-reimburse').value = '';
                    const nameEl = document.getElementById('reimburse-attachment-name');
                    if (nameEl) nameEl.textContent = 'Take Photo of Receipt';
                    const label = document.getElementById('reimburse-attachment-label');
                    label?.classList.remove('border-green-400', 'text-green-600');
                    label?.classList.add('border-gray-300');

                    const toast = document.createElement('div');
                    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl bg-green-600 transition-opacity duration-300';
                    toast.textContent = '✅ Klaim reimbursement berhasil dikirim!';
                    document.body.appendChild(toast);
                    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 350); }, 2500);
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                lucide.createIcons();
            }
        },

        async submitPermission() {
            const type   = document.getElementById('permission-type')?.value;
            const date   = document.getElementById('permission-date')?.value;
            const time   = document.getElementById('permission-time')?.value;
            const reason = document.getElementById('permission-reason')?.value?.trim();

            if (!date || !reason) {
                alert('Tanggal dan alasan harus diisi.');
                return;
            }

            const btn = app.dom.btnSubmitPermission;
            const origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i><span>Mengirim...</span>';
            lucide.createIcons();

            try {
                await fetchData('/requests', {
                    method: 'POST',
                    body: JSON.stringify({
                        request_type: 'permission',
                        permission_type: type,
                        start_date: date,
                        end_date: date,
                        reason: time ? `[${time}] ${reason}` : reason,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                });

                toggleModal('permission-modal', false);
                document.getElementById('permission-early-notice')?.classList.add('hidden');

                const toast = document.createElement('div');
                toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl bg-green-600 transition-opacity duration-300';
                toast.textContent = '✅ Izin berhasil diajukan. Menunggu persetujuan.';
                document.body.appendChild(toast);
                setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 350); }, 3000);
            } catch (err) {
                alert(`Gagal mengirim izin: ${err.message}`);
            } finally {
                btn.disabled = false;
                btn.innerHTML = origHtml;
                lucide.createIcons();
            }
        },

        submitGeneric(modalId, message) {
            alert(message);
            toggleModal(modalId, false);
        },

        handleFileInput(event) {
            const file = event.target.files[0];
            if (file) {
                alert(`Dokumen '${file.name}' berhasil dipilih.`);
            }
        }
    }
};

// Initialize the application
window.addEventListener('load', () => app.init());