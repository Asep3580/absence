import { fetchData } from './api.js';
import { updateLocationData, initModalMap, toggleModal } from './ui.js';
import { renderHistory } from './history.js';
import { openFaceVerifyModal } from './face-verify.js';

function showInModalError(message) {
    const banner = document.getElementById('geo-status-banner');
    if (!banner) return;
    banner.className = 'rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 text-sm font-semibold bg-red-50 border border-red-200 text-red-700';
    banner.innerHTML = `<span class="text-lg shrink-0">🚫</span><span>${message}</span>`;
    banner.classList.remove('hidden');
}

function showToast(message, type = 'success') {
    const colors = {
        success: 'bg-green-600',
        info:    'bg-blue-600',
        error:   'bg-red-600',
    };
    const toast = document.createElement('div');
    toast.className = `fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl ${colors[type] || colors.success} transition-opacity duration-300`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 350); }, 2500);
}

function _openGeoModal(app, previewOnly = false) {
    const banner = document.getElementById('geo-status-banner');
    const btn    = document.getElementById('confirm-attendance');
    if (banner) { banner.className = 'hidden'; banner.innerHTML = ''; }
    if (btn) {
        if (previewOnly) {
            btn.classList.add('hidden');
        } else {
            btn.disabled = false;
            btn.className = 'w-full bg-blue-600 text-white py-4.5 rounded-2xl font-bold flex items-center justify-center space-x-2';
        }
    }

    toggleModal('geo-modal', true);
    initModalMap(app);
    updateLocationData(app);
    setTimeout(() => {
        if (app.state.modalMap) {
            app.state.modalMap.invalidateSize();
            app.state.modalMap.setView([app.state.currentCoords.lat, app.state.currentCoords.lng], 17);
        }
    }, 350);
}

export function openLocationPreview(app) {
    _openGeoModal(app, true);
}

/**
 * Opens the attendance flow.
 * For clock-in: face verification runs first; geo-modal opens on success.
 * For clock-out: geo-modal opens directly.
 * @param {object} app - The main application object.
 */
export function openAttendanceModal(app) {
    if (app.state.isCompletedToday) {
        showToast('Absensi hari ini sudah selesai. Ajukan Overtime untuk kerja ekstra.', 'info');
        return;
    }
    if (!app.state.isClockedIn) {
        openFaceVerifyModal(app, (selfieBlob) => {
            app.state.selfieBlob = selfieBlob;
            _openGeoModal(app);
        });
    } else {
        // Cek apakah user mencoba clock out sebelum jam selesai kerja
        const endTimeStr = app.state.todayScheduleEndTime; // format "HH:MM"
        if (endTimeStr) {
            const now = new Date();
            const [endH, endM] = endTimeStr.split(':').map(Number);
            const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0);

            if (now < endTime) {
                // Terlalu cepat — tampilkan modal permission request
                const today = now.toISOString().split('T')[0];
                const currentTime = now.toTimeString().substring(0, 5);

                const typeEl   = document.getElementById('permission-type');
                const dateEl   = document.getElementById('permission-date');
                const timeEl   = document.getElementById('permission-time');
                const reasonEl = document.getElementById('permission-reason');
                const notice   = document.getElementById('permission-early-notice');

                if (typeEl)   { typeEl.value = 'cepat'; }
                if (dateEl)   { dateEl.value = today; }
                if (timeEl)   { timeEl.value = currentTime; }
                if (reasonEl) { reasonEl.value = ''; }
                if (notice)   { notice.classList.remove('hidden'); }

                import('./ui.js').then(({ toggleModal }) => toggleModal('permission-modal', true));
                return;
            }
        }
        _openGeoModal(app);
    }
}

/**
 * Handles the clock-in or clock-out confirmation.
 * @param {object} app - The main application object.
 */
