import { API_URL } from './api.js';

// faceapi is loaded globally from face-api.js CDN in index.html
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

let _modelsLoaded = false;
let _videoStream = null;
let _detectionTimer = null;

async function loadModels() {
    if (_modelsLoaded) return;
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    _modelsLoaded = true;
}

function stopCamera() {
    if (_detectionTimer) { clearTimeout(_detectionTimer); _detectionTimer = null; }
    if (_videoStream) { _videoStream.getTracks().forEach(t => t.stop()); _videoStream = null; }
}

function closeFaceModal() {
    stopCamera();
    const modal = document.getElementById('face-verify-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    lucide.createIcons();
}

function setStatus(msg, type = 'info') {
    const el = document.getElementById('face-status');
    if (!el) return;
    const colors = { info: 'text-gray-500', success: 'text-green-600', warning: 'text-amber-500', error: 'text-red-500' };
    el.className = `text-sm font-medium text-center my-2 min-h-[1.25rem] ${colors[type] || colors.info}`;
    el.textContent = msg;
}

async function computeDescriptor(source) {
    const det = await faceapi
        .detectSingleFace(source, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();
    return det ? det.descriptor : null;
}

function euclideanDistance(d1, d2) {
    let sum = 0;
    for (let i = 0; i < d1.length; i++) { const d = d1[i] - d2[i]; sum += d * d; }
    return Math.sqrt(sum);
}

export async function openFaceVerifyModal(app, onSuccess) {
    const modal = document.getElementById('face-verify-modal');
    if (!modal) { onSuccess(null); return; }

    const video            = document.getElementById('face-video');
    const overlayCanvas    = document.getElementById('face-overlay-canvas');
    const captureCanvas    = document.getElementById('face-capture-canvas');
    const captureBtn       = document.getElementById('btn-capture-face');
    const resultSection    = document.getElementById('face-result-section');
    const proceedBtn       = document.getElementById('btn-face-proceed');
    const retryBtn         = document.getElementById('btn-face-retry');
    const loadingSection   = document.getElementById('face-loading-section');
    const cameraContainer  = document.getElementById('face-camera-container');

    // Reset UI for fresh open
    loadingSection.classList.remove('hidden');
    cameraContainer.classList.add('hidden');
    resultSection.classList.add('hidden');
    captureBtn.classList.add('hidden');
    proceedBtn.classList.add('hidden');
    retryBtn.classList.add('hidden');
    captureBtn.disabled = true;
    delete captureBtn.dataset.capturing;
    setStatus('');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
    setStatus('Memuat model AI...', 'info');

    // Load face-api.js models (cached after first load)
    try {
        await loadModels();
    } catch {
        setStatus('Gagal memuat AI. Periksa koneksi internet.', 'error');
        loadingSection.classList.add('hidden');
        return;
    }

    // Start front camera
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('Kamera tidak didukung. Gunakan Safari untuk fitur ini.', 'error');
            loadingSection.classList.add('hidden');
            return;
        }
        _videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } }
        });
        video.srcObject = _videoStream;
        // Use addEventListener (not onloadedmetadata) to avoid race condition on Chrome iOS
        await new Promise((resolve, reject) => {
            if (video.readyState >= 1) { resolve(); return; }
            video.addEventListener('loadedmetadata', resolve, { once: true });
            setTimeout(() => reject(new Error('video metadata timeout')), 10000);
        });
        try { await video.play(); } catch { /* autoplay may be blocked, stream still active */ }
    } catch (err) {
        let msg = 'Akses kamera ditolak. Izinkan kamera dan coba lagi.';
        if (err.name === 'NotAllowedError') msg = 'Izin kamera ditolak. Buka Pengaturan > Chrome > Kamera lalu izinkan.';
        else if (err.name === 'NotFoundError') msg = 'Kamera tidak ditemukan di perangkat ini.';
        else if (err.name === 'NotSupportedError') msg = 'Kamera tidak didukung browser ini. Gunakan Safari.';
        setStatus(msg, 'error');
        loadingSection.classList.add('hidden');
        return;
    }

    loadingSection.classList.add('hidden');
    cameraContainer.classList.remove('hidden');
    captureBtn.classList.remove('hidden');
    captureBtn.disabled = true;
    setStatus('Posisikan wajah dalam frame...', 'warning');

    // Real-time face detection loop
    async function runDetectionLoop() {
        if (!_videoStream) return;
        try {
            const dets = await faceapi.detectAllFaces(
                video,
                new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 })
            );
            if (video.videoWidth > 0) {
                const size = { width: video.videoWidth, height: video.videoHeight };
                faceapi.matchDimensions(overlayCanvas, size);
                const ctx = overlayCanvas.getContext('2d');
                ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
                faceapi.draw.drawDetections(overlayCanvas, faceapi.resizeResults(dets, size));
            }
            if (!captureBtn.dataset.capturing) {
                if (dets.length > 0) {
                    captureBtn.disabled = false;
                    setStatus('Wajah terdeteksi — siap ambil foto', 'success');
                } else {
                    captureBtn.disabled = true;
                    setStatus('Posisikan wajah dalam frame...', 'warning');
                }
            }
        } catch { /* ignore per-frame errors */ }
        _detectionTimer = setTimeout(runDetectionLoop, 250);
    }

    runDetectionLoop();

    // Pre-load face photo descriptor in background.
    // Prefer dedicated face_photo_url; fall back to avatar_url if no face photo set.
    const { facePhotoUrl, avatarUrl } = app.state.user;
    const compareUrl   = facePhotoUrl || avatarUrl;
    const hasRealPhoto = compareUrl && compareUrl.startsWith('/uploads/');
    let profileDescriptor = null;
    if (hasRealPhoto) {
        try {
            const baseUrl = API_URL.replace(/\/api$/, '');
            const profileImg = await faceapi.fetchImage(baseUrl + compareUrl);
            profileDescriptor = await computeDescriptor(profileImg);
        } catch { /* no profile descriptor — skip comparison */ }
    }

    // Capture button
    captureBtn.onclick = async () => {
        captureBtn.dataset.capturing = '1';
        captureBtn.disabled = true;
        if (_detectionTimer) { clearTimeout(_detectionTimer); _detectionTimer = null; }
        overlayCanvas.getContext('2d').clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        // Snapshot from video
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        captureCanvas.getContext('2d').drawImage(video, 0, 0);
        const selfieBlob = await new Promise(r => captureCanvas.toBlob(r, 'image/jpeg', 0.85));

        // Show captured frame instead of live feed — face-api cannot read display:none canvas
        cameraContainer.classList.add('hidden');
        captureCanvas.classList.remove('hidden');
        captureCanvas.style.cssText = 'width:100%;border-radius:1rem;margin-bottom:0.75rem;';

        if (!profileDescriptor) {
            // No profile photo to compare against — capture selfie and proceed
            stopCamera();
            app.state.selfieBlob = selfieBlob;
            showProceed('Selfie diambil (foto profil belum diatur)');
            return;
        }

        setStatus('Membandingkan wajah...', 'info');

        const selfieDesc = await computeDescriptor(captureCanvas);
        if (!selfieDesc) {
            setStatus('Wajah tidak terdeteksi. Pastikan pencahayaan cukup.', 'error');
            delete captureBtn.dataset.capturing;
            captureBtn.disabled = false;
            captureCanvas.classList.add('hidden');
            captureCanvas.style.cssText = '';
            cameraContainer.classList.remove('hidden');
            runDetectionLoop();
            return;
        }

        const dist = euclideanDistance(selfieDesc, profileDescriptor);
        // Confidence: 0% at dist>=0.8, 100% at dist=0
        const pct  = Math.max(0, Math.min(100, Math.round((1 - dist / 0.8) * 100)));

        if (dist <= 0.55) {
            stopCamera();
            app.state.selfieBlob = selfieBlob;
            showProceed(`Wajah dikenali (${pct}% cocok)`);
        } else {
            delete captureBtn.dataset.capturing;
            showRejected(pct);
        }
    };

    function showProceed(msg) {
        resultSection.innerHTML = `
            <div class="flex flex-col items-center py-2 space-y-1">
                <span class="text-3xl">✅</span>
                <p class="text-green-600 font-bold text-sm text-center">${msg}</p>
            </div>`;
        resultSection.classList.remove('hidden');
        captureBtn.classList.add('hidden');
        proceedBtn.classList.remove('hidden');
        setStatus('');
        lucide.createIcons();
        proceedBtn.onclick = () => {
            closeFaceModal();
            onSuccess(app.state.selfieBlob);
        };
    }

    function showRejected(pct) {
        resultSection.innerHTML = `
            <div class="flex flex-col items-center py-2 space-y-1">
                <span class="text-3xl">❌</span>
                <p class="text-red-500 font-bold text-sm text-center">Wajah tidak cocok (${pct}% mirip)</p>
                <p class="text-gray-400 text-xs text-center">Pastikan pencahayaan cukup dan wajah terlihat jelas</p>
            </div>`;
        resultSection.classList.remove('hidden');
        retryBtn.classList.remove('hidden');
        setStatus('');
        lucide.createIcons();
        retryBtn.onclick = () => {
            resultSection.classList.add('hidden');
            retryBtn.classList.add('hidden');
            captureBtn.disabled = true;
            captureCanvas.classList.add('hidden');
            captureCanvas.style.cssText = '';
            cameraContainer.classList.remove('hidden');
            runDetectionLoop();
        };
    }

    document.getElementById('btn-close-face-verify').onclick = () => closeFaceModal();
}
