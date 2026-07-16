import { fetchData, API_URL, logout } from './api.js';
import { toggleModal } from './ui.js';

/**
 * Memuat data profil lengkap pengguna dari server dan menyimpannya.
 * @param {object} app - Objek aplikasi utama.
 */
export async function loadUserProfile(app) {
    const [fullProfile, leaveBalance] = await Promise.all([
        fetchData('/users/me'),
        fetchData('/user/leave-balance'),
    ]);
    if (fullProfile) {
        app.state.user = {
            ...app.state.user,
            ...fullProfile,
            remainingLeave: leaveBalance?.remainingDays ?? null,
        };
        localStorage.setItem('user', JSON.stringify(app.state.user));
    } else {
        alert("Could not load user profile. Logging out.");
        logout();
    }
}

/**
 * Mengisi data pengguna ke elemen-elemen UI di halaman profil.
 * @param {object} app - Objek aplikasi utama.
 */
export function personalizeView(app) {
    const {
        fullName, username, positionName, avatarUrl, id, nik, levelName,
        departmentName, companyName, employeeStatusName,
        joinDate, contractStartDate, contractEndDate, remainingLeave,
        supervisorName, managerName,
        dateOfBirth, gender, religion, maritalStatus, email, phoneNumber,
        emergencyContactName, emergencyContactPhone
    } = app.state.user;

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || username)}&background=random&color=fff`;
    const fullAvatarUrl = avatarUrl ? `${API_URL.replace(/\/api$/, '')}${avatarUrl}` : defaultAvatar;

    const updateText = (element, text) => {
        if (element) element.textContent = text || '-';
    };
    const updateImage = (element, url) => {
        if (element) element.src = url;
    };
    // Parse tanggal sebagai lokal (bukan UTC) untuk menghindari pergeseran -1 hari
    // akibat serialisasi pg di timezone server (misal UTC+7 → "2000-05-14T17:00:00.000Z")
    const parseLocalDate = (s) => {
        if (!s) return null;
        const parts = String(s).substring(0, 10).split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return null;
        return new Date(parts[0], parts[1] - 1, parts[2]);
    };
    const formatDate = (dateString) => {
        const d = parseLocalDate(dateString);
        if (!d) return '-';
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    const formatGender = (g) => ({ 'Laki-laki': 'Male', 'Perempuan': 'Female' }[g] || g || '-');

    // Header
    updateText(app.dom.headerUsername, fullName || username);
    updateImage(app.dom.headerAvatar, fullAvatarUrl);

    // Profile View
    updateImage(app.dom.profileAvatar, fullAvatarUrl);
    updateText(app.dom.profileFullName, fullName || username);
    updateText(app.dom.profilePosition, positionName);
    updateText(app.dom.profileEmployeeStatus, employeeStatusName);
    updateText(document.getElementById('profile-company'), companyName);
    updateText(app.dom.profileNik, nik || id);
    updateText(app.dom.profileDepartment, departmentName);
    updateText(document.getElementById('profile-job-position'), positionName);
    updateText(document.getElementById('profile-level'), levelName);
    updateText(document.getElementById('profile-job-status'), employeeStatusName);
    updateText(app.dom.profileJoinDate, formatDate(joinDate));

    // Contract period — gunakan parseLocalDate yang sudah aman dari UTC shift
    const contractEl = document.getElementById('profile-contract');
    if (contractEl) {
        contractEl.textContent = (contractStartDate && contractEndDate)
            ? `${formatDate(contractStartDate)} – ${formatDate(contractEndDate)}`
            : '-';
    }

    // Remaining annual leave
    const leaveEl = document.getElementById('profile-leave-balance');
    if (leaveEl) {
        leaveEl.textContent = remainingLeave != null ? `${remainingLeave} days` : '-';
    }

    updateText(document.getElementById('profile-supervisor'), supervisorName);
    updateText(app.dom.profileManager, managerName);
    updateText(app.dom.profileBirthdate, formatDate(dateOfBirth));
    updateText(app.dom.profileGender, formatGender(gender));
    updateText(app.dom.profileReligion, religion);
    updateText(app.dom.profileMaritalStatus, maritalStatus);
    updateText(app.dom.profileEmail, email);
    updateText(app.dom.profilePhone, phoneNumber);
    updateText(app.dom.profileEmergencyContactName, emergencyContactName);
    updateText(app.dom.profileEmergencyContactPhone, emergencyContactPhone);
}

/**
 * Membuka modal edit profil dan mengisi form dengan data yang sudah ada.
 */
// Tracks pending face photo blob from camera capture in edit profile
let _pendingFacePhotoBlob = null;
let _fpcStream = null;

function _closeFacePhotoCaptureModal() {
    if (_fpcStream) { _fpcStream.getTracks().forEach(t => t.stop()); _fpcStream = null; }
    const modal = document.getElementById('face-photo-capture-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

async function _openFacePhotoCaptureModal(app) {
    const modal    = document.getElementById('face-photo-capture-modal');
    const loading  = document.getElementById('fpc-loading');
    const camBox   = document.getElementById('fpc-camera-container');
    const video    = document.getElementById('fpc-video');
    const canvas   = document.getElementById('fpc-canvas');
    const captBtn  = document.getElementById('btn-fpc-capture');
    const statusEl = document.getElementById('fpc-status');

    // Reset state
    loading.classList.remove('hidden');
    camBox.classList.add('hidden');
    captBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Membuka kamera...';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();

    try {
        _fpcStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } }
        });
        video.srcObject = _fpcStream;
        await new Promise(resolve => { video.onloadedmetadata = resolve; });
        await video.play();
    } catch {
        if (statusEl) statusEl.textContent = 'Akses kamera ditolak. Izinkan kamera dan coba lagi.';
        loading.classList.add('hidden');
        return;
    }

    loading.classList.add('hidden');
    camBox.classList.remove('hidden');
    captBtn.disabled = false;
    if (statusEl) statusEl.textContent = 'Posisikan wajah lurus ke kamera';

    captBtn.onclick = async () => {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));

        _closeFacePhotoCaptureModal();

        // Update preview in edit profile modal
        _pendingFacePhotoBlob = blob;
        const preview  = document.getElementById('edit-face-photo-preview');
        const ph       = document.getElementById('edit-face-photo-placeholder');
        const statusOk = document.getElementById('edit-face-photo-status');
        if (preview) { preview.src = URL.createObjectURL(blob); preview.classList.remove('hidden'); }
        if (ph) ph.classList.add('hidden');
        if (statusOk) statusOk.classList.remove('hidden');
    };

    document.getElementById('btn-close-face-photo-capture').onclick = () => _closeFacePhotoCaptureModal();
}

export function openEditProfileModal(app) {
    const { phoneNumber, emergencyContactName, emergencyContactPhone, avatarUrl, facePhotoUrl, fullName, username } = app.state.user;

    // Reset pending blob each time modal opens
    _pendingFacePhotoBlob = null;

    const preview = document.getElementById('edit-avatar-preview');
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || username)}&background=random&color=fff`;
    if (preview) preview.src = avatarUrl ? `${API_URL.replace(/\/api$/, '')}${avatarUrl}` : defaultAvatar;

    // Face photo preview
    const facePreview = document.getElementById('edit-face-photo-preview');
    const facePh      = document.getElementById('edit-face-photo-placeholder');
    const faceStatus  = document.getElementById('edit-face-photo-status');
    if (facePhotoUrl && facePreview) {
        facePreview.src = `${API_URL.replace(/\/api$/, '')}${facePhotoUrl}`;
        facePreview.classList.remove('hidden');
        if (facePh) facePh.classList.add('hidden');
    } else {
        if (facePreview) { facePreview.src = ''; facePreview.classList.add('hidden'); }
        if (facePh) facePh.classList.remove('hidden');
    }
    if (faceStatus) faceStatus.classList.add('hidden');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('edit-phone', phoneNumber);
    setVal('edit-emergency-name', emergencyContactName);
    setVal('edit-emergency-phone', emergencyContactPhone);

    // Clear password fields every time modal opens
    ['edit-current-password', 'edit-new-password', 'edit-confirm-password'].forEach(id => setVal(id, ''));

    const filenameLabel = document.getElementById('edit-avatar-filename');
    if (filenameLabel) filenameLabel.classList.add('hidden');

    // Reset avatar file input
    const fileInput = document.getElementById('edit-avatar-input');
    if (fileInput) fileInput.value = '';

    // Wire avatar preview on file select (only once via flag)
    if (fileInput && !fileInput.dataset.listenerAttached) {
        fileInput.dataset.listenerAttached = 'true';
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) return;
            if (filenameLabel) { filenameLabel.textContent = file.name; filenameLabel.classList.remove('hidden'); }
            const reader = new FileReader();
            reader.onload = (e) => { if (preview) preview.src = e.target.result; };
            reader.readAsDataURL(file);
        });
    }

    // Wire face photo file input (only once)
    const faceFileInput = document.getElementById('edit-face-photo-input');
    if (faceFileInput && !faceFileInput.dataset.listenerAttached) {
        faceFileInput.dataset.listenerAttached = 'true';
        faceFileInput.addEventListener('change', () => {
            const file = faceFileInput.files[0];
            if (!file) return;
            _pendingFacePhotoBlob = null; // file input takes precedence over blob
            const reader = new FileReader();
            reader.onload = (e) => {
                if (facePreview) { facePreview.src = e.target.result; facePreview.classList.remove('hidden'); }
                if (facePh) facePh.classList.add('hidden');
                if (faceStatus) faceStatus.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        });
    }

    // Wire "Ambil Selfie" camera button
    const captureFaceBtn = document.getElementById('btn-capture-face-photo');
    if (captureFaceBtn) captureFaceBtn.onclick = () => _openFacePhotoCaptureModal(app);

    // Wire show/hide password toggles (once per modal open — safe since setVal clears values)
    document.querySelectorAll('.toggle-pw-btn').forEach(btn => {
        btn.onclick = () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            const icon = btn.querySelector('i');
            if (icon) icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
            lucide.createIcons();
        };
    });

    toggleModal('edit-profile-modal', true);
}

