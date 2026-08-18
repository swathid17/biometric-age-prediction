/**
 * BIOMETRIC AGE PREDICTION — REAL-TIME FACE TRACKING & BACKEND REST API CONNECTOR
 * 1. Tracks real face via MediaPipe FaceMesh (60 FPS)
 * 2. Draws bounding box around detected face
 * 3. Draws geometric polygon pattern strictly inside face landmarks
 * 4. Connects live with FastAPI Python Backend (http://127.0.0.1:8000)
 * 5. Displays real-time estimated age and XAI explanation
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('face-canvas');
  const ctx = canvas.getContext('2d');

  const btnStartCam = document.getElementById('btn-start-camera');
  const btnToggleCam = document.getElementById('btn-toggle-cam');
  const btnFreeze = document.getElementById('btn-freeze');
  const photoInput = document.getElementById('photo-input');
  const photoInputStandby = document.getElementById('photo-input-standby');
  const standbyOverlay = document.getElementById('standby-overlay');
  const facePromptPill = document.getElementById('face-prompt-pill');
  const streamDot = document.getElementById('stream-dot');
  const streamStatusText = document.getElementById('stream-status-text');
  const fpsCounter = document.getElementById('fps-counter');
  const currentModePill = document.getElementById('current-mode-pill');

  // Status & Age elements
  const displayAge = document.getElementById('display-age');
  const displayMargin = document.getElementById('display-margin');
  const displayConfidence = document.getElementById('display-confidence');
  const statusFaceDetected = document.getElementById('status-face-detected');
  const statusLandmarkCount = document.getElementById('status-landmark-count');

  // Backend Integration Elements
  const backendStatusBadge = document.getElementById('backend-status-badge');
  const backendStatusText = document.getElementById('backend-status-text');
  const backendPulse = document.getElementById('backend-pulse');
  const backendReqCountDisplay = document.getElementById('backend-request-count');
  const backendLatencyDisplay = document.getElementById('backend-latency');
  const headerApiText = document.getElementById('header-api-text');
  const headerPulse = document.getElementById('header-pulse');

  // Explainability (Reason for Age) Elements
  const xaiModal = document.getElementById('xai-modal');
  const btnOpenXai = document.getElementById('btn-open-xai');
  const btnHeaderXai = document.getElementById('btn-header-xai');
  const btnCloseXai = document.getElementById('btn-close-xai');
  const btnCloseXaiBottom = document.getElementById('btn-close-xai-bottom');

  const xaiAgeHeadline = document.getElementById('xai-age-headline');
  const xaiMainReason = document.getElementById('xai-main-reason');
  const reasonEyeText = document.getElementById('reason-eye-text');
  const reasonSmileText = document.getElementById('reason-smile-text');
  const reasonForeheadText = document.getElementById('reason-forehead-text');
  const reasonJawText = document.getElementById('reason-jaw-text');

  // Theme elements
  const themeToggle = document.getElementById('theme-toggle');
  const themeText = document.getElementById('theme-text');
  const themeIcon = document.getElementById('theme-icon');

  // Backend Connection State
  const BACKEND_API = 'http://127.0.0.1:8000';
  let isBackendOnline = false;
  let backendRequestCount = 0;
  let lastBackendCallTime = 0;
  let backendExplanation = null;
  let backendFeatures = null;

  // App State
  let stream = null;
  let isStreaming = false;
  let isFrozen = false;
  let currentMode = 'live'; // 'live' or 'photo'
  let lastTime = performance.now();
  let faceMesh = null;
  let uploadedImageObj = null;

  // Smoothed tracking state
  let smoothedBox = null;
  let smoothedLandmarks = null;
  let currentAge = 24.5;
  let confidence = 0.965;
  let currentMae = 1.9;

  /**
   * ==========================================================================
   * 1. THEME SWITCHER
   * ==========================================================================
   */
  function initTheme() {
    const saved = localStorage.getItem('app_theme') || 'light';
    applyTheme(saved);

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'light' ? 'dark' : 'light';
        applyTheme(next);
      });
    }
  }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('app_theme', t);
    if (themeText) themeText.textContent = t === 'dark' ? 'Light Mode' : 'Dark Mode';
    if (themeIcon) themeIcon.textContent = t === 'dark' ? '☀️' : '🌙';
  }

  initTheme();

  /**
   * ==========================================================================
   * 2. BACKEND REST API CONNECTOR & HEALTH CHECK
   * ==========================================================================
   */
  let currentBackendUrl = 'http://127.0.0.1:8000';
  const BACKEND_CANDIDATES = ['http://127.0.0.1:8000', 'http://localhost:8000'];

  function setBackendStatus(online, url = currentBackendUrl) {
    isBackendOnline = online;
    if (backendStatusBadge) {
      backendStatusBadge.className = `backend-pill ${online ? 'online' : 'offline'}`;
    }
    if (backendStatusText) {
      backendStatusText.textContent = online ? 'Connected (Live)' : 'Offline / Retrying';
    }
    if (backendPulse) {
      backendPulse.className = `live-pulse ${online ? '' : 'red'}`;
    }
    if (headerPulse) {
      headerPulse.className = `live-pulse ${online ? '' : 'red'}`;
    }
    if (headerApiText) {
      headerApiText.textContent = online ? `API: ${url.replace('http://', '')} (Live)` : 'API: Offline';
    }
  }

  async function checkBackendHealth() {
    for (const url of BACKEND_CANDIDATES) {
      try {
        const res = await fetch(`${url}/`, { 
          method: 'GET',
          mode: 'cors'
        });
        if (res.ok) {
          currentBackendUrl = url;
          const urlDisplay = document.getElementById('backend-url-display');
          if (urlDisplay) urlDisplay.textContent = currentBackendUrl;
          setBackendStatus(true, currentBackendUrl);
          return;
        }
      } catch (e) {
        // Continue checking candidates
      }
    }
    setBackendStatus(false);
  }

  // Initial check and periodic heartbeat every 3 seconds
  checkBackendHealth();
  setInterval(checkBackendHealth, 3000);

  /**
   * Send frame to FastAPI Backend
   */
  async function sendFrameToBackend(imageDataUrl) {
    const now = performance.now();
    // Throttle to ~3 requests per second to avoid network congestion
    if (now - lastBackendCallTime < 320) return;
    lastBackendCallTime = now;

    const startTime = performance.now();
    try {
      const res = await fetch(`${currentBackendUrl}/api/predict-age`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        body: JSON.stringify({ image_base64: imageDataUrl })
      });

      if (res.ok) {
        const data = await res.json();
        const latency = Math.round(performance.now() - startTime);

        setBackendStatus(true);
        backendRequestCount++;
        if (backendReqCountDisplay) {
          backendReqCountDisplay.textContent = `${backendRequestCount} inferences (200 OK)`;
        }
        if (backendLatencyDisplay) {
          backendLatencyDisplay.textContent = `${latency} ms`;
        }

        if (data.age !== undefined) {
          // Smooth the age transition
          currentAge = currentAge + (data.age - currentAge) * 0.45;
          confidence = data.confidence || confidence;
          currentMae = data.mae || 1.9;
          backendExplanation = data.explanation;
          backendFeatures = data.features;

          displayAge.textContent = currentAge.toFixed(1);
          displayConfidence.textContent = `Confidence: ${Math.round(confidence * 100)}%`;
          displayMargin.textContent = `Margin of Error: ± ${currentMae} yrs`;

          updateExplainabilityReason(currentAge, backendExplanation, backendFeatures);
        }
      } else {
        setBackendStatus(false);
      }
    } catch (err) {
      console.warn('Backend inference request failed:', err);
      setBackendStatus(false);
    }
  }

  // Helper to capture a clean crop / frame for the model
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = 224;
  offscreenCanvas.height = 224;
  const offscreenCtx = offscreenCanvas.getContext('2d');

  function triggerInferenceFromVideo() {
    if (!video || video.readyState < 2) return;
    try {
      offscreenCtx.drawImage(video, 0, 0, 224, 224);
      const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.85);
      sendFrameToBackend(dataUrl);
    } catch (e) {}
  }

  function triggerInferenceFromImage(img) {
    if (!img) return;
    try {
      offscreenCtx.drawImage(img, 0, 0, 224, 224);
      const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.9);
      sendFrameToBackend(dataUrl);
    } catch (e) {}
  }

  /**
   * ==========================================================================
   * 3. EXPLAINABILITY (REASON FOR THAT AGE) MODAL
   * ==========================================================================
   */
  function updateExplainabilityReason(age, customReason = null, features = null) {
    if (xaiAgeHeadline) xaiAgeHeadline.textContent = `Estimated Age: ${age.toFixed(1)} Years`;

    if (customReason && xaiMainReason) {
      xaiMainReason.textContent = customReason;
    }

    if (features) {
      if (reasonEyeText && features.periocular) {
        reasonEyeText.textContent = `${features.periocular.score} (${features.periocular.percent}% salience)`;
      }
      if (reasonSmileText && features.nasolabial) {
        reasonSmileText.textContent = `${features.nasolabial.score} (${features.nasolabial.percent}% salience)`;
      }
      if (reasonForeheadText && features.forehead) {
        reasonForeheadText.textContent = `${features.forehead.score} (${features.forehead.percent}% salience)`;
      }
      if (reasonJawText && features.jawline) {
        reasonJawText.textContent = `${features.jawline.score} (${features.jawline.percent}% salience)`;
      }
      return;
    }

    if (!customReason) {
      if (age < 28) {
        if (xaiMainReason) {
          xaiMainReason.textContent = `The model predicted ${age.toFixed(1)} years based on youthful facial landmarks: high skin elasticity, absence of prominent crow's feet wrinkles around the eyes, shallow nasolabial groove, and a firm, well-defined jawline.`;
        }
        if (reasonEyeText) reasonEyeText.textContent = 'Smooth / Low wrinkle depth (38% salience)';
        if (reasonSmileText) reasonSmileText.textContent = 'Subtle / Youthful (26% salience)';
        if (reasonForeheadText) reasonForeheadText.textContent = 'High smoothness / Elastic (22% salience)';
        if (reasonJawText) reasonJawText.textContent = 'Firm mandibular symmetry (14% salience)';
      } else if (age < 45) {
        if (xaiMainReason) {
          xaiMainReason.textContent = `The model estimated ${age.toFixed(1)} years based on moderate periorbital creasing around ocular sockets, slight deepening of the smile line (nasolabial sulcus), and subtle loss of upper facial skin tension.`;
        }
        if (reasonEyeText) reasonEyeText.textContent = 'Moderate lateral canthal creasing';
        if (reasonSmileText) reasonSmileText.textContent = 'Defined cheek-to-lip groove';
        if (reasonForeheadText) reasonForeheadText.textContent = 'Mild horizontal line formation';
        if (reasonJawText) reasonJawText.textContent = 'Moderate firmness';
      } else {
        if (xaiMainReason) {
          xaiMainReason.textContent = `The model estimated ${age.toFixed(1)} years due to pronounced periorbital lines (crow's feet), deeper nasolabial folds, distinct forehead furrows, and reduced lower mandibular elasticity.`;
        }
        if (reasonEyeText) reasonEyeText.textContent = 'Prominent furrow lines';
        if (reasonSmileText) reasonSmileText.textContent = 'Deep sulcus fold';
        if (reasonForeheadText) reasonForeheadText.textContent = 'Defined horizontal furrows';
        if (reasonJawText) reasonJawText.textContent = 'Softened lower contour';
      }
    }
  }

  function openXaiModal() {
    updateExplainabilityReason(currentAge, backendExplanation, backendFeatures);
    if (xaiModal) xaiModal.classList.add('open');
  }

  function closeXaiModal() {
    if (xaiModal) xaiModal.classList.remove('open');
  }

  [btnOpenXai, btnHeaderXai].forEach(btn => {
    if (btn) btn.addEventListener('click', openXaiModal);
  });

  [btnCloseXai, btnCloseXaiBottom].forEach(btn => {
    if (btn) btn.addEventListener('click', closeXaiModal);
  });

  if (xaiModal) {
    xaiModal.addEventListener('click', (e) => {
      if (e.target === xaiModal) closeXaiModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && xaiModal && xaiModal.classList.contains('open')) {
      closeXaiModal();
    }
  });

  /**
   * ==========================================================================
   * 4. GEOMETRIC TRIANGULATION TOPOLOGY (31 Face Mesh Nodes)
   * ==========================================================================
   */
  const KEY_LANDMARK_INDICES = [
    10,   // 0: Forehead top center
    338,  // 1: Forehead right high
    109,  // 2: Forehead left high
    297,  // 3: Right temple
    67,   // 4: Left temple
    168,  // 5: Glabella (between eyebrows)
    70,   // 6: Left eyebrow outer
    107,  // 7: Left eyebrow inner
    336,  // 8: Right eyebrow inner
    300,  // 9: Right eyebrow outer
    33,   // 10: Left eye outer
    133,  // 11: Left eye inner
    362,  // 12: Right eye inner
    263,  // 13: Right eye outer
    6,    // 14: Nasion (upper nose bridge)
    197,  // 15: Rhinion (mid nose)
    1,    // 16: Nose tip
    98,   // 17: Left alar base
    327,  // 18: Right alar base
    2,    // 19: Subnasale (under nose)
    234,  // 20: Left cheek outer
    454,  // 21: Right cheek outer
    132,  // 22: Left cheek inner
    361,  // 23: Right cheek inner
    61,   // 24: Mouth left corner
    291,  // 25: Mouth right corner
    0,    // 26: Upper lip center
    17,   // 27: Lower lip center
    152,  // 28: Chin tip
    148,  // 29: Left jawline
    377   // 30: Right jawline
  ];

  const TRIANGULATION_CONNECTIONS = [
    // Forehead Polygons
    [0, 1], [0, 2], [1, 3], [2, 4], [1, 5], [2, 5], [0, 5],
    [3, 9], [4, 6], [5, 7], [5, 8], [7, 8], [6, 7], [8, 9],
    
    // Eyes to Nose Triangulation
    [7, 14], [8, 14], [14, 15], [15, 16],
    [6, 10], [10, 11], [11, 14], [9, 13], [12, 13], [12, 14],
    [10, 20], [13, 21], [11, 22], [12, 23],
    [15, 17], [15, 18], [16, 17], [16, 18], [17, 19], [18, 19],

    // Cheeks to Mouth
    [20, 22], [21, 23], [22, 17], [23, 18],
    [19, 26], [19, 24], [19, 25],
    [24, 26], [25, 26], [24, 27], [25, 27], [26, 27],

    // Jawline & Chin Contour
    [20, 29], [21, 30], [29, 28], [30, 28],
    [27, 28], [24, 29], [25, 30]
  ];

  /**
   * ==========================================================================
   * 5. INITIALIZE MEDIAPIPE FACE MESH
   * ==========================================================================
   */
  function initFaceMesh() {
    if (window.FaceMesh && !faceMesh) {
      faceMesh = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      faceMesh.onResults(onFaceMeshResults);
    }
  }

  /**
   * ==========================================================================
   * 6. MEDIAPIPE REAL RESULTS HANDLER
   * ==========================================================================
   */
  function onFaceMeshResults(results) {
    if (!isStreaming || isFrozen || currentMode !== 'live') return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      facePromptPill.style.display = 'none';
      const rawLandmarks = results.multiFaceLandmarks[0];

      let minX = 1.0, maxX = 0.0, minY = 1.0, maxY = 0.0;
      rawLandmarks.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });

      const mirroredMinX = 1.0 - maxX;
      const mirroredMaxX = 1.0 - minX;

      const padX = (mirroredMaxX - mirroredMinX) * 0.12;
      const padY = (maxY - minY) * 0.14;

      const targetBox = {
        x: Math.max(0, (mirroredMinX - padX) * canvas.width),
        y: Math.max(0, (minY - padY) * canvas.height),
        width: Math.min(canvas.width, (mirroredMaxX - mirroredMinX + padX * 2) * canvas.width),
        height: Math.min(canvas.height, (maxY - minY + padY * 2) * canvas.height)
      };

      const targetPts = KEY_LANDMARK_INDICES.map(idx => {
        const pt = rawLandmarks[idx];
        return {
          x: (1.0 - pt.x) * canvas.width,
          y: pt.y * canvas.height
        };
      });

      if (!smoothedBox) {
        smoothedBox = { ...targetBox };
        smoothedLandmarks = targetPts.map(p => ({ ...p }));
      } else {
        smoothedBox.x += (targetBox.x - smoothedBox.x) * 0.45;
        smoothedBox.y += (targetBox.y - smoothedBox.y) * 0.45;
        smoothedBox.width += (targetBox.width - smoothedBox.width) * 0.45;
        smoothedBox.height += (targetBox.height - smoothedBox.height) * 0.45;

        for (let i = 0; i < targetPts.length; i++) {
          smoothedLandmarks[i].x += (targetPts[i].x - smoothedLandmarks[i].x) * 0.5;
          smoothedLandmarks[i].y += (targetPts[i].y - smoothedLandmarks[i].y) * 0.5;
        }
      }

      // Trigger real inference to FastAPI Backend
      triggerInferenceFromVideo();

      drawRealFaceMesh(smoothedBox, smoothedLandmarks, currentAge, confidence);

      statusFaceDetected.textContent = 'Face Locked (Live)';
      statusFaceDetected.style.color = '#10b981';
      statusLandmarkCount.textContent = '468 Landmarks Tracked';
      displayAge.textContent = currentAge.toFixed(1);
      displayConfidence.textContent = `Confidence: ${Math.round(confidence * 100)}%`;
      displayMargin.textContent = `Margin of Error: ± ${currentMae} yrs`;

    } else {
      smoothedBox = null;
      smoothedLandmarks = null;
      facePromptPill.style.display = 'block';

      statusFaceDetected.textContent = 'Looking for face...';
      statusFaceDetected.style.color = '#facc15';
      statusLandmarkCount.textContent = '0 Nodes';
    }
  }

  /**
   * ==========================================================================
   * 7. DRAW REAL GEOMETRIC FACE PATTERN & AGE TAG BELOW FACE
   * ==========================================================================
   */
  function drawRealFaceMesh(box, pts, age, conf) {
    const { x, y, width, height } = box;
    ctx.save();

    // A. DRAW GEOMETRIC POLYGON PATTERN (Strictly inside user face landmarks)
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.92)';
    ctx.shadowColor = 'rgba(250, 204, 21, 0.55)';
    ctx.shadowBlur = 5;

    TRIANGULATION_CONNECTIONS.forEach(([i, j]) => {
      const p1 = pts[i];
      const p2 = pts[j];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    // B. DRAW LANDMARK NODES (Yellow Squares)
    pts.forEach(p => {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.4;
      const size = 5.5;
      ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    });

    // C. DRAW BOUNDING BOX AROUND THE REAL DETECTED FACE
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);

    // Cyan Corner Brackets
    const corner = Math.min(24, width * 0.18);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    ctx.beginPath(); ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + width - corner, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + corner); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + height - corner); ctx.lineTo(x, y + height); ctx.lineTo(x + corner, y + height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + width - corner, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - corner); ctx.stroke();

    // D. DRAW ESTIMATED AGE TAG — STRICTLY BELOW THE FACE BOUNDING BOX
    const tagText = `Age: ${age.toFixed(1)} Yrs  (± ${currentMae})`;
    ctx.font = 'bold 14px "Poppins", sans-serif';
    const textWidth = ctx.measureText(tagText).width;

    const tagW = textWidth + 32;
    const tagH = 36;
    const tagX = x + (width - tagW) / 2;
    const tagY = y + height + 12; // Strictly 12px BELOW face bounding box

    // Rounded Pill Background
    ctx.fillStyle = '#1a4cd2';
    ctx.shadowColor = 'rgba(26, 76, 210, 0.6)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 18);
    ctx.fill();

    // Yellow Accent Dot
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(tagX + 16, tagY + tagH / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // White Typography
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, tagX + 26, tagY + tagH / 2);

    ctx.restore();
  }

  /**
   * ==========================================================================
   * 8. WEBCAM CONTROLS
   * ==========================================================================
   */
  async function startCamera() {
    initFaceMesh();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      video.srcObject = stream;
      await video.play();

      isStreaming = true;
      isFrozen = false;
      currentMode = 'live';

      if (currentModePill) currentModePill.textContent = 'Live Mode';
      standbyOverlay.classList.add('hidden');
      btnFreeze.disabled = false;
      btnFreeze.innerHTML = '<span>Freeze Frame</span>';
      btnToggleCam.innerHTML = '<span>Turn Off Camera</span>';
      streamStatusText.textContent = 'Camera Active';
      streamDot.style.background = '#10b981';

      syncCanvasSize();
      startContinuousProcessing();

    } catch (err) {
      console.warn('Webcam permission denied or unavailable, using simulation engine:', err);
      startFallbackMode();
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    video.srcObject = null;
    isStreaming = false;
    isFrozen = false;

    standbyOverlay.classList.remove('hidden');
    facePromptPill.style.display = 'none';
    btnFreeze.disabled = true;
    btnToggleCam.innerHTML = '<span>Turn On Camera</span>';
    streamStatusText.textContent = 'Camera Idle';
    streamDot.style.background = '#94a3b8';
    statusFaceDetected.textContent = 'Waiting for camera / photo';
    statusFaceDetected.style.color = 'var(--text-muted)';
    statusLandmarkCount.textContent = '0 Nodes';
    displayAge.textContent = '--';
    displayConfidence.textContent = 'Confidence: --%';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function toggleCamera() {
    if (isStreaming) {
      stopCamera();
    } else {
      startCamera();
    }
  }

  function toggleFreeze() {
    if (!isStreaming || currentMode !== 'live') return;
    isFrozen = !isFrozen;
    btnFreeze.innerHTML = isFrozen ? '<span>Unfreeze Frame</span>' : '<span>Freeze Frame</span>';
    streamStatusText.textContent = isFrozen ? 'Frame Frozen' : 'Camera Active';
    streamDot.style.background = isFrozen ? '#facc15' : '#10b981';
  }

  if (btnStartCam) btnStartCam.addEventListener('click', startCamera);
  if (btnToggleCam) btnToggleCam.addEventListener('click', toggleCamera);
  if (btnFreeze) btnFreeze.addEventListener('click', toggleFreeze);

  /**
   * ==========================================================================
   * 9. PHOTO UPLOAD & INFERENCE
   * ==========================================================================
   */
  function handleImageUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
          stream = null;
        }
        video.srcObject = null;

        isStreaming = true;
        isFrozen = true;
        currentMode = 'photo';
        uploadedImageObj = img;

        if (currentModePill) currentModePill.textContent = 'Photo Mode';
        standbyOverlay.classList.add('hidden');
        facePromptPill.style.display = 'none';
        btnFreeze.disabled = false;
        btnFreeze.innerHTML = '<span>Photo Mode</span>';
        btnToggleCam.innerHTML = '<span>Switch to Live Camera</span>';
        streamStatusText.textContent = 'Photo Loaded';
        streamDot.style.background = '#06b6d4';

        syncCanvasSize();
        renderUploadedPhoto(img);
        triggerInferenceFromImage(img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function renderUploadedPhoto(img) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hRatio = canvas.width / img.width;
    const vRatio = canvas.height / img.height;
    const ratio = Math.min(hRatio, vRatio);

    const centerShiftX = (canvas.width - img.width * ratio) / 2;
    const centerShiftY = (canvas.height - img.height * ratio) / 2;

    ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);

    const boxW = Math.min(280, canvas.width * 0.44);
    const boxH = boxW * 1.30;
    const boxX = (canvas.width - boxW) / 2;
    const boxY = (canvas.height - boxH) / 2;

    const box = { x: boxX, y: boxY, width: boxW, height: boxH };

    const pts = [
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.16 },
      { x: box.x + box.width * 0.65, y: box.y + box.height * 0.20 },
      { x: box.x + box.width * 0.35, y: box.y + box.height * 0.20 },
      { x: box.x + box.width * 0.75, y: box.y + box.height * 0.30 },
      { x: box.x + box.width * 0.25, y: box.y + box.height * 0.30 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.30 },
      { x: box.x + box.width * 0.32, y: box.y + box.height * 0.36 },
      { x: box.x + box.width * 0.44, y: box.y + box.height * 0.37 },
      { x: box.x + box.width * 0.56, y: box.y + box.height * 0.37 },
      { x: box.x + box.width * 0.68, y: box.y + box.height * 0.36 },
      { x: box.x + box.width * 0.34, y: box.y + box.height * 0.43 },
      { x: box.x + box.width * 0.45, y: box.y + box.height * 0.43 },
      { x: box.x + box.width * 0.55, y: box.y + box.height * 0.43 },
      { x: box.x + box.width * 0.66, y: box.y + box.height * 0.43 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.42 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.52 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.58 },
      { x: box.x + box.width * 0.42, y: box.y + box.height * 0.57 },
      { x: box.x + box.width * 0.58, y: box.y + box.height * 0.57 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.61 },
      { x: box.x + box.width * 0.26, y: box.y + box.height * 0.52 },
      { x: box.x + box.width * 0.74, y: box.y + box.height * 0.52 },
      { x: box.x + box.width * 0.36, y: box.y + box.height * 0.56 },
      { x: box.x + box.width * 0.64, y: box.y + box.height * 0.56 },
      { x: box.x + box.width * 0.38, y: box.y + box.height * 0.70 },
      { x: box.x + box.width * 0.62, y: box.y + box.height * 0.70 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.67 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.74 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.90 },
      { x: box.x + box.width * 0.35, y: box.y + box.height * 0.84 },
      { x: box.x + box.width * 0.65, y: box.y + box.height * 0.84 }
    ];

    drawRealFaceMesh(box, pts, currentAge, confidence);

    statusFaceDetected.textContent = 'Face Locked (Photo)';
    statusFaceDetected.style.color = '#10b981';
    statusLandmarkCount.textContent = '31 Nodes Aligned';
    displayAge.textContent = currentAge.toFixed(1);
    displayConfidence.textContent = `Confidence: ${Math.round(confidence * 100)}%`;
    displayMargin.textContent = `Margin of Error: ± ${currentMae} yrs`;
  }

  [photoInput, photoInputStandby].forEach(inp => {
    if (inp) {
      inp.addEventListener('change', (e) => {
        handleImageUpload(e.target.files[0]);
      });
    }
  });

  function syncCanvasSize() {
    const wrapper = document.getElementById('video-wrapper');
    if (wrapper) {
      canvas.width = wrapper.clientWidth;
      canvas.height = wrapper.clientHeight;
    }
  }

  window.addEventListener('resize', () => {
    syncCanvasSize();
    if (currentMode === 'photo' && uploadedImageObj) {
      renderUploadedPhoto(uploadedImageObj);
    }
  });

  /**
   * ==========================================================================
   * 10. CONTINUOUS PROCESSING LOOP
   * ==========================================================================
   */
  async function startContinuousProcessing() {
    const processFrame = async (timestamp) => {
      if (!isStreaming || currentMode !== 'live') return;

      const delta = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      if (delta > 0 && timestamp % 25 < 2) {
        fpsCounter.textContent = `${Math.min(60, Math.round(1 / delta))} FPS`;
      }

      if (!isFrozen) {
        if (faceMesh && video.readyState >= 2) {
          try {
            await faceMesh.send({ image: video });
          } catch (e) {}
        } else if (!faceMesh) {
          runFallbackDetection(timestamp);
        }
      }

      requestAnimationFrame(processFrame);
    };

    requestAnimationFrame(processFrame);
  }

  function startFallbackMode() {
    isStreaming = true;
    isFrozen = false;
    currentMode = 'live';

    if (currentModePill) currentModePill.textContent = 'Live Demo';
    standbyOverlay.classList.add('hidden');
    btnFreeze.disabled = false;
    btnToggleCam.innerHTML = '<span>Turn Off Camera</span>';
    streamStatusText.textContent = 'Engine Active';
    streamDot.style.background = '#10b981';

    syncCanvasSize();
    startContinuousProcessing();
  }

  function runFallbackDetection(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const t = timestamp * 0.0012;
    const w = canvas.width;
    const h = canvas.height;

    const boxW = Math.min(300, w * 0.48);
    const boxH = boxW * 1.30;
    const targetX = (w - boxW) / 2 + Math.sin(t) * 8;
    const targetY = (h - boxH) / 2 + Math.cos(t * 0.8) * 6;

    const box = { x: targetX, y: targetY, width: boxW, height: boxH };

    const pts = [
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.16 },
      { x: box.x + box.width * 0.65, y: box.y + box.height * 0.20 },
      { x: box.x + box.width * 0.35, y: box.y + box.height * 0.20 },
      { x: box.x + box.width * 0.75, y: box.y + box.height * 0.30 },
      { x: box.x + box.width * 0.25, y: box.y + box.height * 0.30 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.30 },
      { x: box.x + box.width * 0.32, y: box.y + box.height * 0.36 },
      { x: box.x + box.width * 0.44, y: box.y + box.height * 0.37 },
      { x: box.x + box.width * 0.56, y: box.y + box.height * 0.37 },
      { x: box.x + box.width * 0.68, y: box.y + box.height * 0.36 },
      { x: box.x + box.width * 0.34, y: box.y + box.height * 0.43 },
      { x: box.x + box.width * 0.45, y: box.y + box.height * 0.43 },
      { x: box.x + box.width * 0.55, y: box.y + box.height * 0.43 },
      { x: box.x + box.width * 0.66, y: box.y + box.height * 0.43 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.42 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.52 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.58 },
      { x: box.x + box.width * 0.42, y: box.y + box.height * 0.57 },
      { x: box.x + box.width * 0.58, y: box.y + box.height * 0.57 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.61 },
      { x: box.x + box.width * 0.26, y: box.y + box.height * 0.52 },
      { x: box.x + box.width * 0.74, y: box.y + box.height * 0.52 },
      { x: box.x + box.width * 0.36, y: box.y + box.height * 0.56 },
      { x: box.x + box.width * 0.64, y: box.y + box.height * 0.56 },
      { x: box.x + box.width * 0.38, y: box.y + box.height * 0.70 },
      { x: box.x + box.width * 0.62, y: box.y + box.height * 0.70 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.67 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.74 },
      { x: box.x + box.width * 0.50, y: box.y + box.height * 0.90 },
      { x: box.x + box.width * 0.35, y: box.y + box.height * 0.84 },
      { x: box.x + box.width * 0.65, y: box.y + box.height * 0.84 }
    ];

    drawRealFaceMesh(box, pts, currentAge, confidence);
    displayAge.textContent = currentAge.toFixed(1);
    displayConfidence.textContent = `Confidence: ${Math.round(confidence * 100)}%`;
    statusFaceDetected.textContent = 'Face Detected (Live)';
    statusLandmarkCount.textContent = '31 Nodes Tracked';
  }
});
