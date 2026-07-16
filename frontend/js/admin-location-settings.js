import { fetchData } from './api.js';
import { ui } from './admin.js';

// State untuk peta dan layernya
let map = null;
let marker = null;
let circle = null;

// Koordinat default (Jakarta) jika lokasi belum di-set
const DEFAULT_COORDS = { lat: -6.2088, lng: 106.8456 };
const DEFAULT_ZOOM = 13;
const DEFAULT_RADIUS = 50; // dalam meter

/**
 * Menginisialisasi atau memperbarui peta Leaflet.
 * @param {object} coords - { lat, lng }
 * @param {number} radius
 */
function initOrUpdateMap(coords, radius) {
    if (!map) {
        // Inisialisasi peta hanya sekali
        map = L.map(ui.locationSettingMap, {
            attributionControl: false
        }).setView(coords, DEFAULT_ZOOM);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        // Tambahkan marker dan lingkaran
        marker = L.marker(coords, { draggable: true }).addTo(map);
        circle = L.circle(coords, {
            color: 'blue',
            fillColor: '#3b82f6',
            fillOpacity: 0.2,
            radius: radius
        }).addTo(map);

        // Tambahkan event listener untuk interaksi peta dan marker
        addMapEventListeners();
    } else {
        // Jika sudah ada, cukup perbarui view dan layer
        map.setView(coords, map.getZoom());
        marker.setLatLng(coords);
        circle.setLatLng(coords);
        circle.setRadius(radius);
    }
}

/**
 * Menambahkan event listener untuk interaksi peta.
 */
function addMapEventListeners() {
    // Saat peta diklik, pindahkan marker
    map.on('click', (e) => {
        const newCoords = e.latlng;
        marker.setLatLng(newCoords);
        updateFormAndCircle(newCoords, circle.getRadius());
    });

    // Saat marker selesai digeser, perbarui posisinya
    marker.on('dragend', () => {
        const newCoords = marker.getLatLng();
        updateFormAndCircle(newCoords, circle.getRadius());
    });
}

/**
 * Memperbarui input form dan lingkaran di peta.
 * @param {object} coords - { lat, lng }
 * @param {number} radius
 */
function updateFormAndCircle(coords, radius) {
    // Perbarui input form
    ui.locationLatitudeInput.value = coords.lat.toFixed(8);
    ui.locationLongitudeInput.value = coords.lng.toFixed(8);
    ui.locationRadiusInput.value = Math.round(radius);

    // Perbarui lingkaran di peta
    circle.setLatLng(coords);
    circle.setRadius(radius);
}

/**
 * Fungsi utama untuk memuat halaman pengaturan lokasi.
 */
export async function loadLocationSettings() {
    ui.locationSettingMap.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500"><i data-lucide="loader-2" class="animate-spin mr-2"></i>Loading map...</div>';
    lucide.createIcons();

    const locationData = await fetchData('/admin/company/location');

    const initialCoords = {
        lat: locationData?.latitude || DEFAULT_COORDS.lat,
        lng: locationData?.longitude || DEFAULT_COORDS.lng
    };
    const initialRadius = locationData?.radius || DEFAULT_RADIUS;

    // Set nilai form
    ui.locationLatitudeInput.value = initialCoords.lat;
    ui.locationLongitudeInput.value = initialCoords.lng;
    ui.locationRadiusInput.value = initialRadius;

    // Inisialisasi peta (dengan sedikit jeda untuk memastikan container terlihat)
    setTimeout(() => {
        initOrUpdateMap(initialCoords, initialRadius);
        if (map) map.invalidateSize(); // Perbaiki masalah tile abu-abu
    }, 100);
}

/**
 * Menangani submit form pengaturan lokasi.
 * @param {Event} e - Event submit form.
 */
async function handleLocationSettingsFormSubmit(e) {
    e.preventDefault();
    const payload = {
        latitude: parseFloat(ui.locationLatitudeInput.value),
        longitude: parseFloat(ui.locationLongitudeInput.value),
        radius: parseInt(ui.locationRadiusInput.value, 10)
    };

    if (isNaN(payload.latitude) || isNaN(payload.longitude) || isNaN(payload.radius)) {
        alert('Please enter valid numbers for latitude, longitude, and radius.');
        return;
    }

    const result = await fetchData('/admin/company/location', { method: 'PUT', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });

    if (result) {
        alert('Location settings saved successfully!');
    }
}

/**
 * Menginisialisasi event listener untuk form pengaturan lokasi.
 */
export function initLocationSettingsEventListeners() {
    // Fungsi untuk memperbarui peta dari input form
    const updateMapFromForm = () => {
        if (!map || !marker || !circle) return;

        const lat = parseFloat(ui.locationLatitudeInput.value);
        const lng = parseFloat(ui.locationLongitudeInput.value);
        const radius = parseInt(ui.locationRadiusInput.value, 10);

        // Hanya update jika semua nilai valid
        if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius) && radius >= 0) {
            const newCoords = { lat, lng };
            marker.setLatLng(newCoords);
            circle.setLatLng(newCoords);
            circle.setRadius(radius);
            // Pindahkan view peta ke koordinat baru
            map.panTo(newCoords);
        }
    };

    if (ui.locationSettingsForm) {
        ui.locationSettingsForm.addEventListener('submit', handleLocationSettingsFormSubmit);
    }

    // Tambahkan event listener untuk setiap input field
    // 'input' event akan aktif setiap kali Anda mengetik
    if (ui.locationLatitudeInput) ui.locationLatitudeInput.addEventListener('input', updateMapFromForm);
    if (ui.locationLongitudeInput) ui.locationLongitudeInput.addEventListener('input', updateMapFromForm);
    if (ui.locationRadiusInput) ui.locationRadiusInput.addEventListener('input', updateMapFromForm);
}