/**
 * Menyimpan perubahan profil ke server dan update state lokal.
 */
export async function saveProfileChanges(app) {
    const btn = document.getElementById('btn-save-profile');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i><span>Saving...</span>';
    lucide.createIcons();

    try {
        // Validate password change if requested
        const currentPassword = document.getElementById('edit-current-password')?.value || '';
        const newPassword     = document.getElementById('edit-new-password')?.value || '';
        const confirmPassword = document.getElementById('edit-confirm-password')?.value || '';

        if (currentPassword) {
            if (newPassword.length < 6) {
                btn.disabled = false; btn.innerHTML = originalHtml; lucide.createIcons();
                alert('New password must be at least 6 characters.');
                return;
            }
            if (newPassword !== confirmPassword) {
                btn.disabled = false; btn.innerHTML = originalHtml; lucide.createIcons();
                alert('New passwords do not match.');
                return;
            }
        }

        const formData = new FormData();
        formData.append('phoneNumber',           document.getElementById('edit-phone')?.value.trim() || '');
        formData.append('emergencyContactName',  document.getElementById('edit-emergency-name')?.value.trim() || '');
        formData.append('emergencyContactPhone', document.getElementById('edit-emergency-phone')?.value.trim() || '');

        if (currentPassword) {
            formData.append('currentPassword', currentPassword);
            formData.append('newPassword', newPassword);
        }

        const fileInput = document.getElementById('edit-avatar-input');
        if (fileInput?.files[0]) formData.append('avatar', fileInput.files[0]);

        // Face photo: prefer camera-captured blob, then file input
        const faceFileInput = document.getElementById('edit-face-photo-input');
        if (_pendingFacePhotoBlob) {
            formData.append('face_photo', _pendingFacePhotoBlob, 'face_photo.jpg');
        } else if (faceFileInput?.files[0]) {
            formData.append('face_photo', faceFileInput.files[0]);
        }

        const updated = await fetchData('/users/me/profile', { method: 'PUT', body: formData });

        if (updated) {
            // Merge updated fields into app state
            app.state.user = { ...app.state.user, ...updated };
            localStorage.setItem('user', JSON.stringify(app.state.user));

            // Update all avatar & contact UI elements
            const { avatarUrl, fullName, username } = app.state.user;
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || username)}&background=random&color=fff`;
            const fullAvatarUrl = avatarUrl ? `${API_URL.replace(/\/api$/, '')}${avatarUrl}` : defaultAvatar;

            ['header-avatar', 'profile-avatar'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.src = fullAvatarUrl;
            });
            const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
            setTxt('profile-phone', updated.phoneNumber);
            setTxt('profile-emergencyContactName', updated.emergencyContactName);
            setTxt('profile-emergencyContactPhone', updated.emergencyContactPhone);

            // Clear password fields after success
            ['edit-current-password', 'edit-new-password', 'edit-confirm-password'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            _pendingFacePhotoBlob = null;

            toggleModal('edit-profile-modal', false);

            // Toast
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl bg-green-600 transition-opacity duration-300';
            toast.textContent = '✅ Profile updated!';
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 350); }, 2500);
        }
    } catch (err) {
        alert(`Gagal menyimpan profil: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        lucide.createIcons();
    }
}