export async function handleAttendanceConfirmation(app) {
    const isCheckingIn = !app.state.isClockedIn;
    const endpoint = isCheckingIn ? '/attendance/checkin' : '/attendance/checkout';
    const method = 'POST';

    // Show loading state
    app.dom.confirmAttendance.disabled = true;
    const originalButtonContent = app.dom.confirmAttendance.innerHTML;
    app.dom.confirmAttendance.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i><span>Saving...</span>';
    lucide.createIcons();

    const payload = {};
    if (isCheckingIn) {
        if (!app.state.currentCoords.lat || !app.state.currentCoords.lng) {
            showInModalError('Lokasi belum terdeteksi. Aktifkan GPS dan coba lagi.');
            app.dom.confirmAttendance.disabled = false;
            app.dom.confirmAttendance.innerHTML = originalButtonContent;
            lucide.createIcons();
            return;
        }
        payload.latitude  = app.state.currentCoords.lat;
        payload.longitude = app.state.currentCoords.lng;
    }

    try {
        let result;
        if (isCheckingIn && app.state.selfieBlob) {
            // Send as multipart so the selfie file can travel with location coords
            const fd = new FormData();
            fd.append('latitude',  String(payload.latitude));
            fd.append('longitude', String(payload.longitude));
            fd.append('selfie', app.state.selfieBlob, 'selfie.jpg');
            app.state.selfieBlob = null;
            result = await fetchData(endpoint, { method, body: fd });
        } else {
            result = await fetchData(endpoint, {
                method,
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (result) {
            toggleModal('geo-modal', false);
            showToast(app.state.isClockedIn ? '✅ Clock Out berhasil!' : '✅ Clock In berhasil!', 'success');
        }
    } catch (error) {
        const msg = error.message || '';
        if (msg.includes('too far') || msg.includes('meters away')) {
            showInModalError(`🚫 ${msg}`);
        } else if (msg.includes('ALREADY_COMPLETED_TODAY') || msg.includes('sudah selesai')) {
            toggleModal('geo-modal', false);
            showToast('Absensi hari ini sudah selesai. Ajukan Overtime untuk kerja ekstra.', 'info');
        } else if (msg.includes('already checked in') || msg.includes('sudah Clock In')) {
            toggleModal('geo-modal', false);
            showToast('Anda sudah Clock In hari ini.', 'info');
        } else if (msg.includes('No open check-in')) {
            toggleModal('geo-modal', false);
            showToast('Tidak ada Clock In yang aktif.', 'info');
        } else if (msg.includes('Location data is required')) {
            showInModalError('Data lokasi tidak terkirim. Aktifkan GPS dan coba lagi.');
        } else {
            showInModalError(`Terjadi kesalahan: ${msg}`);
        }
    } finally {
        // Restore button state
        app.dom.confirmAttendance.disabled = false;
        app.dom.confirmAttendance.innerHTML = originalButtonContent;
        lucide.createIcons();

        // Update UI state by reloading the status
        await loadAttendanceStatus(app);
        renderHistory(app);
    }
}

/**
 * Fetches the latest attendance status and updates the UI accordingly.
 * @param {object} app - The main application object.
 */
export async function loadAttendanceStatus(app) {
    try {
        // Use handleError to ensure that API or network errors are caught.
        const history = await fetchData('/attendance/history', { handleError: true, cache: 'no-cache' });
        
        if (history) {
            app.state.historyData = history;
        }

        // Re-enable the button in case it was disabled by a previous error.
        app.dom.btnAttendance.disabled = false;
        app.dom.btnAttendance.classList.remove('text-gray-500', 'border-gray-200', 'bg-gray-100', 'cursor-not-allowed');

        const overtimePrompt = document.getElementById('overtime-prompt');
        const setOvertimePrompt = (visible) => {
            if (overtimePrompt) overtimePrompt.classList.toggle('hidden', !visible);
        };

        const setButtonState = (state) => {
            // state: 'clockin' | 'clockout' | 'done'
            const icon = app.dom.btnAttendance.querySelector('i');
            app.dom.btnAttendance.disabled = (state === 'done');
            app.dom.btnAttendance.classList.remove(
                'text-blue-600', 'border-blue-100', 'bg-blue-50', 'shadow-blue-100',
                'text-red-600',  'border-red-100',  'bg-red-50',  'shadow-red-100',
                'text-green-600','border-green-100','bg-green-50','shadow-green-100',
                'opacity-60', 'cursor-not-allowed'
            );
            if (state === 'clockin') {
                app.dom.btnText.textContent = 'Clock In';
                if (icon) icon.setAttribute('data-lucide', 'fingerprint');
                app.dom.btnAttendance.classList.add('text-blue-600', 'border-blue-100', 'bg-blue-50', 'shadow-blue-100');
            } else if (state === 'clockout') {
                app.dom.btnText.textContent = 'Clock Out';
                if (icon) icon.setAttribute('data-lucide', 'fingerprint');
                app.dom.btnAttendance.classList.add('text-red-600', 'border-red-100', 'bg-red-50', 'shadow-red-100');
            } else {
                app.dom.btnText.textContent = 'Selesai';
                if (icon) icon.setAttribute('data-lucide', 'check-circle');
                app.dom.btnAttendance.classList.add('text-green-600', 'border-green-100', 'bg-green-50', 'shadow-green-100', 'opacity-60', 'cursor-not-allowed');
            }
            lucide.createIcons();
        };

        if (history && history.length > 0) {
            const lastRecord = history[0];
            const today = new Date().toDateString();
            const lastRecordDate = lastRecord.check_in_time ? new Date(lastRecord.check_in_time).toDateString() : null;
            const isToday = lastRecordDate === today;

            if (lastRecord.check_in_time && !lastRecord.check_out_time) {
                // Sedang Clock In (belum Clock Out)
                app.state.isClockedIn = true;
                app.state.isCompletedToday = false;
                app.dom.statusIn.textContent = isToday
                    ? new Date(lastRecord.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                app.dom.statusOut.textContent = '--:--';
                setButtonState('clockout');
                setOvertimePrompt(false);

            } else if (lastRecord.check_in_time && lastRecord.check_out_time && isToday) {
                // Sudah selesai Clock In + Clock Out hari ini
                app.state.isClockedIn = false;
                app.state.isCompletedToday = true;
                app.dom.statusIn.textContent  = new Date(lastRecord.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                app.dom.statusOut.textContent = new Date(lastRecord.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                setButtonState('done');
                setOvertimePrompt(true);

            } else {
                // Belum Clock In hari ini
                app.state.isClockedIn = false;
                app.state.isCompletedToday = false;
                app.dom.statusIn.textContent  = '--:--';
                app.dom.statusOut.textContent = '--:--';
                setButtonState('clockin');
                setOvertimePrompt(false);
            }
        } else {
            app.state.isClockedIn = false;
            app.state.isCompletedToday = false;
            app.dom.btnText.textContent = 'Clock In';
            app.dom.statusIn.textContent  = '--:--';
            app.dom.statusOut.textContent = '--:--';
            setButtonState('clockin');
            setOvertimePrompt(false);
        }
    } catch (error) {
        console.error("Failed to load attendance status:", error);
        // On error, we can't know the state. Disable the button and show an error state.
        app.state.isClockedIn = false; // A safe default
        app.dom.btnText.textContent = 'Status Error';
        app.dom.statusIn.textContent = 'N/A';
        app.dom.statusOut.textContent = 'N/A';
        app.dom.btnAttendance.disabled = true;
        // Remove color classes and add disabled classes
        app.dom.btnAttendance.classList.remove('text-red-600', 'border-red-100', 'bg-red-50', 'shadow-red-100', 'text-blue-600', 'border-blue-100', 'bg-blue-50', 'shadow-blue-100');
        app.dom.btnAttendance.classList.add('text-gray-500', 'border-gray-200', 'bg-gray-100', 'cursor-not-allowed');
    }
}