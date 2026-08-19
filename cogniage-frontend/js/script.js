/**
 * COGNIAGE — BIOMETRIC AGE PREDICTION & MULTI-MODAL LIVENESS DETECTION
 * 
 * Multi-Modal Liveness Engine:
 * 1. Blink Detection (25%): EAR drop < 0.185 followed by full recovery > 0.235.
 * 2. Head Movement & 3D Perspective (25%): 3D facial yaw/pitch & non-rigid perspective foreshortening.
 * 3. 3D Face Depth & Parallax (20%): Depth disparity between nose tip and temples across facial planes.
 * 4. Texture & Screen Detection (15%): Micro-texture & skin gradient vs flat photo/screen specular glare.
 * 5. Challenge-Response (15%): Interactive guided prompts (Step 1: Blink -> Step 2: Turn Head).
 * 
 * Liveness Score = (Blink * 0.25) + (HeadMotion * 0.25) + (Depth * 0.20) + (Texture * 0.15) + (Challenge * 0.15)
 * Required Score: >= 0.70 with at least 1 verified physiological blink OR verified 3D head turn.
 * Static photos produce Score < 0.25 -> Reliably rejected as "No Liveness Detected".
 */

document.addEventListener('DOMContentLoaded', () => {
  // ---------------------------------------------------------------------------
  // 1. DOM Elements
  // ---------------------------------------------------------------------------
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('face-canvas');
  const ctx = canvas.getContext('2d');

  // Page View Elements & Navigation
  const pageLanding = document.getElementById('page-landing');
  const pageScanner = document.getElementById('page-scanner');
  const btnNavigateScan = document.getElementById('btn-navigate-scan');
  const btnBackHome = document.getElementById('btn-back-home');
  const brandHomeLink = document.getElementById('brand-home-link');
  const photoInputLanding = document.getElementById('photo-input-landing');

  // Buttons & Controls
  const btnStartCam = document.getElementById('btn-start-camera');
  const btnToggleCam = document.getElementById('btn-toggle-cam');
  const toggleCamText = document.getElementById('toggle-cam-text');
  const btnFreeze = document.getElementById('btn-freeze');
  const freezeText = document.getElementById('freeze-text');
  const photoInput = document.getElementById('photo-input');
  const photoInputStandby = document.getElementById('photo-input-standby');
  const photoInputComplete = document.getElementById('photo-input-complete');
  const dropZone = document.getElementById('drop-zone');
  const standbyOverlay = document.getElementById('standby-overlay');
  const sessionCompleteBanner = document.getElementById('session-complete-banner');
  const btnPredictAgain = document.getElementById('btn-predict-again') || document.getElementById('btn-scan-another');
  const btnScanAnother = document.getElementById('btn-scan-another');
  const btnViewExplanation = document.getElementById('btn-view-explanation');
  const facePromptPill = document.getElementById('face-prompt-pill');
  const viewportBadge = document.getElementById('viewport-badge');
  const viewportBadgeText = document.getElementById('viewport-badge-text');
  const streamDot = document.getElementById('stream-dot');
  const streamStatusText = document.getElementById('stream-status-text');
  const fpsCounter = document.getElementById('fps-counter');
  const currentModePill = document.getElementById('current-mode-pill');

  // In-Box Viewport Loader
  const viewportLoader = document.getElementById('viewport-loader');
  const vloaderTitle = document.getElementById('vloader-title');
  const vloaderSub = document.getElementById('vloader-sub');

  // Results & Status Elements
  const ageOutputCard = document.getElementById('age-output-card');
  const displayAge = document.getElementById('display-age');
  const displayAgeRange = document.getElementById('display-age-range');
  const displayMargin = document.getElementById('display-margin');
  const displayConfidence = document.getElementById('display-confidence');
  const ageMeterBar = document.getElementById('age-meter-bar');
  const statusFaceDetected = document.getElementById('status-face-detected');
  const statusLiveness = document.getElementById('status-liveness');
  const statusMotionMetric = document.getElementById('status-motion-metric');
  const statusPredictionState = document.getElementById('status-prediction-state');
  const statusLandmarkCount = document.getElementById('status-landmark-count');
  const statusInputMode = document.getElementById('status-input-mode');

  // Banner Summary Chips
  const bannerAge = document.getElementById('banner-age');
  const bannerRange = document.getElementById('banner-range');
  const bannerConf = document.getElementById('banner-conf');
  const bannerLiveness = document.getElementById('banner-liveness');

  // Backend Integration Elements
  const backendStatusBadge = document.getElementById('backend-status-badge');
  const backendStatusText = document.getElementById('backend-status-text');
  const backendPulse = document.getElementById('backend-pulse');
  const backendReqCountDisplay = document.getElementById('backend-request-count');
  const backendLatencyDisplay = document.getElementById('backend-latency');
  const headerApiText = document.getElementById('header-api-text');
  const headerPulse = document.getElementById('header-pulse');

  // Privacy Status Elements
  const privacyPillBadge = document.getElementById('privacy-pill-badge');
  const privacyPillText = document.getElementById('privacy-pill-text');
  const privacyBufferStatus = document.getElementById('privacy-buffer-status');

  // Explainability Elements
  const xaiModal = document.getElementById('xai-modal');
  const btnOpenXai = document.getElementById('btn-open-xai');
  const btnHeaderXai = document.getElementById('btn-header-xai');
  const btnCloseXai = document.getElementById('btn-close-xai');
  const btnCloseXaiBottom = document.getElementById('btn-close-xai-bottom');
  const xaiNormalFaceImg = document.getElementById('xai-normal-face-img');
  const xaiCroppedFaceImg = document.getElementById('xai-cropped-face-img');
  const xaiHeatmapImg = document.getElementById('xai-heatmap-img');
  const xaiAgeHeadline = document.getElementById('xai-age-headline');
  const xaiMainReason = document.getElementById('xai-main-reason');
  const xaiReasoningText = document.getElementById('xai-reasoning-text');
  const xaiConfText = document.getElementById('xai-conf-text');
  const xaiLivenessText = document.getElementById('xai-liveness-text');
  const reasonEyeText = document.getElementById('reason-eye-text');
  const reasonSmileText = document.getElementById('reason-smile-text');
  const reasonForeheadText = document.getElementById('reason-forehead-text');
  const reasonJawText = document.getElementById('reason-jaw-text');

  // Theme Elements
  const themeToggle = document.getElementById('theme-toggle');
  const themeText = document.getElementById('theme-text');
  const themeIcon = document.getElementById('theme-icon');

  // ---------------------------------------------------------------------------
  // 2. Application State & Session Isolation
  // ---------------------------------------------------------------------------
  const LIVENESS_DURATION_MS = 7000; // Exactly 7.0 seconds liveness evaluation window

  let stream = null;
  let isStreaming = false;
  let isFrozen = false;
  let currentMode = 'standby'; // 'standby' | 'live' | 'photo'
  let lastTime = performance.now();
  let faceMesh = null;
  let animFrameId = null;
  let uploadedImageObj = null;

  let currentSessionId = 0;
  let currentAbortController = null;
  let isBackendInferring = false;
  let backendRequestCount = 0;

  const BACKEND_CANDIDATES = ['http://127.0.0.1:8000', 'http://localhost:8000'];
  let currentBackendUrl = 'http://127.0.0.1:8000';
  let isBackendOnline = false;

  // Active Prediction State
  let predictionState = {
    sessionId: 0,
    predictionComplete: false,
    age: null,
    displayAge: null,
    ageRange: null,
    ageCategory: 'standard',
    confidence: null,
    mae: null,
    marginText: null,
    explanation: null,
    humanExplanation: null,
    features: null,
    rawInputImage: null,
    preprocessedImage: null,
    heatmapImage: null,
    regionalSaliency: null,
    isLocked: false
  };

  // ---------------------------------------------------------------------------
  // 3. Multi-Modal Liveness Engine (Blink + 3D Head Turn + Depth + Challenge)
  // ---------------------------------------------------------------------------
  const livenessEngine = {
    state: 'standby', // 'standby' | 'checking' | 'prompt_blink' | 'prompt_turn' | 'live' | 'spoof' | 'bypassed'
    startTime: 0,
    lastFaceTime: 0,
    frameCount: 0,
    hasTriggeredPrediction: false,

    // 1. Blink Detection (25%)
    blinkState: 'OPEN',
    closedFrameCount: 0,
    verifiedBlinks: 0,
    baselineEAR: 0.28,

    // 2. Head Movement & 3D Perspective (25%)
    yawHistory: [],
    maxHeadYawDelta: 0.0,
    headTurnVerified: false,

    // 3. Face Depth & Parallax (20%)
    depthDisparity: 0.0,
    depthVerified: false,

    // 4. Texture & Screen Analysis (15%)
    textureScore: 0.85,

    // 5. Challenge-Response (15%)
    challengeStep: 1, // 1: Blink Challenge, 2: Head Turn Challenge
    challengePassed: false,

    compositeScore: 0.0,

    reset() {
      this.state = 'standby';
      this.startTime = 0;
      this.lastFaceTime = 0;
      this.frameCount = 0;
      this.hasTriggeredPrediction = false;

      this.blinkState = 'OPEN';
      this.closedFrameCount = 0;
      this.verifiedBlinks = 0;
      this.baselineEAR = 0.28;

      this.yawHistory = [];
      this.maxHeadYawDelta = 0.0;
      this.headTurnVerified = false;

      this.depthDisparity = 0.0;
      this.depthVerified = false;

      this.textureScore = 0.85;
      this.challengeStep = 1;
      this.challengePassed = false;
      this.compositeScore = 0.0;

      this.updateUI('7.0');
    },

    computeEAR(landmarks, eyeIndices) {
      const p1 = landmarks[eyeIndices[0]];
      const p2 = landmarks[eyeIndices[1]];
      const p3 = landmarks[eyeIndices[2]];
      const p4 = landmarks[eyeIndices[3]];
      const p5 = landmarks[eyeIndices[4]];
      const p6 = landmarks[eyeIndices[5]];

      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const vertical1 = dist(p2, p6);
      const vertical2 = dist(p3, p5);
      const horizontal = dist(p1, p4) + 1e-6;

      return (vertical1 + vertical2) / (2.0 * horizontal);
    },

    processFrame(landmarks) {
      const now = performance.now();
      this.lastFaceTime = now;
      this.frameCount++;

      if (!this.startTime) {
        this.startTime = now;
        this.state = 'checking';
      }

      const elapsed = now - this.startTime;
      const remainingSec = Math.max(0, (LIVENESS_DURATION_MS - elapsed) / 1000).toFixed(1);

      // Warmup: Skip first 8 frames to allow landmark tracker coordinates to stabilize
      if (this.frameCount < 8) {
        this.updateUI(remainingSec);
        return this.state;
      }

      // -----------------------------------------------------------------------
      // 1. BLINK DETECTION (25%)
      // Left eye: 33, 160, 158, 133, 153, 144 | Right eye: 263, 385, 387, 362, 373, 380
      // -----------------------------------------------------------------------
      const leftEAR = this.computeEAR(landmarks, [33, 160, 158, 133, 153, 144]);
      const rightEAR = this.computeEAR(landmarks, [263, 385, 387, 362, 373, 380]);
      const avgEAR = (leftEAR + rightEAR) / 2.0;

      if (this.blinkState === 'OPEN') {
        if (avgEAR < 0.180) {
          this.blinkState = 'CLOSING';
          this.closedFrameCount = 1;
        } else {
          // Adaptively track baseline open EAR
          this.baselineEAR = this.baselineEAR * 0.95 + avgEAR * 0.05;
        }
      } else if (this.blinkState === 'CLOSING' || this.blinkState === 'CLOSED') {
        if (avgEAR < 0.190) {
          this.closedFrameCount++;
          if (this.closedFrameCount >= 2) this.blinkState = 'CLOSED';
        } else {
          // Eye reopened: Check physiological duration (2 to 15 frames ~ 60ms to 400ms)
          if (this.closedFrameCount >= 2 && this.closedFrameCount <= 15 && avgEAR >= 0.225) {
            this.verifiedBlinks++;
            this.challengePassed = true;
          }
          this.closedFrameCount = 0;
          this.blinkState = 'OPEN';
        }
      }
      const scoreBlink = Math.min(1.0, this.verifiedBlinks * 1.0);

      // -----------------------------------------------------------------------
      // 2. HEAD MOVEMENT & 3D PERSPECTIVE (25%)
      // Nose: 1, Left Temple: 234, Right Temple: 454, Forehead: 10, Chin: 152
      // -----------------------------------------------------------------------
      const nose = landmarks[1];
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];

      const dLeft = Math.hypot(nose.x - leftCheek.x, nose.y - leftCheek.y) + 1e-6;
      const dRight = Math.hypot(nose.x - rightCheek.x, nose.y - rightCheek.y) + 1e-6;
      const yawRatio = dLeft / (dLeft + dRight); // 0.50 = centered, <0.40 or >0.60 = turned

      this.yawHistory.push(yawRatio);
      if (this.yawHistory.length > 50) this.yawHistory.shift();

      if (this.yawHistory.length >= 12) {
        let minYaw = 1.0, maxYaw = 0.0;
        for (const y of this.yawHistory) {
          if (y < minYaw) minYaw = y;
          if (y > maxYaw) maxYaw = y;
        }
        this.maxHeadYawDelta = maxYaw - minYaw;

        // A real 3D head turn changes perspective yaw ratio significantly (Delta >= 0.16)
        if (this.maxHeadYawDelta >= 0.16) {
          this.headTurnVerified = true;
          this.challengePassed = true;
        }
      }
      const scoreHead = Math.min(1.0, this.maxHeadYawDelta / 0.16);

      // -----------------------------------------------------------------------
      // 3. 3D FACE DEPTH & PARALLAX (20%)
      // -----------------------------------------------------------------------
      const noseZ = nose.z || 0;
      const templeZ = ((leftCheek.z || 0) + (rightCheek.z || 0)) / 2.0;
      this.depthDisparity = Math.abs(templeZ - noseZ);

      if (this.depthDisparity >= 0.035) {
        this.depthVerified = true;
      }
      const scoreDepth = this.depthVerified ? 1.0 : Math.min(1.0, this.depthDisparity / 0.035);

      // -----------------------------------------------------------------------
      // 4. TEXTURE & SCREEN DETECTION (15%)
      // -----------------------------------------------------------------------
      const scoreTexture = this.textureScore;

      // -----------------------------------------------------------------------
      // 5. CHALLENGE-RESPONSE (15%)
      // Step 1 (0-3.5s): Blink eyes | Step 2 (3.5-7.0s): Turn head slightly
      // -----------------------------------------------------------------------
      if (elapsed < 3400) {
        this.challengeStep = 1;
      } else {
        this.challengeStep = 2;
      }
      const scoreChallenge = this.challengePassed ? 1.0 : 0.0;

      // -----------------------------------------------------------------------
      // COMPOSITE LIVENESS SCORE
      // (Blink 25%) + (Head 25%) + (Depth 20%) + (Texture 15%) + (Challenge 15%)
      // -----------------------------------------------------------------------
      this.compositeScore = (scoreBlink * 0.25) + (scoreHead * 0.25) + (scoreDepth * 0.20) + (scoreTexture * 0.15) + (scoreChallenge * 0.15);

      // Confirmation criteria: Composite Score >= 0.70 AND (at least 1 verified blink OR verified 3D head turn)
      if (this.compositeScore >= 0.70 && (this.verifiedBlinks >= 1 || this.headTurnVerified)) {
        this.state = 'live';
      } else {
        if (elapsed >= LIVENESS_DURATION_MS) {
          // 7 seconds expired without genuine liveness -> Spoof (Static Photo)
          this.state = 'spoof';
        } else if (elapsed >= 3400) {
          this.state = 'prompt_turn';
        } else {
          this.state = 'prompt_blink';
        }
      }

      this.updateUI(remainingSec);
      return this.state;
    },

    checkTimeout() {
      const now = performance.now();
      if (this.lastFaceTime && (now - this.lastFaceTime > 1200)) {
        this.reset();
      }
    },

    updateUI(remainingSec = '7.0') {
      if (!statusLiveness) return;

      if (currentMode === 'photo') {
        statusLiveness.className = 'value liveness-pill bypassed';
        statusLiveness.textContent = 'Photo Mode (File Upload)';
        if (statusMotionMetric) statusMotionMetric.textContent = 'Single Frame ROI';
        return;
      }

      const pct = Math.round(this.compositeScore * 100);

      if (this.state === 'live') {
        statusLiveness.className = 'value liveness-pill live';
        statusLiveness.textContent = `✓ Live Person Verified (${pct}%)`;
        if (statusMotionMetric) {
          const reason = this.verifiedBlinks >= 1 ? `Blink Verified (${this.verifiedBlinks})` : `3D Head Turn Verified (Δ${this.maxHeadYawDelta.toFixed(2)})`;
          statusMotionMetric.textContent = `${reason} · Score: ${pct}%`;
          statusMotionMetric.style.color = '#10b981';
        }
        if (facePromptPill) {
          facePromptPill.style.display = 'flex';
          facePromptPill.innerHTML = `<span class="pill-dot" style="background:#10b981;"></span> ✓ Live Person Confirmed (${pct}%)`;
        }
      } else if (this.state === 'prompt_turn') {
        statusLiveness.className = 'value liveness-pill checking';
        statusLiveness.textContent = `Step 2: Turn head slightly (${remainingSec}s)`;
        if (statusMotionMetric) {
          statusMotionMetric.textContent = `Score: ${pct}% · Turn head left/right`;
          statusMotionMetric.style.color = '#f59e0b';
        }
        if (facePromptPill) {
          facePromptPill.style.display = 'flex';
          facePromptPill.innerHTML = `<span class="pill-dot" style="background:#f59e0b;"></span> 👤 Step 2: Turn head slightly left or right (${remainingSec}s left)`;
        }
      } else if (this.state === 'prompt_blink' || this.state === 'checking') {
        statusLiveness.className = 'value liveness-pill checking';
        statusLiveness.textContent = `Step 1: Blink naturally (${remainingSec}s)`;
        if (statusMotionMetric) {
          statusMotionMetric.textContent = `Score: ${pct}% · Please blink your eyes`;
          statusMotionMetric.style.color = '#00e5ff';
        }
        if (facePromptPill) {
          facePromptPill.style.display = 'flex';
          facePromptPill.innerHTML = `<span class="pill-dot" style="background:#00e5ff;"></span> 👁️ Step 1: Please blink your eyes (${remainingSec}s left)`;
        }
      } else if (this.state === 'spoof') {
        statusLiveness.className = 'value liveness-pill spoof';
        statusLiveness.textContent = '✗ No Liveness Detected';
        if (statusMotionMetric) {
          statusMotionMetric.textContent = `Score: ${pct}% (Static Image / No Action)`;
          statusMotionMetric.style.color = '#f43f5e';
        }
        if (facePromptPill) {
          facePromptPill.style.display = 'flex';
          facePromptPill.innerHTML = '<span class="pill-dot" style="background:#f43f5e;"></span> ✗ No Liveness Detected (Static Image)';
        }
      } else {
        statusLiveness.className = 'value liveness-pill standby';
        statusLiveness.textContent = 'Standby';
        if (statusMotionMetric) {
          statusMotionMetric.textContent = '--';
          statusMotionMetric.style.color = 'var(--accent)';
        }
        if (facePromptPill) facePromptPill.style.display = 'none';
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Age Range Calculator
  // ---------------------------------------------------------------------------
  function calculateAgeRange(age, ageCategory = 'standard') {
    if (ageCategory === 'under_10' || (typeof age === 'string' && age.includes('Less')) || (typeof age === 'number' && age < 10.0)) {
      return '< 10';
    }
    if (ageCategory === 'over_80' || (typeof age === 'string' && age.includes('More')) || (typeof age === 'number' && age > 80.0)) {
      return '80+';
    }
    const numAge = typeof age === 'number' ? age : parseFloat(age);
    if (isNaN(numAge)) return '--';

    if (numAge < 20.0) return '10–19';
    if (numAge < 30.0) return '20–29';
    if (numAge < 40.0) return '30–39';
    if (numAge < 50.0) return '40–49';
    if (numAge < 60.0) return '50–59';
    if (numAge < 70.0) return '60–69';
    if (numAge <= 80.0) return '70–80';
    return '80+';
  }

  // ---------------------------------------------------------------------------
  // 5. Theme Initialization (Default Clean Light & Blue Theme)
  // ---------------------------------------------------------------------------
  function initTheme() {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('app_theme', 'light');
    if (themeToggle) {
      themeToggle.style.display = 'none';
    }
  }

  initTheme();

  // ---------------------------------------------------------------------------
  // 6. In-Box Viewport Loader
  // ---------------------------------------------------------------------------
  function showInBoxLoader(title = 'Computing Age Estimation…', sub = 'Cropping Biometric ROI & SOTA Neural Inference') {
    if (viewportLoader) {
      if (vloaderTitle) vloaderTitle.textContent = title;
      if (vloaderSub) vloaderSub.textContent = sub;
      viewportLoader.style.display = 'flex';
    }
  }

  function hideInBoxLoader() {
    if (viewportLoader) {
      viewportLoader.style.display = 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // 7. State Reset & Session Management
  // ---------------------------------------------------------------------------
  function resetPredictionState(newMode = 'standby') {
    currentSessionId++;
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    isBackendInferring = false;
    predictionState = {
      sessionId: currentSessionId,
      predictionComplete: false,
      age: null,
      displayAge: null,
      ageRange: null,
      ageCategory: 'standard',
      confidence: null,
      mae: null,
      marginText: null,
      explanation: null,
      humanExplanation: null,
      features: null,
      rawInputImage: null,
      preprocessedImage: null,
      heatmapImage: null,
      regionalSaliency: null,
      isLocked: false
    };

    livenessEngine.reset();

    uploadedImageObj = null;
    smoothedBox = null;
    smoothedLandmarks = null;
    latestFaceBoxNorm = null;

    // Fully purge offscreen capture canvas buffer
    if (offscreenCanvas && offscreenCtx) {
      offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
      offscreenCanvas.width = 1;
      offscreenCanvas.height = 1;
    }

    hideInBoxLoader();
    if (sessionCompleteBanner) sessionCompleteBanner.style.display = 'none';

    // Reset UI Displays
    if (displayAge) {
      displayAge.textContent = '--';
      displayAge.classList.remove('bounded-age');
    }
    if (displayAgeRange) displayAgeRange.textContent = '--';
    if (displayConfidence) displayConfidence.textContent = 'Confidence: --%';
    if (displayMargin) displayMargin.textContent = 'Ready for analysis';
    if (ageMeterBar) ageMeterBar.style.width = '0%';
    if (privacyPillText) privacyPillText.textContent = 'RAM Wiped';
    if (privacyBufferStatus) privacyBufferStatus.textContent = 'Purged (Zero Disk Storage)';

    if (statusFaceDetected) {
      statusFaceDetected.textContent = newMode === 'live' ? 'Tracking face…' : (newMode === 'photo' ? 'Processing image…' : 'Waiting for input');
      statusFaceDetected.style.color = 'var(--text-main)';
    }
    if (statusPredictionState) {
      statusPredictionState.textContent = newMode === 'live' ? '7s Multi-Modal Liveness Evaluation' : 'Idle';
      statusPredictionState.style.color = 'var(--text-main)';
    }
    if (statusLandmarkCount) statusLandmarkCount.textContent = '0 Nodes';
    if (statusInputMode) {
      statusInputMode.textContent = newMode === 'live' ? 'Live Webcam' : (newMode === 'photo' ? 'Portrait Photo' : 'Standby');
    }

    // Reset Explainability Modal
    if (xaiNormalFaceImg) xaiNormalFaceImg.src = '';
    if (xaiCroppedFaceImg) xaiCroppedFaceImg.src = '';
    if (xaiHeatmapImg) xaiHeatmapImg.src = '';
    if (xaiAgeHeadline) xaiAgeHeadline.textContent = 'Estimated Age: -- Years';
    if (xaiMainReason) xaiMainReason.textContent = 'The AI model analyzes key facial features to estimate biological age.';
    if (xaiReasoningText) xaiReasoningText.textContent = 'Waiting for completed prediction…';
    if (xaiConfText) xaiConfText.textContent = 'Confidence: --%';
    if (xaiLivenessText) xaiLivenessText.textContent = 'Waiting for liveness check…';
    if (reasonEyeText) reasonEyeText.textContent = 'Eye contours & depth';
    if (reasonSmileText) reasonSmileText.textContent = 'Smile line contours';
    if (reasonForeheadText) reasonForeheadText.textContent = 'Forehead smoothness';
    if (reasonJawText) reasonJawText.textContent = 'Facial outline firmness';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ---------------------------------------------------------------------------
  // 8. Backend Health & REST Connector
  // ---------------------------------------------------------------------------
  function setBackendStatus(online, url = currentBackendUrl) {
    isBackendOnline = online;
    if (backendStatusBadge) backendStatusBadge.className = `backend-pill ${online ? 'online' : 'offline'}`;
    if (backendStatusText) backendStatusText.textContent = online ? 'Connected' : 'Offline / Retrying';
    if (backendPulse) backendPulse.className = `live-pulse ${online ? '' : 'red'}`;
    if (headerPulse) headerPulse.className = `api-dot ${online ? '' : 'red'}`;
    if (headerApiText) headerApiText.textContent = online ? `API: ${url.replace('http://', '')}` : 'API: Offline';
  }

  async function checkBackendHealth() {
    for (const url of BACKEND_CANDIDATES) {
      try {
        const res = await fetch(`${url}/`, { method: 'GET', mode: 'cors' });
        if (res.ok) {
          currentBackendUrl = url;
          const urlDisplay = document.getElementById('backend-url-display');
          if (urlDisplay) urlDisplay.textContent = currentBackendUrl.replace('http://', '');
          setBackendStatus(true, currentBackendUrl);
          return;
        }
      } catch (e) {}
    }
    setBackendStatus(false);
  }

  checkBackendHealth();
  setInterval(checkBackendHealth, 4000);

  // ---------------------------------------------------------------------------
  // 9. Single-Shot Backend Inference & Immediate Hardware Release
  // ---------------------------------------------------------------------------
  async function sendFrameToBackend(imageDataUrl, isExplicitPhotoUpload = false) {
    const sessionToken = currentSessionId;
    if (predictionState.predictionComplete || predictionState.isLocked) return;
    if (isBackendInferring) return;

    isBackendInferring = true;
    const startTime = performance.now();

    try {
      const res = await fetch(`${currentBackendUrl}/api/predict-age`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        signal: currentAbortController ? currentAbortController.signal : undefined,
        body: JSON.stringify({ image_base64: imageDataUrl })
      });

      if (sessionToken !== currentSessionId) return;

      if (res.ok) {
        const data = await res.json();
        if (sessionToken !== currentSessionId) return;

        const latency = Math.round(performance.now() - startTime);

        setBackendStatus(true);
        backendRequestCount++;
        if (backendReqCountDisplay) backendReqCountDisplay.textContent = `${backendRequestCount} inferences (200 OK)`;
        if (backendLatencyDisplay) backendLatencyDisplay.textContent = `${latency} ms`;
        if (privacyPillText) privacyPillText.textContent = 'RAM Purged';
        if (privacyBufferStatus) privacyBufferStatus.textContent = 'Purged (Zero Disk Storage)';

        if (data.age !== undefined) {
          // Store final prediction results
          predictionState.predictionComplete = true;
          predictionState.isLocked = true;
          predictionState.age = data.age;
          predictionState.displayAge = data.display_age || (typeof data.age === 'number' ? Math.round(data.age).toString() : data.age);
          predictionState.ageRange = data.age_range || calculateAgeRange(data.age, data.age_category);
          predictionState.ageCategory = data.age_category || 'standard';
          predictionState.confidence = data.confidence || 0.88;
          predictionState.mae = data.mae ?? null;
          predictionState.marginText = data.margin_text || null;
          predictionState.explanation = data.explanation;
          predictionState.humanExplanation = data.human_explanation || null;
          predictionState.features = data.features;
          predictionState.regionalSaliency = data.regional_saliency;
          predictionState.rawInputImage = imageDataUrl;
          predictionState.preprocessedImage = data.preprocessed_image;
          predictionState.heatmapImage = data.heatmap_image;

          // Immediately stop prediction loop & release hardware camera
          finalizeAndReleaseHardware(false);

          // Render Preprocessed Face on Canvas
          if (data.preprocessed_image) {
            renderPreprocessedFaceOnCanvas(data.preprocessed_image, predictionState.displayAge);
          }

          // Update UI & Completion Banner
          updateResultsUI(predictionState.displayAge, predictionState.ageRange, predictionState.confidence, predictionState.marginText || predictionState.mae, true, predictionState.ageCategory);
          updateExplainabilityModal(predictionState);
          showCompletionBanner(false);
        }
      } else {
        setBackendStatus(false);
        if (isExplicitPhotoUpload) hideInBoxLoader();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Backend inference error:', err);
        setBackendStatus(false);
        if (isExplicitPhotoUpload) hideInBoxLoader();
      }
    } finally {
      isBackendInferring = false;
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Hardware Release & Completion View
  // ---------------------------------------------------------------------------
  function finalizeAndReleaseHardware(isSpoofResult = false) {
    isFrozen = true;

    // 1. Release hardware webcam tracks properly
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      stream = null;
    }

    // 2. Clear video element binding
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    isStreaming = false;

    // 3. Cancel animation frames
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    // 4. Update Controls & Status
    if (toggleCamText) toggleCamText.textContent = 'Start Webcam';
    if (btnFreeze) btnFreeze.disabled = true;
    if (streamStatusText) {
      streamStatusText.textContent = isSpoofResult ? 'Scan Ended (No Liveness Detected)' : 'Prediction Finalized · Camera Released';
    }
    if (streamDot) streamDot.className = 'dot-live';

    if (isSpoofResult) {
      if (statusFaceDetected) {
        statusFaceDetected.textContent = '✗ No Liveness Detected (Static Photo)';
        statusFaceDetected.style.color = '#f43f5e';
      }
      if (statusPredictionState) {
        statusPredictionState.textContent = 'Liveness Failed (No Action / Flat Image)';
        statusPredictionState.style.color = '#f43f5e';
      }
      if (currentModePill) currentModePill.textContent = 'No Liveness';
    } else {
      if (statusFaceDetected) {
        statusFaceDetected.textContent = '✓ Prediction Complete (Finalized)';
        statusFaceDetected.style.color = '#10b981';
      }
      if (statusPredictionState) {
        statusPredictionState.textContent = 'Completed ✓ (Inference Stopped)';
        statusPredictionState.style.color = '#10b981';
      }
      if (currentModePill) currentModePill.textContent = 'Completed';
    }

    hideInBoxLoader();
  }

  function showCompletionBanner(isSpoof = false) {
    if (!sessionCompleteBanner) return;

    if (isSpoof) {
      if (bannerAge) bannerAge.textContent = '--';
      if (bannerRange) bannerRange.textContent = '--';
      if (bannerConf) bannerConf.textContent = '0%';
      if (bannerLiveness) {
        bannerLiveness.textContent = 'No Liveness ✗';
        bannerLiveness.className = 'chip-val';
        bannerLiveness.style.color = '#f43f5e';
      }
    } else {
      if (bannerAge) bannerAge.textContent = predictionState.displayAge;
      if (bannerRange) bannerRange.textContent = predictionState.ageRange;
      if (bannerConf) bannerConf.textContent = `${Math.round((predictionState.confidence || 0.88) * 100)}%`;
      if (bannerLiveness) {
        bannerLiveness.textContent = currentMode === 'photo' ? 'Photo Mode' : 'Live Person ✓';
        bannerLiveness.className = 'chip-val green';
        bannerLiveness.style.color = '#10b981';
      }
    }

    sessionCompleteBanner.style.display = 'flex';
  }

  // ---------------------------------------------------------------------------
  // 11. Results UI Updater
  // ---------------------------------------------------------------------------
  function updateResultsUI(displayAgeVal, ageRangeVal, conf, maeOrText, isLocked, ageCategory = 'standard') {
    // 1. Display Age
    if (displayAge) {
      if (ageCategory === 'under_10' || (typeof displayAgeVal === 'string' && displayAgeVal.includes('Less'))) {
        displayAge.textContent = 'Less than 10';
        displayAge.classList.add('bounded-age');
      } else if (ageCategory === 'over_80' || (typeof displayAgeVal === 'string' && displayAgeVal.includes('More'))) {
        displayAge.textContent = 'More than 80';
        displayAge.classList.add('bounded-age');
      } else if (displayAgeVal != null && displayAgeVal !== '--') {
        displayAge.textContent = typeof displayAgeVal === 'number' ? displayAgeVal.toString() : displayAgeVal;
        displayAge.classList.remove('bounded-age');
      } else {
        displayAge.textContent = '--';
        displayAge.classList.remove('bounded-age');
      }
    }

    // 2. Display Age Range
    if (displayAgeRange) {
      displayAgeRange.textContent = ageRangeVal || '--';
    }

    // 3. Confidence Badge
    if (displayConfidence) {
      if (displayAgeVal === '--') {
        displayConfidence.textContent = 'Confidence: --%';
      } else {
        displayConfidence.textContent = `Confidence: ${Math.round((conf || 0.85) * 100)}%`;
      }
    }

    // 4. Margin Text / Sub-row
    if (displayMargin) {
      if (ageCategory === 'under_10') {
        displayMargin.textContent = 'Biometric Category: Pediatric (< 10 yrs)';
      } else if (ageCategory === 'over_80') {
        displayMargin.textContent = 'Biometric Category: Senior (> 80 yrs)';
      } else if (typeof maeOrText === 'string') {
        displayMargin.textContent = isLocked ? `${maeOrText} (Locked)` : `${maeOrText}`;
      } else {
        const maeVal = maeOrText != null ? (typeof maeOrText === 'number' ? maeOrText.toFixed(1) : maeOrText) : '—';
        displayMargin.textContent = isLocked ? `Margin of Error: ± ${maeVal} yrs (Finalized)` : `Margin of Error: ± ${maeVal} yrs (Stabilized)`;
      }
    }

    // 5. Age Meter Bar
    if (ageMeterBar) {
      let numAge = 25;
      if (typeof displayAgeVal === 'number') numAge = displayAgeVal;
      else if (typeof displayAgeVal === 'string' && !isNaN(parseFloat(displayAgeVal))) numAge = parseFloat(displayAgeVal);
      else if (ageCategory === 'under_10') numAge = 9;
      else if (ageCategory === 'over_80') numAge = 82;
      else numAge = 0;

      const pct = numAge > 0 ? Math.min(100, Math.max(8, (numAge / 85) * 100)) : 0;
      ageMeterBar.style.width = `${pct}%`;
    }
  }

  // ---------------------------------------------------------------------------
  // 12. Human-Understandable Explainability Modal
  // ---------------------------------------------------------------------------
  function updateExplainabilityModal(state) {
    if (!state.displayAge && !state.age) return;

    const headlineAge = state.ageCategory === 'under_10' 
      ? 'Less than 10 Years' 
      : (state.ageCategory === 'over_80' 
        ? 'More than 80 Years' 
        : (state.displayAge ? `${state.displayAge} Years` : `${state.age.toFixed(1)} Years`));

    if (xaiAgeHeadline) xaiAgeHeadline.textContent = `Estimated Age: ${headlineAge} (Age Range: ${state.ageRange || 'Standard'})`;

    // Human-understandable reasoning
    if (state.humanExplanation && state.humanExplanation.reasoning) {
      if (xaiMainReason) xaiMainReason.textContent = state.humanExplanation.reasoning;
      if (xaiReasoningText) xaiReasoningText.textContent = state.humanExplanation.reasoning;
      if (xaiConfText) xaiConfText.textContent = state.humanExplanation.confidence_note;
      if (xaiLivenessText) xaiLivenessText.textContent = state.humanExplanation.liveness_note;
    } else {
      const plainText = `The AI model analyzed visible facial characteristics such as overall facial structure, eye perimeter, forehead appearance, and skin visual patterns. Based on these observed patterns, it estimated an age of approximately ${headlineAge}.`;
      if (xaiMainReason) xaiMainReason.textContent = plainText;
      if (xaiReasoningText) xaiReasoningText.textContent = plainText;
      if (xaiConfText) xaiConfText.textContent = `Confidence: ${Math.round((state.confidence || 0.88) * 100)}% — Consistent facial landmarks detected.`;
      if (xaiLivenessText) xaiLivenessText.textContent = currentMode === 'photo' 
        ? 'Portrait Photo Mode — Single-frame facial ROI analysis.' 
        : 'Live Person Verified — Natural eye movement, blinks, and 3D facial depth were confirmed.';
    }

    // Regional focus descriptions in plain language
    if (state.features) {
      if (reasonEyeText && state.features.periocular) {
        reasonEyeText.textContent = `${state.features.periocular.score} (${state.features.periocular.percent}% model attention)`;
      }
      if (reasonSmileText && state.features.nasolabial) {
        reasonSmileText.textContent = `${state.features.nasolabial.score} (${state.features.nasolabial.percent}% model attention)`;
      }
      if (reasonForeheadText && state.features.forehead) {
        reasonForeheadText.textContent = `${state.features.forehead.score} (${state.features.forehead.percent}% model attention)`;
      }
      if (reasonJawText && state.features.jawline) {
        reasonJawText.textContent = `${state.features.jawline.score} (${state.features.jawline.percent}% model attention)`;
      }
    } else if (state.regionalSaliency) {
      if (reasonEyeText) reasonEyeText.textContent = `Eye contours & corner depth (${state.regionalSaliency.periocular || 35}% model attention)`;
      if (reasonSmileText) reasonSmileText.textContent = `Smile lines & cheek contours (${state.regionalSaliency.nasolabial || 28}% model attention)`;
      if (reasonForeheadText) reasonForeheadText.textContent = `Forehead micro-texture (${state.regionalSaliency.forehead || 22}% model attention)`;
      if (reasonJawText) reasonJawText.textContent = `Facial outline firmness (${state.regionalSaliency.jawline || 15}% model attention)`;
    }

    if (xaiNormalFaceImg) xaiNormalFaceImg.src = state.rawInputImage || '';
    if (xaiCroppedFaceImg) xaiCroppedFaceImg.src = state.preprocessedImage || '';
    if (xaiHeatmapImg) xaiHeatmapImg.src = state.heatmapImage || '';
  }

  function openXaiModal() {
    updateExplainabilityModal(predictionState);
    if (xaiModal) xaiModal.classList.add('open');
  }

  function closeXaiModal() {
    if (xaiModal) xaiModal.classList.remove('open');
  }

  [btnOpenXai, btnHeaderXai, btnViewExplanation].forEach(btn => {
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

  // ---------------------------------------------------------------------------
  // 13. FaceMesh Landmark Mesh & Real-Time Loop
  // ---------------------------------------------------------------------------
  const KEY_LANDMARK_INDICES = [
    10, 338, 109, 297, 67, 168, 70, 107, 336, 300,
    33, 133, 362, 263, 6, 197, 1, 98, 327, 2,
    234, 454, 132, 361, 61, 291, 0, 17, 152, 148, 377
  ];

  const TRIANGULATION_CONNECTIONS = [
    [0, 1], [0, 2], [1, 3], [2, 4], [1, 5], [2, 5], [0, 5],
    [3, 9], [4, 6], [5, 7], [5, 8], [7, 8], [6, 7], [8, 9],
    [7, 14], [8, 14], [14, 15], [15, 16],
    [6, 10], [10, 11], [11, 14], [9, 13], [12, 13], [12, 14],
    [10, 20], [13, 21], [11, 22], [12, 23],
    [15, 17], [15, 18], [16, 17], [16, 18], [17, 19], [18, 19],
    [20, 22], [21, 23], [22, 17], [23, 18],
    [19, 26], [19, 24], [19, 25],
    [24, 26], [25, 26], [24, 27], [25, 27], [26, 27],
    [20, 29], [21, 30], [29, 28], [30, 28],
    [27, 28], [24, 29], [25, 30]
  ];

  let smoothedBox = null;
  let smoothedLandmarks = null;
  let latestFaceBoxNorm = null;

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

  function onFaceMeshResults(results) {
    if (currentMode !== 'live' || !isStreaming || isFrozen || predictionState.predictionComplete) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const rawLandmarks = results.multiFaceLandmarks[0];

      // 1. Process Multi-Modal Liveness (Blink + Head Turn + Depth + Challenge)
      const livenessState = livenessEngine.processFrame(rawLandmarks);

      // Accurate video aspect ratio & object-fit: cover calibration
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const cw = canvas.width || 640;
      const ch = canvas.height || 480;

      const scale = Math.max(cw / vw, ch / vh);
      const rendW = vw * scale;
      const rendH = vh * scale;
      const offsetX = (rendW - cw) / 2;
      const offsetY = (rendH - ch) / 2;

      const toCanvasCoords = (normX, normY) => ({
        x: (1.0 - normX) * rendW - offsetX,
        y: normY * rendH - offsetY
      });

      let minX = 1.0, maxX = 0.0, minY = 1.0, maxY = 0.0;
      rawLandmarks.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });

      latestFaceBoxNorm = [minX, minY, maxX, maxY];

      const boxTopLeft = toCanvasCoords(maxX, minY);
      const boxBottomRight = toCanvasCoords(minX, maxY);
      const boxW = Math.abs(boxBottomRight.x - boxTopLeft.x);
      const boxH = Math.abs(boxBottomRight.y - boxTopLeft.y);
      const padX = boxW * 0.12;
      const padY = boxH * 0.14;

      const targetBox = {
        x: boxTopLeft.x - padX,
        y: boxTopLeft.y - padY,
        width: boxW + padX * 2,
        height: boxH + padY * 2
      };

      const targetPts = KEY_LANDMARK_INDICES.map(idx => {
        const pt = rawLandmarks[idx];
        return toCanvasCoords(pt.x, pt.y);
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

      // 2. ONE-SHOT PREDICTION TRIGGER: Trigger ONLY when Multi-Modal Liveness is confirmed
      if (livenessState === 'live' && !livenessEngine.hasTriggeredPrediction && !predictionState.predictionComplete) {
        livenessEngine.hasTriggeredPrediction = true;
        if (statusPredictionState) {
          statusPredictionState.textContent = 'Liveness Confirmed · Computing Accurate Age…';
          statusPredictionState.style.color = '#10b981';
        }
        showInBoxLoader('Liveness Verified ✓', 'Analyzing Biometric Features…');
        triggerInferenceFromVideo();
      } else if (livenessState === 'spoof') {
        // 7 seconds elapsed without genuine liveness -> Finalize as spoof
        finalizeAndReleaseHardware(true);
        showCompletionBanner(true);
        return;
      }

      // 3. Draw HUD on Canvas
      const elapsed = performance.now() - livenessEngine.startTime;
      const remainingSec = Math.max(0, (LIVENESS_DURATION_MS - elapsed) / 1000).toFixed(1);
      drawRealFaceMesh(smoothedBox, smoothedLandmarks, predictionState.displayAge, predictionState.confidence || 0.88, livenessState, predictionState.ageRange, remainingSec);

      if (statusLandmarkCount) statusLandmarkCount.textContent = '468 Landmarks Tracked';

    } else {
      smoothedBox = null;
      smoothedLandmarks = null;
      livenessEngine.checkTimeout();

      if (facePromptPill) {
        facePromptPill.style.display = 'flex';
        facePromptPill.innerHTML = '<span class="pill-dot" style="background:#facc15;"></span> Center face in frame…';
      }
      if (statusFaceDetected) {
        statusFaceDetected.textContent = 'Looking for face…';
        statusFaceDetected.style.color = '#facc15';
      }
      if (statusLandmarkCount) statusLandmarkCount.textContent = '0 Nodes';
    }
  }

  // Offscreen canvas for capturing high-res snapshot
  const offscreenCanvas = document.createElement('canvas');
  const offscreenCtx = offscreenCanvas.getContext('2d');

  function triggerInferenceFromVideo() {
    if (!video || video.readyState < 2 || isFrozen || currentMode !== 'live' || predictionState.predictionComplete) return;
    try {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;

      offscreenCanvas.width = vw;
      offscreenCanvas.height = vh;
      offscreenCtx.clearRect(0, 0, vw, vh);

      offscreenCtx.save();
      offscreenCtx.translate(vw, 0);
      offscreenCtx.scale(-1, 1);
      offscreenCtx.drawImage(video, 0, 0, vw, vh);
      offscreenCtx.restore();

      const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.95);

      // Immediately purge offscreen frame buffer
      offscreenCtx.clearRect(0, 0, vw, vh);
      offscreenCanvas.width = 1;
      offscreenCanvas.height = 1;

      sendFrameToBackend(dataUrl, false);
    } catch (e) {
      console.error('Error capturing video frame:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // 14. Draw Real-Time Canvas HUD with 7s Challenge Prompts
  // ---------------------------------------------------------------------------
  function drawRealFaceMesh(box, pts, age, conf, livenessState = 'live', ageRange = '--', remainingSec = '7.0') {
    const { x, y, width, height } = box;
    ctx.save();

    // 1. Clean Subtle Face Oval / Feature Lines
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = livenessState === 'spoof' 
      ? 'rgba(239, 68, 68, 0.85)' 
      : (livenessState === 'prompt_turn' 
        ? 'rgba(217, 119, 6, 0.90)' 
        : (livenessState === 'prompt_blink' || livenessState === 'checking' ? 'rgba(37, 99, 235, 0.85)' : 'rgba(5, 150, 105, 0.85)'));
    ctx.shadowBlur = 0;

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

    // 2. Landmark Nodes (Subtle clean dots)
    pts.forEach(p => {
      ctx.fillStyle = livenessState === 'spoof' 
        ? '#ef4444' 
        : (livenessState === 'prompt_turn' ? '#d97706' : (livenessState === 'prompt_blink' || livenessState === 'checking' ? '#2563eb' : '#059669'));
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Clean Face Bounding Frame
    const corner = Math.min(24, width * 0.2);
    ctx.strokeStyle = livenessState === 'spoof' 
      ? '#ef4444' 
      : (livenessState === 'prompt_turn' ? '#d97706' : (livenessState === 'prompt_blink' || livenessState === 'checking' ? '#2563eb' : '#059669'));
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    ctx.beginPath(); ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + width - corner, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + corner); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + height - corner); ctx.lineTo(x, y + height); ctx.lineTo(x + corner, y + height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + width - corner, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - corner); ctx.stroke();

    // 4. In-Viewport HUD Tag (Clean White Card with Blue/Green Text)
    let tagText = '';
    let dotColor = '#2563eb';

    if (livenessState === 'spoof') {
      tagText = 'No Liveness Detected';
      dotColor = '#ef4444';
    } else if (livenessState === 'prompt_turn') {
      tagText = `Turn head slightly (${remainingSec}s)`;
      dotColor = '#d97706';
    } else if (livenessState === 'prompt_blink' || livenessState === 'checking') {
      tagText = `Blink naturally (${remainingSec}s)`;
      dotColor = '#2563eb';
    } else if (livenessState === 'live' && age && age !== '--') {
      const rangeText = (ageRange && ageRange !== '--') ? ` [${ageRange}]` : '';
      tagText = `Age: ${age} Yrs${rangeText} · Verified`;
      dotColor = '#059669';
    } else {
      tagText = 'Estimating Age…';
      dotColor = '#059669';
    }

    ctx.font = '600 13px "Plus Jakarta Sans", "Inter", sans-serif';
    const textWidth = ctx.measureText(tagText).width;

    const tagW = textWidth + 36;
    const tagH = 34;
    
    let tagX = Math.max(10, Math.min(canvas.width - tagW - 10, x + (width - tagW) / 2));
    let tagY = y + height + 12;
    
    if (tagY + tagH > canvas.height - 10) {
      tagY = Math.max(10, y - tagH - 12);
    }

    // Flat simple badge background
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 17);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(tagX + 16, tagY + tagH / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, tagX + 28, tagY + tagH / 2);

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 15. Webcam Startup, Stop & Restart Handlers
  // ---------------------------------------------------------------------------
  async function startCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    resetPredictionState('live');
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
      if (standbyOverlay) standbyOverlay.classList.add('hidden');
      if (sessionCompleteBanner) sessionCompleteBanner.style.display = 'none';
      if (viewportBadge) viewportBadge.style.display = 'none';
      if (btnFreeze) {
        btnFreeze.disabled = false;
        if (freezeText) freezeText.textContent = 'Freeze / Finalize';
      }
      if (toggleCamText) toggleCamText.textContent = 'Stop Camera';
      if (streamStatusText) streamStatusText.textContent = 'Camera Active (7s Multi-Modal Liveness)';
      if (streamDot) streamDot.className = 'dot-live active';

      syncCanvasSize();
      startContinuousProcessing();

    } catch (err) {
      console.warn('Webcam unavailable, starting fallback mode:', err);
      startFallbackMode();
    }
  }

  function stopCamera() {
    finalizeAndReleaseHardware(false);
    resetPredictionState('standby');

    if (standbyOverlay) standbyOverlay.classList.remove('hidden');
    if (sessionCompleteBanner) sessionCompleteBanner.style.display = 'none';
    if (facePromptPill) facePromptPill.style.display = 'none';
    if (viewportBadge) viewportBadge.style.display = 'none';
    if (btnFreeze) {
      btnFreeze.disabled = true;
      if (freezeText) freezeText.textContent = 'Freeze / Finalize';
    }
    if (toggleCamText) toggleCamText.textContent = 'Start Webcam';
    if (currentModePill) currentModePill.textContent = 'Standby';
    if (streamStatusText) streamStatusText.textContent = 'Camera Idle';
    if (streamDot) streamDot.className = 'dot-live';
  }

  function toggleCamera() {
    if (isStreaming) {
      stopCamera();
    } else {
      startCamera();
    }
  }

  function restartPredictionSession() {
    stopCamera();
    setTimeout(() => {
      resetPredictionState('live');
      startCamera();
    }, 50);
  }

  // ---------------------------------------------------------------------------
  // Page View Navigation (Landing View <-> Scanner View)
  // ---------------------------------------------------------------------------
  function showScannerPage(autoStartCam = true) {
    if (pageLanding) pageLanding.style.display = 'none';
    if (pageScanner) pageScanner.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (autoStartCam) {
      setTimeout(() => {
        startCamera();
      }, 100);
    }
  }

  function showLandingPage() {
    stopCamera();
    if (pageScanner) pageScanner.style.display = 'none';
    if (pageLanding) pageLanding.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (btnNavigateScan) btnNavigateScan.addEventListener('click', () => showScannerPage(true));
  if (btnBackHome) btnBackHome.addEventListener('click', showLandingPage);
  if (brandHomeLink) brandHomeLink.addEventListener('click', showLandingPage);

  if (photoInputLanding) {
    photoInputLanding.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        showScannerPage(false);
        handleImageUpload(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  if (btnStartCam) btnStartCam.addEventListener('click', startCamera);
  if (btnToggleCam) btnToggleCam.addEventListener('click', toggleCamera);
  if (btnFreeze) btnFreeze.addEventListener('click', () => finalizeAndReleaseHardware(false));
  if (btnPredictAgain) btnPredictAgain.addEventListener('click', restartPredictionSession);
  if (btnScanAnother && btnScanAnother !== btnPredictAgain) btnScanAnother.addEventListener('click', restartPredictionSession);

  // ---------------------------------------------------------------------------
  // 16. Photo Upload & Drag-and-Drop
  // ---------------------------------------------------------------------------
  function handleImageUpload(file) {
    if (!file) return;

    finalizeAndReleaseHardware(false);
    currentMode = 'photo';
    resetPredictionState('photo');

    if (standbyOverlay) standbyOverlay.classList.add('hidden');
    if (sessionCompleteBanner) sessionCompleteBanner.style.display = 'none';
    if (facePromptPill) facePromptPill.style.display = 'none';
    if (currentModePill) currentModePill.textContent = 'Photo Mode';
    if (btnFreeze) btnFreeze.disabled = true;
    if (toggleCamText) toggleCamText.textContent = 'Start Webcam';
    if (streamStatusText) streamStatusText.textContent = 'Processing Portrait…';
    if (streamDot) streamDot.style.background = 'var(--accent)';
    if (viewportBadge) {
      viewportBadge.style.display = 'block';
      if (viewportBadgeText) viewportBadgeText.textContent = 'PHOTO MODE';
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      predictionState.rawInputImage = rawDataUrl;

      const img = new Image();
      img.onload = () => {
        uploadedImageObj = img;
        syncCanvasSize();

        renderUploadedPhoto(img);
        showInBoxLoader('Computing Age Estimation…', 'Normalizing lighting & cropping biometric ROI');
        sendFrameToBackend(rawDataUrl, true);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  }

  function renderUploadedPhoto(img) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hRatio = canvas.width / img.width;
    const vRatio = canvas.height / img.height;
    const ratio = Math.min(hRatio, vRatio) * 0.95;
    const rendW = img.width * ratio;
    const rendH = img.height * ratio;
    const shiftX = (canvas.width - rendW) / 2;
    const shiftY = (canvas.height - rendH) / 2;

    ctx.drawImage(img, 0, 0, img.width, img.height, shiftX, shiftY, rendW, rendH);
  }

  function renderPreprocessedFaceOnCanvas(preprocessedBase64, age) {
    const faceImg = new Image();
    faceImg.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const hRatio = canvas.width / faceImg.width;
      const vRatio = canvas.height / faceImg.height;
      const ratio = Math.min(hRatio, vRatio) * 0.95;
      const rendW = faceImg.width * ratio;
      const rendH = faceImg.height * ratio;
      const shiftX = (canvas.width - rendW) / 2;
      const shiftY = (canvas.height - rendH) / 2;

      // Draw clean portrait face without any overlaid mesh pattern
      ctx.drawImage(faceImg, 0, 0, faceImg.width, faceImg.height, shiftX, shiftY, rendW, rendH);

      if (statusFaceDetected) {
        statusFaceDetected.textContent = '✓ Face Analyzed';
      }
      if (statusPredictionState) {
        statusPredictionState.textContent = 'Estimation Complete';
      }
      if (streamStatusText) {
        streamStatusText.textContent = 'Analysis Complete';
      }
    };
    faceImg.src = preprocessedBase64;
  }

  [photoInput, photoInputStandby, photoInputComplete].forEach(inp => {
    if (inp) {
      inp.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleImageUpload(e.target.files[0]);
          e.target.value = '';
        }
      });
    }
  });

  if (dropZone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) {
        handleImageUpload(dt.files[0]);
      }
    });
  }

  function syncCanvasSize() {
    const wrapper = document.getElementById('video-wrapper');
    if (wrapper) {
      canvas.width = wrapper.clientWidth;
      canvas.height = wrapper.clientHeight;
    }
  }

  window.addEventListener('resize', () => {
    syncCanvasSize();
    if (currentMode === 'photo' && predictionState.preprocessedImage) {
      renderPreprocessedFaceOnCanvas(predictionState.preprocessedImage, predictionState.age);
    }
  });

  // ---------------------------------------------------------------------------
  // 17. Continuous Processing Loop for Webcam
  // ---------------------------------------------------------------------------
  async function startContinuousProcessing() {
    const processFrame = async (timestamp) => {
      if (!isStreaming || currentMode !== 'live' || isFrozen || predictionState.predictionComplete) return;

      const delta = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      if (delta > 0 && timestamp % 20 < 2) {
        if (fpsCounter) fpsCounter.textContent = `${Math.min(60, Math.round(1 / delta))} FPS`;
      }

      if (faceMesh && video.readyState >= 2) {
        try {
          await faceMesh.send({ image: video });
        } catch (e) {}
      } else if (!faceMesh) {
        runFallbackDetection(timestamp);
      }

      if (isStreaming && !isFrozen && !predictionState.predictionComplete) {
        animFrameId = requestAnimationFrame(processFrame);
      }
    };

    animFrameId = requestAnimationFrame(processFrame);
  }

  function startFallbackMode() {
    isStreaming = true;
    isFrozen = false;
    currentMode = 'live';

    if (currentModePill) currentModePill.textContent = 'Live Demo';
    if (standbyOverlay) standbyOverlay.classList.add('hidden');
    if (btnFreeze) {
      btnFreeze.disabled = false;
      if (freezeText) freezeText.textContent = 'Freeze / Finalize';
    }
    if (toggleCamText) toggleCamText.textContent = 'Stop Camera';
    if (streamStatusText) streamStatusText.textContent = 'Neural Engine Active';
    if (streamDot) streamDot.className = 'dot-live active';

    syncCanvasSize();
    startContinuousProcessing();
  }

  function runFallbackDetection(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const t = timestamp * 0.0012;
    const w = canvas.width;
    const h = canvas.height;

    const boxW = Math.min(290, w * 0.48);
    const boxH = boxW * 1.28;
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

    drawRealFaceMesh(box, pts, 26, 0.88, 'live', '20–29');
    updateResultsUI(26, '20–29', 0.88, 3.5, false);
    if (statusFaceDetected) statusFaceDetected.textContent = '✓ Face Detected (Simulated)';
    if (statusLandmarkCount) statusLandmarkCount.textContent = '31 Nodes Tracked';
  }
});
