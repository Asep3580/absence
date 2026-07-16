import { fetchData, API_URL } from './api.js';

let editingCorporateId = null;

function showError(msg) {
    const el = document.getElementById('corporate-form-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

function openModal(mode = 'create', corporate = null) {
    editingCorporateId = mode === 'edit' ? corporate?.id : null;
    const modal = document.getElementById('corporate-modal');
    const title = document.getElementById('corporate-modal-title');
    const adminFields = document.getElementById('corporate-admin-fields');
    const assignSection = document.getElementById('corporate-assign-section');
    const form = document.getElementById('corporate-form');

    form.reset();
    showError('');
    document.getElementById('corporate-id-field').value = editingCorporateId || '';

    if (mode === 'create') {
        title.textContent = 'Add Corporate';
        adminFields.style.display = 'block';
        assignSection.style.display = 'none';
        // Admin fields required for create
        document.getElementById('corporate-admin-email').required = true;
        document.getElementById('corporate-admin-password').required = true;
        document.getElementById('corporate-admin-username').required = true;
    } else {
        title.textContent = 'Edit Corporate';
        adminFields.style.display = 'none';
        assignSection.style.display = 'block';
        document.getElementById('corporate-name').value = corporate.name || '';
        document.getElementById('corporate-address').value = corporate.address || '';
        loadAssignSection(corporate.id);
    }

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('corporate-modal').style.display = 'none';
    editingCorporateId = null;
}

async function loadAssignSection(corporateId) {
    // Load unassigned companies
    const unassigned = await fetchData('/saas/companies/unassigned');
    const select = document.getElementById('corporate-assign-company');
    select.innerHTML = '<option value="">-- Pilih Hotel --</option>';
    if (unassigned) {
        unassigned.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }

    // Load currently assigned companies
    const detail = await fetchData(`/saas/corporates/${corporateId}`);
    renderAssignedList(detail?.companies || []);
}

function renderAssignedList(companies) {
    const list = document.getElementById('assigned-hotels-list');
    if (!list) return;
    if (companies.length === 0) {
        list.innerHTML = '<li style="color:#94a3b8;font-size:0.85rem;">Belum ada hotel yang ditetapkan.</li>';
        return;
    }
    list.innerHTML = companies.map(c => `
        <li style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0;border-bottom:1px solid #f1f5f9;font-size:0.85rem;">
            <span>${c.name} <span style="color:#94a3b8;">(${c.employeeCount} karyawan)</span></span>
            <button data-company-id="${c.id}" class="btn-unassign-hotel" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.8rem;">Lepas</button>
        </li>
    `).join('');

    list.querySelectorAll('.btn-unassign-hotel').forEach(btn => {
        btn.addEventListener('click', async () => {
            const companyId = btn.dataset.companyId;
            await fetchData(`/saas/companies/${companyId}/assign-corporate`, {
                method: 'PUT',
                body: JSON.stringify({ corporateId: null }),
                headers: { 'Content-Type': 'application/json' }
            });
            loadAssignSection(editingCorporateId);
        });
    });
}

export async function loadCorporates() {
    const tbody = document.getElementById('corporates-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#94a3b8;">Loading...</td></tr>';

    const data = await fetchData('/saas/corporates');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#94a3b8;">Belum ada corporate.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(corp => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:0.85rem 1rem;">
                <p style="font-weight:600;margin:0;">${corp.name}</p>
                <p style="font-size:0.78rem;color:#94a3b8;margin:0;">${corp.address || '-'}</p>
            </td>
            <td style="padding:0.85rem 1rem;font-size:0.85rem;">
                <p style="margin:0;font-weight:500;">${corp.adminUsername || '-'}</p>
                <p style="margin:0;color:#94a3b8;">${corp.adminEmail || '-'}</p>
            </td>
            <td style="padding:0.85rem 1rem;text-align:center;font-weight:700;">${corp.companyCount}</td>
            <td style="padding:0.85rem 1rem;text-align:center;font-weight:700;">${corp.employeeCount}</td>
            <td style="padding:0.85rem 1rem;text-align:center;">
                <button data-corp-id="${corp.id}" data-corp-name="${corp.name}" data-corp-address="${corp.address || ''}"
                    class="btn-edit-corporate" style="background:#eff6ff;border:none;color:#3b82f6;border-radius:0.4rem;padding:0.35rem 0.75rem;cursor:pointer;margin-right:0.25rem;font-size:0.82rem;">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button data-corp-id="${corp.id}" data-corp-name="${corp.name}"
                    class="btn-delete-corporate" style="background:#fef2f2;border:none;color:#ef4444;border-radius:0.4rem;padding:0.35rem 0.75rem;cursor:pointer;font-size:0.82rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-corporate').forEach(btn => {
        btn.addEventListener('click', () => openModal('edit', {
            id: btn.dataset.corpId,
            name: btn.dataset.corpName,
            address: btn.dataset.corpAddress
        }));
    });

    tbody.querySelectorAll('.btn-delete-corporate').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(`Hapus corporate "${btn.dataset.corpName}"? Hotel yang terhubung tidak akan dihapus.`)) return;
            await fetchData(`/saas/corporates/${btn.dataset.corpId}`, { method: 'DELETE' });
            loadCorporates();
        });
    });
}

export function initCorporateModule() {
    document.getElementById('add-corporate-btn')?.addEventListener('click', () => openModal('create'));
    document.getElementById('close-corporate-modal-btn')?.addEventListener('click', closeModal);
    document.getElementById('corporate-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('corporate-modal')) closeModal();
    });

    document.getElementById('btn-assign-hotel')?.addEventListener('click', async () => {
        const select = document.getElementById('corporate-assign-company');
        const companyId = select.value;
        if (!companyId || !editingCorporateId) return;
        await fetchData(`/saas/companies/${companyId}/assign-corporate`, {
            method: 'PUT',
            body: JSON.stringify({ corporateId: editingCorporateId }),
            headers: { 'Content-Type': 'application/json' }
        });
        loadAssignSection(editingCorporateId);
    });

    document.getElementById('corporate-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('corporate-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyimpan...';
        showError('');

        const name    = document.getElementById('corporate-name').value.trim();
        const address = document.getElementById('corporate-address').value.trim();

        try {
            if (!editingCorporateId) {
                // CREATE
                const payload = {
                    name,
                    address,
                    adminUsername: document.getElementById('corporate-admin-username').value.trim(),
                    adminEmail:    document.getElementById('corporate-admin-email').value.trim(),
                    adminPassword: document.getElementById('corporate-admin-password').value,
                };
                const result = await fetchData('/saas/corporates', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (result) { closeModal(); loadCorporates(); }
            } else {
                // UPDATE
                const result = await fetchData(`/saas/corporates/${editingCorporateId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, address }),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (result) { closeModal(); loadCorporates(); }
            }
        } catch (err) {
            showError(err.message || 'Terjadi kesalahan.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Simpan';
        }
    });
}
