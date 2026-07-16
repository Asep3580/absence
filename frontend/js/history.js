import { createElement } from './utils.js';

/**
 * Merender daftar riwayat absensi pengguna.
 * @param {object} app - Objek aplikasi utama.
 */
export function renderHistory(app) {
    if (!app.dom.historyList) return;

    app.dom.historyList.innerHTML = '';

    if (!app.state.historyData || app.state.historyData.length === 0) {
        const emptyMessage = createElement('div', 'text-center text-gray-500 py-10');
        emptyMessage.innerHTML = `<i data-lucide="info" class="w-8 h-8 mx-auto mb-2 text-gray-400"></i><p class="font-medium">No attendance history found.</p><p class="text-xs">Your clock-in and clock-out records will appear here.</p>`;
        app.dom.historyList.appendChild(emptyMessage);
        lucide.createIcons();
        return;
    }

    const fragment = document.createDocumentFragment();

    app.state.historyData.forEach(record => {
        // Gunakan tanggal check-in, atau tanggal pembuatan record sebagai fallback (untuk cuti/sakit)
        const recordDate = record.check_in_time ? new Date(record.check_in_time) : new Date(record.created_at);
        if (isNaN(recordDate.getTime())) return; // Lewati record jika tanggal tidak valid

        const card = createElement('div', 'bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4');

        // 1. Ikon berdasarkan status
        const statusIconMap = {
            'present': 'calendar-check',
            'on_leave': 'plane',
            'sick': 'thermometer',
            'absent': 'calendar-x'
        };
        const iconContainer = createElement('div', 'p-3 bg-gray-100 rounded-lg text-gray-600');
        iconContainer.innerHTML = `<i data-lucide="${statusIconMap[record.status] || 'calendar'}" class="w-5 h-5"></i>`;

        // 2. Kontainer Info Utama
        const infoContainer = createElement('div', 'flex-1');

        // Baris Atas: Tanggal dan Status Badge
        const topRow = createElement('div', 'flex justify-between items-center');
        const dateText = createElement('p', 'font-bold text-gray-800 text-sm');
        dateText.textContent = `${recordDate.toLocaleDateString('en-US', { weekday: 'short' })}, ${recordDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}`;
        
        const statusMap = {
            'present': { text: 'Present', class: 'bg-green-100 text-green-800' },
            'absent': { text: 'Absent', class: 'bg-red-100 text-red-800' },
            'on_leave': { text: 'On Leave', class: 'bg-blue-100 text-blue-800' },
            'sick': { text: 'Sick', class: 'bg-yellow-100 text-yellow-800' },
        };
        const status = statusMap[record.status] || { text: record.status, class: 'bg-slate-100 text-slate-800' };
        const statusBadge = createElement('span', `capitalize text-xs font-bold px-2.5 py-1 rounded-full ${status.class}`, status.text);
        topRow.append(dateText, statusBadge);

        // Baris Bawah: Waktu dan Durasi
        const bottomRow = createElement('div', 'flex items-center space-x-4 text-xs text-gray-500 mt-1.5');
        
        let checkInTimeFormatted = '--:--';
        if (record.check_in_time) {
            const checkInDateTime = new Date(record.check_in_time);
            checkInTimeFormatted = checkInDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            if (record.scheduledStartTime) {
                const scheduledTimeParts = record.scheduledStartTime.split(':');
                const scheduledDateTime = new Date(checkInDateTime.getTime());
                scheduledDateTime.setHours(parseInt(scheduledTimeParts[0]), parseInt(scheduledTimeParts[1]), 0, 0);
                if (checkInDateTime > scheduledDateTime) {
                    const lateInMinutes = Math.floor((checkInDateTime - scheduledDateTime) / 60000);
                    checkInTimeFormatted += ` <span class="text-red-600 font-bold">(Late ${lateInMinutes}m)</span>`;
                }
            }
        }
        
        const checkOutTimeFormatted = record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        
        let durationText = '--';
        if (record.check_in_time && record.check_out_time) {
            const durationMs = new Date(record.check_out_time) - new Date(record.check_in_time);
            const hours = Math.floor(durationMs / 3600000);
            const minutes = Math.floor((durationMs % 3600000) / 60000);
            durationText = `${hours}h ${minutes}m`;
        }

        bottomRow.innerHTML = `
            <div class="flex items-center space-x-1"><i data-lucide="log-in" class="w-3 h-3 text-green-500"></i><span>${checkInTimeFormatted}</span></div>
            <div class="flex items-center space-x-1"><i data-lucide="log-out" class="w-3 h-3 text-red-500"></i><span>${checkOutTimeFormatted}</span></div>
            <div class="flex items-center space-x-1"><i data-lucide="hourglass" class="w-3 h-3 text-blue-500"></i><span class="font-medium">${durationText}</span></div>
        `;

        infoContainer.append(topRow, bottomRow);
        card.append(iconContainer, infoContainer);
        fragment.appendChild(card);
    });

    app.dom.historyList.appendChild(fragment);
    lucide.createIcons();
}