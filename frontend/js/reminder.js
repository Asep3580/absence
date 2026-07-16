let _timers = [];

function clearTimers() {
    _timers.forEach(t => clearTimeout(t));
    _timers = [];
}

function firstName(user) {
    const name = user?.fullName || user?.username || '';
    return name.trim().split(' ')[0] || 'Kamu';
}

function showBanner(message, onAction) {
    document.getElementById('schedule-reminder-popup')?.remove();

    const el = document.createElement('div');
    el.id = 'schedule-reminder-popup';
    el.className = [
        'fixed bottom-28 left-4 right-4 z-[9999]',
        'bg-white border border-indigo-200 rounded-2xl shadow-2xl',
        'px-4 py-4 flex flex-col gap-3',
        'transition-all duration-300 translate-y-4 opacity-0'
    ].join(' ');

    el.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-2xl shrink-0">🔔</span>
            <p class="text-sm font-semibold text-gray-800 leading-snug flex-1">${message}</p>
            <button id="reminder-x" class="text-gray-400 hover:text-gray-600 text-base leading-none shrink-0 mt-0.5">✕</button>
        </div>
        <div class="flex gap-2">
            <button id="reminder-act" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">Lakukan Sekarang</button>
            <button id="reminder-skip" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-xl transition-colors">Nanti</button>
        </div>
    `;

    document.body.appendChild(el);

    // Animate in
    requestAnimationFrame(() => {
        el.classList.remove('translate-y-4', 'opacity-0');
        el.classList.add('translate-y-0', 'opacity-100');
    });

    const dismiss = () => {
        el.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => el.remove(), 300);
    };

    document.getElementById('reminder-x').addEventListener('click', dismiss);
    document.getElementById('reminder-skip').addEventListener('click', dismiss);
    document.getElementById('reminder-act').addEventListener('click', () => {
        dismiss();
        if (onAction) onAction();
    });

    // Auto-dismiss setelah 30 detik
    const autoDismiss = setTimeout(dismiss, 30000);
    el.addEventListener('click', () => clearTimeout(autoDismiss), { once: true });
}

function notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body, icon: '/favicon.ico' }); } catch (_) {}
    }
}

export async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

export function scheduleReminders(app, startTimeStr, endTimeStr) {
    clearTimers();

    const name = firstName(app.state?.user);
    const now = new Date();

    function toToday(timeStr) {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
    }

    // Pengingat Clock In — 30 menit sebelum jadwal mulai
    if (startTimeStr) {
        const target = new Date(toToday(startTimeStr).getTime() - 30 * 60 * 1000);
        const delay = target - now;
        if (delay > 0) {
            _timers.push(setTimeout(() => {
                if (!app.state.isClockedIn && !app.state.isCompletedToday) {
                    const msg = `Hi ${name}, jangan lupa Clock In ya! Jadwal mulai jam <strong>${startTimeStr}</strong>.`;
                    notify('Pengingat Clock In 🕐', `Hi ${name}, jangan lupa Clock In! Jadwal mulai jam ${startTimeStr}.`);
                    showBanner(msg, () => app.dom.btnAttendance?.click());
                }
            }, delay));
        }
    }

    // Pengingat Clock Out — 15 menit sebelum jadwal selesai
    if (endTimeStr) {
        const target = new Date(toToday(endTimeStr).getTime() - 15 * 60 * 1000);
        const delay = target - now;
        if (delay > 0) {
            _timers.push(setTimeout(() => {
                if (app.state.isClockedIn) {
                    const msg = `Hi ${name}, jangan lupa Clock Out ya! Jadwal selesai jam <strong>${endTimeStr}</strong>.`;
                    notify('Pengingat Clock Out 🏁', `Hi ${name}, jangan lupa Clock Out! Jadwal selesai jam ${endTimeStr}.`);
                    showBanner(msg, () => app.dom.btnAttendance?.click());
                }
            }, delay));
        }
    }
}
