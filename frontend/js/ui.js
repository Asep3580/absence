import { fetchData } from './api.js';

export function updateClock(app) {
    const now = new Date();
    app.dom.currentTime.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    app.dom.currentDate.innerText = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const hour = now.getHours();
    let greeting = "Good morning,";
    if (hour >= 12 && hour < 18) greeting = "Good afternoon,";
    else if (hour >= 18 || hour < 5) greeting = "Good evening,";

    if (app.dom.greetingText && app.dom.greetingText.innerText !== greeting) {
        app.dom.greetingText.innerText = greeting;
    }
    if (app.dom.greetingName) {
        app.dom.greetingName.textContent = (app.state.user.fullName || app.state.user.username).split(' ')[0];
    }
}

// Haversine distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function setGeoBanner(type, text) {
    const banner = document.getElementById('geo-status-banner');
    const btn    = document.getElementById('confirm-attendance');
    if (!banner) return;

    const styles = {
        loading: { bg: 'bg-slate-100 border border-slate-200 text-slate-600', icon: '⏳', btnClass: 'bg-blue-600 hover:bg-blue-700', btnDisabled: false },
        ok:      { bg: 'bg-green-50 border border-green-200 text-green-700',  icon: '✅', btnClass: 'bg-green-600 hover:bg-green-700', btnDisabled: false },
        warn:    { bg: 'bg-red-50 border border-red-200 text-red-700',        icon: '🚫', btnClass: 'bg-red-400 cursor-not-allowed',   btnDisabled: true  },
        error:   { bg: 'bg-yellow-50 border border-yellow-200 text-yellow-700', icon: '⚠️', btnClass: 'bg-blue-600 hover:bg-blue-700', btnDisabled: false },
    };
    const s = styles[type] || styles.error;
    banner.className = `rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 text-sm font-semibold ${s.bg}`;
    banner.innerHTML = `<span class="text-lg leading-none shrink-0">${s.icon}</span><span>${text}</span>`;
    banner.classList.remove('hidden');

    if (btn) {
        btn.disabled = s.btnDisabled;
        btn.className = `w-full text-white py-4.5 rounded-2xl font-bold flex items-center justify-center space-x-2 transition-colors ${s.btnClass}`;
    }
}

