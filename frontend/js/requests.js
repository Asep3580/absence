'use strict';

import { fetchData } from './api.js';
import { toggleModal } from './ui.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
    if (!dateStr) return '-';
    // Extract YYYY-MM-DD from either a plain date string or an ISO datetime
    const datePart = String(dateStr).slice(0, 10);
    const d = new Date(datePart + 'T00:00:00');
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(isoStr) {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

const STATUS_STYLE = {
    pending:  { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Pending'  },
    approved: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Approved' },
    rejected: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Rejected' },
    cancelled:{ bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Cancelled'},
};

function statusBadge(status) {
    const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}">${s.label}</span>`;
}

// ─── Render: My Submissions ────────────────────────────────────────────────────

function renderMySubmissions(requests, container) {
    if (!requests || requests.length === 0) {
        container.innerHTML = `<div class="text-center py-8"><p class="text-gray-400 text-xs">No submissions yet.</p></div>`;
        return;
    }

    container.innerHTML = requests.map(r => {
        const isCS = r.requestType === 'change_schedule';
        let detail = '';

        if (isCS) {
            const l1 = r.level1Status;
            const l1Done = l1 === 'approved' || l1 === 'skipped';
            const l1Label = l1 === 'skipped' ? 'No Supervisor' : (l1 === 'approved' ? 'Approved' : (l1 === 'rejected' ? 'Rejected' : 'Waiting'));
            const l1Color = l1 === 'approved' ? 'text-green-600' : l1 === 'rejected' ? 'text-red-500' : l1 === 'skipped' ? 'text-gray-400' : 'text-amber-500';
            const l2Label = r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : (l1Done ? 'Waiting Manager' : '-');
            const l2Color = r.status === 'approved' ? 'text-green-600' : r.status === 'rejected' ? 'text-red-500' : 'text-amber-500';

            detail = `
                <div class="mt-2 bg-gray-50 rounded-xl p-3 text-[11px]">
                    <p class="font-bold text-gray-500 mb-1.5">Target: <span class="text-gray-800">${r.targetScheduleName || '-'} ${r.targetScheduleStart ? `(${r.targetScheduleStart}-${r.targetScheduleEnd})` : ''} &mdash; ${fmtDate(r.targetDate)}</span></p>
                    <div class="flex items-center space-x-2 text-[10px]">
                        <span class="font-bold text-indigo-400">You ✓</span>
                        <span class="text-gray-300">→</span>
                        <span class="font-bold ${l1Color}">Supervisor: ${l1Label}</span>
                        <span class="text-gray-300">→</span>
                        <span class="font-bold ${l2Color}">Manager: ${l2Label}</span>
                    </div>
                    ${r.level1Notes ? `<p class="mt-1 text-gray-400">Supervisor note: ${r.level1Notes}</p>` : ''}
                    ${r.processorNotes ? `<p class="mt-1 text-gray-400">Manager note: ${r.processorNotes}</p>` : ''}
                </div>`;
        } else {
            const type = r.requestTypeName || r.requestType || '-';
            const dateRange = r.startDate === r.endDate ? fmtDate(r.startDate) : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`;
            detail = `
                <div class="mt-1">
                    <p class="text-xs text-gray-500">${type} &mdash; ${dateRange}</p>
                    ${r.processorNotes ? `<p class="text-[11px] text-gray-400 mt-0.5">Note: ${r.processorNotes}</p>` : ''}
                </div>`;
        }

        const typeLabel = isCS ? 'Change Schedule' : (r.requestTypeName || r.requestType || '-');
        const typeColor = isCS ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700';

        return `
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2 mb-1">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${typeColor}">${typeLabel}</span>
                        ${statusBadge(r.status)}
                    </div>
                    ${detail}
                </div>
            </div>
            <p class="text-[10px] text-gray-300 mt-2">${fmtDateTime(r.submittedDate)}</p>
        </div>`;
    }).join('');
}

// ─── Render: Pending Approvals (Supervisor view) ──────────────────────────────

function renderPendingApprovals(approvals, container, section, app) {
    if (!approvals || approvals.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    // Update notification badge on home screen
    const badge = document.getElementById('notification-badge');
    if (badge) badge.classList.remove('hidden');

    container.innerHTML = approvals.map(r => `
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
            <div class="flex items-start justify-between mb-2">
                <div>
                    <p class="text-sm font-bold text-gray-800">${r.requesterName}</p>
                    <p class="text-[11px] text-gray-500">Requests shift change on <strong>${fmtDate(r.targetDate)}</strong></p>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Needs Approval</span>
            </div>
            <div class="bg-white rounded-xl p-3 mb-3 text-[11px] text-gray-600 space-y-1">
                <p><span class="font-bold">Target shift:</span> ${r.targetScheduleName || '-'} ${r.targetScheduleStart ? `(${r.targetScheduleStart}–${r.targetScheduleEnd})` : ''}</p>
                ${r.reason ? `<p><span class="font-bold">Reason:</span> ${r.reason}</p>` : ''}
            </div>
            <div class="space-y-2">
                <textarea id="l1-notes-${r.id}" rows="2" placeholder="Optional notes..." class="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none resize-none focus:border-amber-400 transition-colors"></textarea>
                <div class="grid grid-cols-2 gap-2">
                    <button class="l1-action-btn py-2.5 rounded-xl text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors" data-id="${r.id}" data-action="approved">
                        Approve
                    </button>
                    <button class="l1-action-btn py-2.5 rounded-xl text-xs font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-colors" data-id="${r.id}" data-action="rejected">
                        Reject
                    </button>
                </div>
            </div>
        </div>`).join('');

    // Bind approve/reject buttons
    container.querySelectorAll('.l1-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const reqId = e.currentTarget.dataset.id;
            const action = e.currentTarget.dataset.action;
            const notes = document.getElementById(`l1-notes-${reqId}`)?.value.trim() || '';

            e.currentTarget.disabled = true;
            e.currentTarget.textContent = 'Processing...';

            try {
                await fetchData(`/requests/${reqId}/level1-action`, {
                    method: 'PUT',
                    body: JSON.stringify({ action, notes }),
                    headers: { 'Content-Type': 'application/json' }
                });
                // Reload inbox after action
                await loadInbox(app);
            } catch (err) {
                alert(`Error: ${err.message}`);
                e.currentTarget.disabled = false;
                e.currentTarget.textContent = action === 'approved' ? 'Approve' : 'Reject';
            }
        });
    });
}

// ─── Render: Change Schedule History Modal ────────────────────────────────────

function renderCsHistory(requests, container) {
    const csRequests = (requests || []).filter(r => r.requestType === 'change_schedule');

    if (csRequests.length === 0) {
        container.innerHTML = `<div class="text-center py-8"><p class="text-gray-400 text-xs">No change schedule requests found.</p></div>`;
        return;
    }

    container.innerHTML = csRequests.map(r => {
        const l1 = r.level1Status;
        const l1Label = l1 === 'skipped' ? 'Skipped (No Supervisor)' : (l1 === 'approved' ? '✅ Approved' : l1 === 'rejected' ? '❌ Rejected' : '⏳ Waiting');
        const finalLabel = r.status === 'approved' ? '✅ Approved' : r.status === 'rejected' ? '❌ Rejected' : '⏳ Pending';

        return `
        <div class="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-bold text-gray-800">${fmtDate(r.targetDate)}</p>
                ${statusBadge(r.status)}
            </div>
            <p class="text-xs text-gray-600 mb-2">Target: <span class="font-bold">${r.targetScheduleName || '-'} ${r.targetScheduleStart ? `(${r.targetScheduleStart}–${r.targetScheduleEnd})` : ''}</span></p>
            <div class="bg-gray-50 rounded-xl p-3 text-[11px] space-y-1 text-gray-500">
                <div class="flex justify-between"><span>Supervisor</span><span class="font-bold">${l1Label}</span></div>
                <div class="flex justify-between"><span>Manager</span><span class="font-bold">${finalLabel}</span></div>
                ${r.reason ? `<div class="pt-1 border-t border-gray-100">Reason: ${r.reason}</div>` : ''}
            </div>
            <p class="text-[10px] text-gray-300 mt-2">Submitted ${fmtDateTime(r.submittedDate)}</p>
        </div>`;
    }).join('');
}

// ─── Main: loadInbox ──────────────────────────────────────────────────────────

export async function loadInbox(app) {
    const myList     = document.getElementById('my-submissions-list');
    const approvalList    = document.getElementById('pending-approvals-list');
    const approvalSection = document.getElementById('pending-approvals-section');

    if (myList) myList.innerHTML = `<p class="text-center text-gray-400 text-xs py-6">Loading...</p>`;

    const [myRequests, pendingApprovals] = await Promise.all([
        fetchData('/user/my-requests').catch(() => []),
        fetchData('/user/pending-approvals').catch(() => [])
    ]);

    // Cache requests for the history modal
    if (app) app.state.myRequests = myRequests || [];

    if (myList)      renderMySubmissions(myRequests, myList);
    if (approvalList && approvalSection) {
        renderPendingApprovals(pendingApprovals, approvalList, approvalSection, app);
    }

    // Hide badge if no pending approvals
    const badge = document.getElementById('notification-badge');
    if (badge && (!pendingApprovals || pendingApprovals.length === 0)) {
        badge.classList.add('hidden');
    }
}

// ─── Main: openCsHistoryModal ─────────────────────────────────────────────────

export function openCsHistoryModal(app) {
    const histList = document.getElementById('cs-history-list');
    if (histList) renderCsHistory(app.state.myRequests || [], histList);
    toggleModal('cs-history-modal', true);
}