export async function initKPIChart(app) {
    const kpiSummary = document.getElementById('kpi-summary');
    if (!kpiSummary) return;

    // Use historyData already loaded at app start; fetch if empty
    let records = app.state.historyData;
    if (!records || records.length === 0) {
        records = await fetchData('/attendance/history') || [];
        app.state.historyData = records;
    }

    // Filter current month using browser local timezone
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear  = now.getFullYear();

    // Deduplicate: one record per calendar day (local timezone), earliest check-in first
    const seenDays = new Set();
    const daily = [];
    for (const rec of records) {
        const ref = rec.check_in_time ? new Date(rec.check_in_time) : new Date(rec.created_at);
        if (ref.getFullYear() !== thisYear || ref.getMonth() !== thisMonth) continue;
        const dayKey = ref.toLocaleDateString('en-CA'); // "YYYY-MM-DD" local
        if (!seenDays.has(dayKey)) { seenDays.add(dayKey); daily.push(rec); }
    }

    // Calculate using EXACT same logic as history.js
    let onTime = 0, late = 0, absent = 0;
    for (const rec of daily) {
        if (rec.status === 'absent') {
            absent++;
        } else if (rec.status === 'present' && rec.check_in_time) {
            if (rec.scheduledStartTime) {
                const checkIn   = new Date(rec.check_in_time);
                const parts     = rec.scheduledStartTime.split(':');
                const schedTime = new Date(checkIn.getTime());
                schedTime.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
                checkIn > schedTime ? late++ : onTime++;
            } else {
                onTime++;
            }
        }
    }

    const total   = onTime + late + absent;
    if (total === 0) {
        kpiSummary.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Belum ada data absensi bulan ini.</p>`;
        return;
    }

    const onTimePct = Math.round((onTime / total) * 100);
    const latePct   = Math.round((late   / total) * 100);
    const absentPct = Math.round((absent / total) * 100);
    const attendPct = onTimePct + latePct;

    const bar = (pct, color) => pct > 0
        ? `<div class="h-full rounded-full ${color}" style="width:${pct}%"></div>` : '';

    kpiSummary.innerHTML = `
        <div class="grid grid-cols-3 gap-2 mb-4">
            <div class="flex flex-col items-center bg-green-50 rounded-2xl p-3">
                <span class="text-xl font-extrabold text-green-600">${onTime}</span>
                <span class="text-[10px] font-bold text-green-500 uppercase tracking-wide mt-0.5">On Time</span>
                <span class="text-[10px] text-gray-400 mt-0.5">${onTimePct}%</span>
            </div>
            <div class="flex flex-col items-center bg-orange-50 rounded-2xl p-3">
                <span class="text-xl font-extrabold text-orange-500">${late}</span>
                <span class="text-[10px] font-bold text-orange-400 uppercase tracking-wide mt-0.5">Late</span>
                <span class="text-[10px] text-gray-400 mt-0.5">${latePct}%</span>
            </div>
            <div class="flex flex-col items-center bg-red-50 rounded-2xl p-3">
                <span class="text-xl font-extrabold text-red-500">${absent}</span>
                <span class="text-[10px] font-bold text-red-400 uppercase tracking-wide mt-0.5">Absent</span>
                <span class="text-[10px] text-gray-400 mt-0.5">${absentPct}%</span>
            </div>
        </div>
        <div class="flex items-center justify-between mb-1.5">
            <span class="text-[10px] text-gray-400 font-medium">Attendance Rate</span>
            <span class="text-[10px] font-bold text-gray-700">${attendPct}% (${onTime + late}/${total} days)</span>
        </div>
        <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
            ${bar(onTimePct, 'bg-green-500')}
            ${bar(latePct,   'bg-orange-400')}
            ${bar(absentPct, 'bg-red-400')}
        </div>
        <div class="flex items-center space-x-3 mt-2 justify-center">
            <div class="flex items-center space-x-1"><div class="w-2 h-2 rounded-full bg-green-500"></div><span class="text-[10px] text-gray-500">On Time</span></div>
            <div class="flex items-center space-x-1"><div class="w-2 h-2 rounded-full bg-orange-400"></div><span class="text-[10px] text-gray-500">Late</span></div>
            <div class="flex items-center space-x-1"><div class="w-2 h-2 rounded-full bg-red-400"></div><span class="text-[10px] text-gray-500">Absent</span></div>
        </div>
    `;
}