export function updateLocationData(app) {
    if (!navigator.geolocation) {
        setGeoBanner('error', 'Geolocation tidak didukung browser ini.');
        return;
    }

    // Clear any previous watch before starting a new one
    if (app.state._geoWatchId != null) {
        navigator.geolocation.clearWatch(app.state._geoWatchId);
        app.state._geoWatchId = null;
    }

    setGeoBanner('loading', 'Mendapatkan lokasi GPS...');
    if (app.dom.currentAddress) app.dom.currentAddress.innerText = 'Mendapatkan lokasi...';

    let settled = false;
    let permissionDenied = false;

    async function finalize(lat, lng) {
        settled = true;
        if (app.state._geoWatchId != null) {
            navigator.geolocation.clearWatch(app.state._geoWatchId);
            app.state._geoWatchId = null;
        }

        // Reverse geocode
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
            const data = await response.json();
            app.state.currentAddress = data.display_name || "Address not found";
        } catch {
            app.state.currentAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
        if (app.dom.currentAddress) app.dom.currentAddress.innerText = app.state.currentAddress;
        if (app.dom.modalAddress)   app.dom.modalAddress.innerText   = app.state.currentAddress;

        // Remove spin from refresh icon once location is finalized
        const refreshIcon = document.getElementById('icon-refresh-loc');
        if (refreshIcon) refreshIcon.classList.remove('animate-spin');

        // Geofence check
        try {
            const office = await fetchData('/user/office-location');
            if (office && office.latitude && office.longitude && office.radius) {
                const dist = Math.round(getDistance(lat, lng, office.latitude, office.longitude));
                if (dist <= office.radius) {
                    setGeoBanner('ok', `Dalam jangkauan kantor &mdash; ${dist} m dari titik absensi (radius ${office.radius} m).`);
                } else {
                    setGeoBanner('warn', `Di luar jangkauan! Anda ${dist} m dari kantor, radius yang diizinkan ${office.radius} m.`);
                }
            } else {
                setGeoBanner('ok', 'Lokasi terdeteksi. Tidak ada pembatasan area absensi.');
            }
        } catch {
            setGeoBanner('ok', 'Lokasi terdeteksi. Validasi area tidak tersedia.');
        }
    }

    function handlePosition(position) {
        if (settled) return;
        const { latitude, longitude, accuracy } = position.coords;
        app.state.currentCoords = { lat: latitude, lng: longitude };

        // Update map marker in real-time as GPS improves
        if (app.state.modalMap) {
            app.state.modalMap.setView(app.state.currentCoords, 17);
            app.state.modalMarker.setLatLng(app.state.currentCoords);
        }

        const accM = Math.round(accuracy);
        setGeoBanner('loading', `Akurasi GPS: ±${accM} m &mdash; ${accuracy <= 150 ? 'siap!' : 'memperbaiki...'}`);

        // Settle once accuracy is good enough (150m cukup untuk WiFi positioning di Mac/laptop)
        if (accuracy <= 150) {
            finalize(latitude, longitude);
        }
    }

    // Last resort: IP-based geolocation (akurasi kota, tidak butuh izin browser)
    function fallbackToIPGeolocation() {
        setGeoBanner('loading', 'Mencoba lokasi via IP...');
        fetch('https://ipapi.co/json/')
            .then(r => r.json())
            .then(data => {
                if (!settled && data.latitude && data.longitude) {
                    app.state.currentCoords = { lat: data.latitude, lng: data.longitude };
                    if (app.state.modalMap) {
                        app.state.modalMap.setView(app.state.currentCoords, 14);
                        app.state.modalMarker.setLatLng(app.state.currentCoords);
                    }
                    finalize(data.latitude, data.longitude);
                } else if (!settled) {
                    setGeoBanner('error', 'Tidak dapat mendeteksi lokasi. Aktifkan Location Services: System Settings → Privacy & Security → Location Services → izinkan browser Anda.');
                }
            })
            .catch(() => {
                if (!settled) setGeoBanner('error', 'Tidak dapat mendeteksi lokasi. Aktifkan Location Services: System Settings → Privacy & Security → Location Services → izinkan browser Anda.');
            });
    }

    function fallbackToNetworkLocation() {
        setGeoBanner('loading', 'Menggunakan lokasi jaringan (WiFi)...');
        navigator.geolocation.getCurrentPosition(
            (pos) => { if (!settled) finalize(pos.coords.latitude, pos.coords.longitude); },
            () => { if (!settled) fallbackToIPGeolocation(); },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
    }

    function handleError(err) {
        if (settled) return;
        // Timeout atau kCLErrorLocationUnknown (Mac) → fallback bertahap
        if (err.code === 3 || err.code === 2) {
            fallbackToNetworkLocation();
            return;
        }
        // Izin ditolak → langsung IP fallback (tidak bisa minta ulang)
        if (err.code === 1) {
            permissionDenied = true;
            setGeoBanner('error', 'Izin lokasi ditolak. Aktifkan di: System Settings → Privacy & Security → Location Services → izinkan browser Anda.');
            fallbackToIPGeolocation();
        }
    }

    app.state._geoWatchId = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Force settle after 20 detik dengan posisi terbaik yang ada
    setTimeout(() => {
        if (!settled) {
            const { lat, lng } = app.state.currentCoords;
            if (lat !== -6.2088) {
                finalize(lat, lng);
            } else {
                permissionDenied ? fallbackToIPGeolocation() : fallbackToNetworkLocation();
            }
        }
    }, 20000);
}

export function initModalMap(app) {
    if (app.state.modalMap) return;
    app.state.modalMap = L.map('modal-map', { zoomControl: false, attributionControl: false }).setView(app.state.currentCoords, 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(app.state.modalMap);
    app.state.modalMarker = L.marker(app.state.currentCoords).addTo(app.state.modalMap);
}

export function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.toggle('flex', show), modal.classList.toggle('hidden', !show);
}
