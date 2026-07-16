import { fetchData, logout, getUser, getToken, API_URL } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    const token = getToken();

    if (!user || !token || user.role !== 'corporate_admin') {
        alert('Akses ditolak. Halaman ini hanya untuk Corporate Admin.');
        logout();
        return;
    }

    document.getElementById('corp-admin-name').textContent  = user.username || '-';
    document.getElementById('corp-admin-email').textContent = user.email || '-';
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Yakin ingin logout?')) logout();
    });

    // ── Helpers ──────────────────────────────────────────────
    const apiBase = API_URL.replace(/\/api$/, '');

    const fmtTime = (ts) => ts
        ? new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : '--:--';

    const fmtDate = (d) => d
        ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        : '-';

    const calcLateness = (checkInTime, scheduledStartTime) => {
        if (!checkInTime || !scheduledStartTime) return '-';
        const ci = new Date(new Date(checkInTime).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const ciMins = ci.getHours() * 60 + ci.getMinutes();
        const [sh, sm] = scheduledStartTime.split(':').map(Number);
        const diff = ciMins - (sh * 60 + sm);
        if (diff <= 0) return '-';
        const h = Math.floor(diff / 60), m = diff % 60;
        return h > 0 ? `${h}j ${m}m` : `${m}m`;
    };

    const avatar = (emp) => emp.avatarUrl
        ? `<img src="${apiBase}${emp.avatarUrl}" class="w-7 h-7 rounded-full object-cover mr-2 flex-shrink-0">`
        : `<div class="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0 text-xs font-bold text-blue-600">${(emp.fullName||'?')[0]}</div>`;

    // Populate hotel dropdowns from a list of companies
    function populateHotelSelects(hotels) {
        const ids = ['filter-hotel','att-filter-hotel','report-filter-hotel','req-filter-hotel'];
        ids.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const current = sel.value;
            sel.innerHTML = '<option value="">All Hotels</option>';
            hotels.forEach(h => sel.innerHTML += `<option value="${h.id}">${h.name}</option>`);
            sel.value = current;
        });
    }

    // ── Navigation ──────────────────────────────────────────
    const views = {
        dashboard:  document.getElementById('view-dashboard'),
        hotels:     document.getElementById('view-hotels'),
        employees:  document.getElementById('view-employees'),
        attendance: document.getElementById('view-attendance'),
        reports:    document.getElementById('view-reports'),
        requests:   document.getElementById('view-requests'),
    };
    const pageTitles = {
        dashboard:  'Dashboard',
        hotels:     'Hotels',
        employees:  'All Employees',
        attendance: 'Attendance Log',
        reports:    'Reports',
        requests:   'Requests',
    };

    const pageTitle = document.getElementById('page-title');

    function showView(name) {
        Object.entries(views).forEach(([k, el]) => {
            if (el) el.classList.toggle('hidden', k !== name);
        });
        pageTitle.textContent = pageTitles[name] || name;

        document.querySelectorAll('.nav-link').forEach(a => {
            const target = a.getAttribute('href').replace('#', '');
            const active = target === name;
            a.classList.toggle('bg-blue-50',      active);
            a.classList.toggle('text-blue-700',   active);
            a.classList.toggle('font-semibold',   active);
            a.classList.toggle('text-slate-600',  !active);
        });

        if (name === 'dashboard')  loadDashboard();
        if (name === 'hotels')     loadHotels();
        if (name === 'employees')  loadEmployees();
        if (name === 'attendance') initAttendanceView();
        if (name === 'reports')    initReportsView();
        if (name === 'requests')   loadRequests();
    }

    document.querySelectorAll('.nav-link').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const target = a.getAttribute('href').replace('#', '');
            history.pushState(null, '', `#${target}`);
            showView(target);
        });
    });

    // ── Overview (sidebar stats) ────────────────────────────
    async function loadOverview() {
        const data = await fetchData('/corporate/overview');
        if (!data) return;
        document.getElementById('sidebar-corp-name').textContent = data.corporateName || '-';
        document.getElementById('stat-hotels').textContent    = data.totalHotels    ?? '-';
        document.getElementById('stat-employees').textContent = data.totalEmployees ?? '-';
        document.getElementById('stat-present').textContent   = data.presentToday   ?? '-';
    }

    // ── Dashboard ────────────────────────────────────────────
    async function loadDashboard() {
        await loadOverview();
        const today  = new Date().toISOString().split('T')[0];
        const [hotels, attData] = await Promise.all([
            fetchData('/corporate/companies'),
            fetchData(`/corporate/attendance?date=${today}`)
        ]);
        if (hotels) populateHotelSelects(hotels);

        // Tally late counts from today's attendance
        let totalLate = 0;
        const lateByHotel = {};
        if (attData) {
            attData.forEach(r => {
                if (r.isLate) {
                    totalLate++;
                    lateByHotel[r.companyId] = (lateByHotel[r.companyId] || 0) + 1;
                }
            });
        }
        document.getElementById('stat-late').textContent = totalLate;

        const tbody = document.getElementById('dashboard-hotels-body');
        if (!hotels || hotels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">Belum ada hotel.</td></tr>';
            return;
        }
        tbody.innerHTML = hotels.map(h => {
            const badge = h.subscriptionStatus === 'active'
                ? '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>'
                : '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Inactive</span>';
            const lateCount = lateByHotel[h.id] || 0;
            const lateCell  = lateCount > 0
                ? `<span class="text-xs font-bold text-orange-600">${lateCount}</span>`
                : '<span class="text-xs text-slate-300">-</span>';
            return `<tr class="border-b border-slate-50 hover:bg-slate-50">
                <td class="px-5 py-3 font-semibold text-slate-800">${h.name}</td>
                <td class="px-5 py-3 text-xs text-slate-500">${h.brand || '-'}</td>
                <td class="px-5 py-3">${badge}</td>
                <td class="px-5 py-3 text-center font-bold">${h.employeeCount}</td>
                <td class="px-5 py-3 text-center font-bold text-green-600">${h.presentToday}</td>
                <td class="px-5 py-3 text-center">${lateCell}</td>
                <td class="px-5 py-3 text-slate-400 text-xs">${h.adminEmail || '-'}</td>
            </tr>`;
        }).join('');
    }

    // ── Hotels ───────────────────────────────────────────────
    async function loadHotels() {
        const hotels = await fetchData('/corporate/companies');
        if (hotels) populateHotelSelects(hotels);
        const tbody = document.getElementById('hotels-body');
        if (!hotels || hotels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Belum ada hotel.</td></tr>';
            return;
        }
        tbody.innerHTML = hotels.map(h => {
            const badge = h.subscriptionStatus === 'active'
                ? '<span class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Active</span>'
                : '<span class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">Inactive</span>';
            const stars = h.starRating ? '★'.repeat(h.starRating) + '☆'.repeat(5 - h.starRating) : '-';
            return `<tr class="border-b border-slate-50 hover:bg-slate-50">
                <td class="px-5 py-3 font-semibold text-slate-800">${h.name}</td>
                <td class="px-5 py-3 text-slate-600 text-sm">${h.brand || '-'}</td>
                <td class="px-5 py-3 text-center text-yellow-500 text-xs tracking-tight">${stars}</td>
                <td class="px-5 py-3 text-slate-500 text-xs max-w-xs truncate">${h.address || '-'}</td>
                <td class="px-5 py-3">${badge}</td>
                <td class="px-5 py-3 text-center font-bold">${h.employeeCount}</td>
                <td class="px-5 py-3 text-center font-bold text-green-600">${h.presentToday}</td>
                <td class="px-5 py-3 text-slate-400 text-xs">${h.adminEmail || '-'}</td>
            </tr>`;
        }).join('');
    }

    // ── Employees ────────────────────────────────────────────
    async function loadEmployees(companyId = '', search = '') {
        const tbody = document.getElementById('employees-body');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Loading...</td></tr>';
        const params = new URLSearchParams();
        if (companyId) params.set('companyId', companyId);
        if (search)    params.set('search', search);
        const data = await fetchData(`/corporate/employees?${params}`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Tidak ada karyawan ditemukan.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(emp => {
            const statusBadge = emp.isActive
                ? '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>'
                : '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Resigned</span>';
            const totalHotels  = 1 + (emp.secondaryCount || 0);
            const hotelsBadge  = emp.secondaryCount > 0
                ? `<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">${totalHotels} hotels</span>`
                : `<span class="text-xs text-slate-400">1 hotel</span>`;
            const secondaryTip = emp.secondaryHotels
                ? emp.secondaryHotels.map(h => h.name).join(', ') : '';
            return `<tr class="border-b border-slate-50 hover:bg-slate-50">
                <td class="px-5 py-3"><div class="flex items-center">${avatar(emp)}<div>
                    <p class="font-semibold text-slate-800">${emp.fullName}</p>
                    <p class="text-xs text-slate-400">${emp.email}</p>
                </div></div></td>
                <td class="px-5 py-3 text-slate-600 text-xs font-medium">${emp.companyName}</td>
                <td class="px-5 py-3 text-slate-500 text-xs">${emp.position || '-'}</td>
                <td class="px-5 py-3 text-center" title="${secondaryTip}">${hotelsBadge}</td>
                <td class="px-5 py-3 text-center">${statusBadge}</td>
                <td class="px-5 py-3 text-center">
                    <button data-user-id="${emp.id}" data-user-name="${emp.fullName}"
                        class="btn-manage-hotels text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        Manage Hotels
                    </button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-manage-hotels').forEach(btn => {
            btn.addEventListener('click', () => openAssignModal(btn.dataset.userId, btn.dataset.userName));
        });
    }

    let empSearchTimer;
    document.getElementById('filter-hotel')?.addEventListener('change', (e) =>
        loadEmployees(e.target.value, document.getElementById('search-employee').value));
    document.getElementById('search-employee')?.addEventListener('input', (e) => {
        clearTimeout(empSearchTimer);
        empSearchTimer = setTimeout(() =>
            loadEmployees(document.getElementById('filter-hotel').value, e.target.value), 400);
    });

    // ── Assignment Modal ──────────────────────────────────────
    let assignModalUserId = null;

    async function openAssignModal(userId, userName) {
        assignModalUserId = userId;
        document.getElementById('assign-modal-emp-name').textContent = userName;
        document.getElementById('assign-error').classList.add('hidden');
        document.getElementById('assign-modal').classList.remove('hidden');
        await refreshAssignList();
    }

    function closeAssignModal() {
        document.getElementById('assign-modal').classList.add('hidden');
        assignModalUserId = null;
    }

    async function refreshAssignList() {
        const list   = document.getElementById('assign-list');
        const select = document.getElementById('assign-hotel-select');
        list.innerHTML = '<li class="text-slate-400 text-sm py-2">Loading...</li>';

        const data = await fetchData(`/corporate/employees/${assignModalUserId}/assignments`);
        if (!data) { list.innerHTML = '<li class="text-red-400 text-sm">Gagal memuat data.</li>'; return; }

        const { assignments, employee } = data;
        const activeCompanyId = employee?.activeCompanyId
            ?? (assignments?.find(a => a.isPrimary)?.companyId ?? null);

        if (!assignments || assignments.length === 0) {
            list.innerHTML = '<li class="text-slate-400 text-sm py-2">Belum ada assignment.</li>';
        } else {
            list.innerHTML = assignments.map(a => {
                const stars    = a.starRating ? '★'.repeat(a.starRating) : '';
                const meta     = [a.brand, stars].filter(Boolean).join(' · ');
                const isActive = String(a.companyId) === String(activeCompanyId);
                return `
                <li class="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div class="flex flex-col gap-0.5">
                        <div class="flex items-center gap-2 flex-wrap">
                            ${a.isPrimary
                                ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">PRIMARY</span>'
                                : '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">SECONDARY</span>'}
                            ${isActive ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">AKTIF</span>' : ''}
                            <span class="text-sm font-medium text-slate-700">${a.companyName}</span>
                        </div>
                        <div class="flex items-center gap-2 pl-0.5">
                            ${meta ? `<span class="text-xs text-slate-400">${meta}</span>` : ''}
                            ${a.startedAt ? `<span class="text-xs text-slate-300">sejak ${fmtDate(a.startedAt)}</span>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${!isActive
                            ? `<button data-company-id="${a.companyId}" class="btn-set-active text-xs text-green-600 hover:text-green-800 font-semibold border border-green-200 rounded px-2 py-0.5">Set Aktif</button>`
                            : '<span class="text-xs text-slate-300">Aktif</span>'}
                        ${!a.isPrimary
                            ? `<button data-company-id="${a.companyId}" class="btn-remove-assign text-xs text-red-500 hover:text-red-700 font-semibold">Hapus</button>`
                            : ''}
                    </div>
                </li>`;
            }).join('');

            list.querySelectorAll('.btn-remove-assign').forEach(btn => {
                btn.addEventListener('click', async () => {
                    btn.disabled = true; btn.textContent = '...';
                    await fetchData(`/corporate/employees/${assignModalUserId}/assignments/${btn.dataset.companyId}`, { method: 'DELETE' });
                    await refreshAssignList();
                    loadEmployees(document.getElementById('filter-hotel').value, document.getElementById('search-employee').value);
                });
            });

            list.querySelectorAll('.btn-set-active').forEach(btn => {
                btn.addEventListener('click', async () => {
                    btn.disabled = true; btn.textContent = '...';
                    await fetchData(`/corporate/employees/${assignModalUserId}/active-company`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyId: btn.dataset.companyId })
                    });
                    await refreshAssignList();
                });
            });
        }

        // Populate hotel dropdown — exclude already assigned
        const assignedIds = new Set((assignments || []).map(a => String(a.companyId)));
        select.innerHTML = '<option value="">-- Pilih hotel --</option>';
        allCorporateHotels.forEach(h => {
            if (!assignedIds.has(String(h.id))) {
                const stars = h.starRating ? ' ' + '★'.repeat(h.starRating) : '';
                const label = h.brand ? `${h.name} (${h.brand}${stars})` : `${h.name}${stars}`;
                select.innerHTML += `<option value="${h.id}">${label}</option>`;
            }
        });
    }

    document.getElementById('close-assign-modal')?.addEventListener('click', closeAssignModal);
    document.getElementById('assign-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('assign-modal')) closeAssignModal();
    });

    document.getElementById('btn-add-assignment')?.addEventListener('click', async () => {
        const companyId = document.getElementById('assign-hotel-select').value;
        const startedAt = document.getElementById('assign-started-at').value;
        const errEl     = document.getElementById('assign-error');
        errEl.classList.add('hidden');
        if (!companyId) { errEl.textContent = 'Pilih hotel terlebih dahulu.'; errEl.classList.remove('hidden'); return; }

        const btn = document.getElementById('btn-add-assignment');
        btn.disabled = true; btn.textContent = 'Menyimpan...';

        const result = await fetchData(`/corporate/employees/${assignModalUserId}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ companyId, startedAt: startedAt || null }),
            headers: { 'Content-Type': 'application/json' }
        });

        btn.disabled = false; btn.textContent = 'Assign Hotel';

        if (result) {
            document.getElementById('assign-started-at').value = '';
            await refreshAssignList();
            loadEmployees(document.getElementById('filter-hotel').value, document.getElementById('search-employee').value);
        } else {
            errEl.textContent = 'Gagal menyimpan assignment.';
            errEl.classList.remove('hidden');
        }
    });

    // ── Attendance Daily ────────────────────────────────────
    function initAttendanceView() {
        const dateInput = document.getElementById('att-date');
        if (!dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    async function loadAttendance() {
        const date      = document.getElementById('att-date').value;
        const companyId = document.getElementById('att-filter-hotel').value;
        const tbody     = document.getElementById('attendance-body');
        const summary   = document.getElementById('att-summary');

        if (!date) return;
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Loading...</td></tr>';

        const params = new URLSearchParams({ date });
        if (companyId) params.set('companyId', companyId);
        const data = await fetchData(`/corporate/attendance?${params}`);

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Tidak ada data absensi.</td></tr>';
            summary.classList.add('hidden');
            return;
        }

        // Summary chips
        const presentCount = data.filter(r => r.status === 'present').length;
        const lateCount    = data.filter(r => r.isLate).length;
        const leaveCount   = data.filter(r => ['on_leave','sick'].includes(r.status)).length;
        summary.innerHTML  = `
            <span class="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700">Hadir: ${presentCount}</span>
            <span class="text-xs font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-700">Terlambat: ${lateCount}</span>
            <span class="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">Cuti/Izin: ${leaveCount}</span>
            <span class="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600">Total: ${data.length}</span>`;
        summary.classList.remove('hidden');

        const statusMap = {
            present:  '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Present</span>',
            absent:   '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Absent</span>',
            on_leave: '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">On Leave</span>',
            sick:     '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Sick</span>',
        };

        tbody.innerHTML = data.map(r => {
            const lateBadge = r.isLate
                ? '<span class="ml-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Late</span>'
                : '';
            return `<tr class="border-b border-slate-50 hover:bg-slate-50">
                <td class="px-5 py-3"><div class="flex items-center">${avatar(r)}
                    <span class="font-semibold text-slate-800">${r.fullName}</span>
                </div></td>
                <td class="px-5 py-3 text-xs text-slate-500 font-medium">${r.companyName}</td>
                <td class="px-5 py-3 text-center">${statusMap[r.status] || r.status}</td>
                <td class="px-5 py-3 text-center font-mono text-sm">${fmtTime(r.checkInTime)}${lateBadge}</td>
                <td class="px-5 py-3 text-center font-mono text-sm">${fmtTime(r.checkOutTime)}</td>
                <td class="px-5 py-3 text-center text-xs ${r.isLate ? 'text-orange-600 font-semibold' : 'text-slate-400'}">${r.isLate ? calcLateness(r.checkInTime, r.scheduledStartTime) : '-'}</td>
            </tr>`;
        }).join('');
    }

    document.getElementById('btn-load-attendance')?.addEventListener('click', loadAttendance);

    // ── Reports ──────────────────────────────────────────────
    let activeReportTab = 'attendance';

    function initReportsView() {
        // Default date range: current month
        const now   = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end   = now;
        const fmt   = d => d.toISOString().split('T')[0];
        const startInput = document.getElementById('report-start-date');
        const endInput   = document.getElementById('report-end-date');
        if (!startInput.value) startInput.value = fmt(start);
        if (!endInput.value)   endInput.value   = fmt(end);
    }

    document.querySelectorAll('.report-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeReportTab = btn.dataset.reportTab;
            document.querySelectorAll('.report-tab-btn').forEach(b => {
                const active = b === btn;
                b.classList.toggle('bg-white',      active);
                b.classList.toggle('text-blue-700', active);
                b.classList.toggle('shadow-sm',     active);
                b.classList.toggle('text-slate-500',!active);
            });
            document.getElementById('report-attendance-section').classList.toggle('hidden', activeReportTab !== 'attendance');
            document.getElementById('report-leave-section').classList.toggle('hidden',      activeReportTab !== 'leave');
        });
    });

    document.getElementById('btn-load-report')?.addEventListener('click', async () => {
        const startDate = document.getElementById('report-start-date').value;
        const endDate   = document.getElementById('report-end-date').value;
        const companyId = document.getElementById('report-filter-hotel').value;
        if (!startDate || !endDate) return;

        if (activeReportTab === 'attendance') {
            await loadAttendanceReport(startDate, endDate, companyId);
        } else {
            await loadLeaveReport(startDate, endDate, companyId);
        }
    });

    async function loadAttendanceReport(startDate, endDate, companyId) {
        const tbody = document.getElementById('report-attendance-body');
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400">Loading...</td></tr>';
        const params = new URLSearchParams({ startDate, endDate });
        if (companyId) params.set('companyId', companyId);
        const data = await fetchData(`/corporate/reports/attendance?${params}`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400">Tidak ada data.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(row => {
            const inactiveBadge = row.isActive === false
                ? '<span class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">Resigned</span>' : '';
            return `<tr class="border-b border-slate-50 hover:bg-slate-50">
                <td class="px-5 py-3 font-semibold text-slate-800">${row.fullName}${inactiveBadge}</td>
                <td class="px-5 py-3 text-xs text-slate-500 font-medium">${row.companyName}</td>
                <td class="px-5 py-3 text-xs text-slate-500">${row.departmentName || '-'}</td>
                <td class="px-5 py-3 text-center">${row.totalWorkdays}</td>
                <td class="px-5 py-3 text-center font-bold text-green-600">${row.present}</td>
                <td class="px-5 py-3 text-center font-bold text-orange-500">${row.late}</td>
                <td class="px-5 py-3 text-center font-bold text-blue-500">${row.onLeave}</td>
                <td class="px-5 py-3 text-center font-bold text-red-500">${row.absent}</td>
            </tr>`;
        }).join('');
    }

    async function loadLeaveReport(startDate, endDate, companyId) {
        const tbody = document.getElementById('report-leave-body');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">Loading...</td></tr>';
        const params = new URLSearchParams({ startDate, endDate });
        if (companyId) params.set('companyId', companyId);
        const data = await fetchData(`/corporate/reports/leave?${params}`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">Tidak ada data.</td></tr>';
            return;
        }
        const statusMap = {
            pending:  'bg-orange-100 text-orange-700',
            approved: 'bg-green-100 text-green-700',
            rejected: 'bg-red-100 text-red-600',
        };
        tbody.innerHTML = data.map(r => `
            <tr class="border-b border-slate-50 hover:bg-slate-50">
                <td class="px-5 py-3"><div class="flex items-center">${avatar(r)}
                    <span class="font-semibold text-slate-800">${r.fullName}</span>
                </div></td>
                <td class="px-5 py-3 text-xs text-slate-500 font-medium">${r.companyName}</td>
                <td class="px-5 py-3 text-xs">${r.leaveTypeName || '-'}</td>
                <td class="px-5 py-3 text-center text-xs">${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}</td>
                <td class="px-5 py-3 text-center font-bold">${r.totalDays}</td>
                <td class="px-5 py-3 text-slate-500 text-xs max-w-xs truncate" title="${r.reason || ''}">${r.reason || '-'}</td>
                <td class="px-5 py-3 text-center">
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${statusMap[r.status] || 'bg-slate-100 text-slate-600'}">${r.status}</span>
                </td>
            </tr>`).join('');
    }

    // ── Requests ─────────────────────────────────────────────
    async function loadRequests() {
        const tbody     = document.getElementById('requests-body');
        const status    = document.getElementById('req-filter-status')?.value || 'pending';
        const companyId = document.getElementById('req-filter-hotel')?.value  || '';

        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">Loading...</td></tr>';

        const params = new URLSearchParams({ status });
        if (companyId) params.set('companyId', companyId);
        const data = await fetchData(`/corporate/requests?${params}`);

        // Update pending badge
        const badge = document.getElementById('pending-badge');
        if (status === 'pending' && data?.length) {
            badge?.classList.remove('hidden');
            if (badge) badge.textContent = data.length;
        } else {
            badge?.classList.add('hidden');
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">Tidak ada request ditemukan.</td></tr>';
            return;
        }

        const typeLabels = {
            leave: 'Leave', overtime: 'Overtime', remote_work: 'Remote Work',
            change_schedule: 'Change Schedule', reimburse: 'Reimburse',
        };
        const statusMap = {
            pending:  'bg-orange-100 text-orange-700',
            approved: 'bg-green-100 text-green-700',
            rejected: 'bg-red-100 text-red-600',
            cancelled:'bg-slate-100 text-slate-500',
        };

        tbody.innerHTML = data.map(r => `
            <tr class="border-b border-slate-50 hover:bg-slate-50">
                <td class="px-5 py-3"><div class="flex items-center">${avatar(r)}
                    <span class="font-semibold text-slate-800">${r.fullName}</span>
                </div></td>
                <td class="px-5 py-3 text-xs text-slate-500 font-medium">${r.companyName}</td>
                <td class="px-5 py-3 text-xs">${typeLabels[r.requestType] || r.requestType}${r.absenceTypeName ? ` — ${r.absenceTypeName}` : ''}</td>
                <td class="px-5 py-3 text-center text-xs">${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}</td>
                <td class="px-5 py-3 text-slate-500 text-xs max-w-xs truncate" title="${r.reason||''}">${r.reason || '-'}</td>
                <td class="px-5 py-3 text-center text-xs text-slate-400">${fmtDate(r.submittedDate)}</td>
                <td class="px-5 py-3 text-center">
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${statusMap[r.status] || 'bg-slate-100 text-slate-600'}">${r.status}</span>
                </td>
            </tr>`).join('');
    }

    document.getElementById('req-filter-status')?.addEventListener('change', loadRequests);
    document.getElementById('req-filter-hotel')?.addEventListener('change',  loadRequests);

    // ── Init ─────────────────────────────────────────────────
    // Pre-load hotel list for all dropdowns + assignment modal
    let allCorporateHotels = [];
    fetchData('/corporate/companies').then(hotels => {
        if (hotels) {
            allCorporateHotels = hotels;
            populateHotelSelects(hotels);
        }
    });

    // Load pending count for badge
    fetchData('/corporate/requests?status=pending').then(data => {
        const badge = document.getElementById('pending-badge');
        if (data?.length && badge) {
            badge.classList.remove('hidden');
            badge.textContent = data.length;
        }
    });

    const hash = window.location.hash.replace('#', '') || 'dashboard';
    showView(hash);
});
