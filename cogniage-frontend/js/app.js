/**
 * COGNIAGE AI - MASTER APP CONTROLLER
 * Manages Page Routing, Theme Persistence, Hero Canvas Animation, and UI Interactivity.
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeSystem();
  initNavigationRouter();
  initHeroPreviewCanvas();
  initScannerControls();
  initBackendModal();
});

/**
 * ==========================================================================
 * 1. THEME ENGINE (White & Royal Blue / Dark Mode Persistence)
 * ==========================================================================
 */
function initThemeSystem() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label-text');
  
  // Load saved theme or default to 'light'
  const savedTheme = localStorage.getItem('cogniage_theme') || 'light';
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      showToast(`Switched to ${newTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}`, 'info');
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cogniage_theme', theme);
    if (themeLabel) {
      themeLabel.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
  }
}

/**
 * ==========================================================================
 * 2. NAVIGATION & ROUTER (Landing <-> Scanner View)
 * ==========================================================================
 */
function initNavigationRouter() {
  const pageLanding = document.getElementById('page-landing');
  const pageScanner = document.getElementById('page-scanner');

  const btnNavHome = document.getElementById('btn-nav-home');
  const btnNavScanner = document.getElementById('btn-nav-scanner');
  const btnNavDocs = document.getElementById('btn-nav-docs');
  const navBrand = document.getElementById('nav-brand');

  const btnGetStart = document.getElementById('btn-get-start');
  const btnCtaBottom = document.getElementById('btn-cta-bottom');
  const headerGetStartBtn = document.getElementById('header-get-start-btn');
  const btnLearnMore = document.getElementById('btn-learn-more');
  const btnBackHome = document.getElementById('btn-back-home');

  function navigateTo(pageId) {
    if (pageId === 'scanner') {
      pageLanding.classList.remove('active-view');
      pageScanner.classList.add('active-view');
      
      btnNavHome.classList.remove('active');
      btnNavScanner.classList.add('active');

      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Initialize FaceMesh Canvas & request Camera
      setTimeout(() => {
        const video = document.getElementById('webcam-video');
        const canvas = document.getElementById('biometric-canvas');
        
        if (window.faceMeshEngine) {
          window.faceMeshEngine.init(canvas);
        }
        if (window.cameraController) {
          window.cameraController.init(video, canvas);
          // Show Chrome Permission Popup when opening Scanner
          window.cameraController.requestCameraAccess();
        }
      }, 100);

    } else {
      pageScanner.classList.remove('active-view');
      pageLanding.classList.add('active-view');

      btnNavScanner.classList.remove('active');
      btnNavHome.classList.add('active');

      // Stop camera if leaving scanner
      if (window.cameraController && window.cameraController.isStreaming) {
        window.cameraController.stopCamera();
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Routing Events
  if (btnGetStart) btnGetStart.addEventListener('click', () => navigateTo('scanner'));
  if (btnCtaBottom) btnCtaBottom.addEventListener('click', () => navigateTo('scanner'));
  if (headerGetStartBtn) headerGetStartBtn.addEventListener('click', () => navigateTo('scanner'));
  if (btnNavScanner) btnNavScanner.addEventListener('click', () => navigateTo('scanner'));

  if (btnNavHome) btnNavHome.addEventListener('click', () => navigateTo('landing'));
  if (navBrand) navBrand.addEventListener('click', () => navigateTo('landing'));
  if (btnBackHome) btnBackHome.addEventListener('click', () => navigateTo('landing'));

  if (btnNavDocs) {
    btnNavDocs.addEventListener('click', () => {
      navigateTo('landing');
      const specs = document.getElementById('specs-section');
      if (specs) specs.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (btnLearnMore) {
    btnLearnMore.addEventListener('click', () => {
      const specs = document.getElementById('specs-section');
      if (specs) specs.scrollIntoView({ behavior: 'smooth' });
    });
  }
}

/**
 * ==========================================================================
 * 3. HERO INTERACTIVE BIOMETRIC PREVIEW CANVAS
 * ==========================================================================
 */
function initHeroPreviewCanvas() {
  const canvas = document.getElementById('hero-preview-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let time = 0;

  function renderHeroMesh() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    time += 0.02;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    // Dark sleek gradient background
    const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, w * 0.7);
    bgGrad.addColorStop(0, '#131e3a');
    bgGrad.addColorStop(1, '#070b14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle face silhouette outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.28, h * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Key landmarks with subtle breathing animation
    const breath = Math.sin(time) * 3;
    const nodes = [
      // Crown & Forehead
      { x: cx, y: cy - 140 },
      { x: cx - 65, y: cy - 110 + breath },
      { x: cx + 65, y: cy - 110 + breath },
      { x: cx - 100, y: cy - 60 },
      { x: cx + 100, y: cy - 60 },
      { x: cx, y: cy - 55 },

      // Eyes & Brows
      { x: cx - 55, y: cy - 40 },
      { x: cx - 20, y: cy - 38 },
      { x: cx + 20, y: cy - 38 },
      { x: cx + 55, y: cy - 40 },

      // Nose
      { x: cx, y: cy - 20 },
      { x: cx, y: cy + 15 },
      { x: cx - 25, y: cy + 12 },
      { x: cx + 25, y: cy + 12 },
      { x: cx, y: cy + 30 },

      // Cheeks
      { x: cx - 95, y: cy + 5 },
      { x: cx + 95, y: cy + 5 },

      // Mouth
      { x: cx - 35, y: cy + 55 },
      { x: cx + 35, y: cy + 55 },
      { x: cx, y: cy + 48 },
      { x: cx, y: cy + 64 },

      // Jawline & Chin
      { x: cx - 80, y: cy + 70 },
      { x: cx + 80, y: cy + 70 },
      { x: cx - 40, y: cy + 115 - breath },
      { x: cx + 40, y: cy + 115 - breath },
      { x: cx, y: cy + 130 - breath }
    ];

    const lines = [
      [0, 1], [0, 2], [1, 3], [2, 4], [1, 5], [2, 5], [0, 5],
      [3, 6], [4, 9], [6, 7], [8, 9], [7, 10], [8, 10],
      [3, 15], [4, 16], [15, 12], [16, 13], [10, 11], [12, 11], [13, 11], [12, 14], [13, 14],
      [14, 19], [17, 19], [18, 19], [17, 20], [18, 20],
      [15, 21], [16, 22], [21, 23], [22, 24], [23, 25], [24, 25], [20, 25]
    ];

    // Draw Triangulation Lines (Golden Yellow)
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.shadowColor = 'rgba(250, 204, 21, 0.5)';
    ctx.shadowBlur = 6;

    lines.forEach(([i, j]) => {
      const n1 = nodes[i];
      const n2 = nodes[j];
      if (n1 && n2) {
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      }
    });

    // Draw Geometric Node Squares
    nodes.forEach(n => {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.3;
      ctx.strokeRect(n.x - 3, n.y - 3, 6, 6);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(n.x - 1, n.y - 1, 2, 2);
    });

    ctx.shadowBlur = 0;
    requestAnimationFrame(renderHeroMesh);
  }

  renderHeroMesh();
}

/**
 * ==========================================================================
 * 4. SCANNER VIEW CONTROLS & EVENT LISTENERS
 * ==========================================================================
 */
function initScannerControls() {
  const btnToggleCam = document.getElementById('btn-toggle-cam');
  const btnSnapshot = document.getElementById('btn-snapshot');
  const btnRequestCamAgain = document.getElementById('btn-request-cam-again');
  const btnLoadDemoFace = document.getElementById('btn-load-demo-face');

  const fileInput1 = document.getElementById('sample-image-input');
  const fileInput2 = document.getElementById('sample-image-input-2');

  // Toggle View Layers
  const toggleMeshBtn = document.getElementById('toggle-mesh-btn');
  const toggleBoxBtn = document.getElementById('toggle-box-btn');
  const toggleAgeHudBtn = document.getElementById('toggle-age-hud-btn');

  if (btnToggleCam) {
    btnToggleCam.addEventListener('click', () => {
      if (window.cameraController) window.cameraController.toggleCamera();
    });
  }

  if (btnSnapshot) {
    btnSnapshot.addEventListener('click', () => {
      if (window.cameraController) window.cameraController.toggleFreeze();
    });
  }

  if (btnRequestCamAgain) {
    btnRequestCamAgain.addEventListener('click', () => {
      if (window.cameraController) window.cameraController.startCamera();
    });
  }

  if (btnLoadDemoFace) {
    btnLoadDemoFace.addEventListener('click', () => {
      if (window.cameraController) {
        window.cameraController.startSimulatedCamera();
        showToast('Demo Reference Face Model Loaded', 'success');
      }
    });
  }

  // File Upload Handlers
  [fileInput1, fileInput2].forEach(input => {
    if (input) {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && window.cameraController) {
          window.cameraController.loadImage(file);
          showToast(`Loaded sample photo: ${file.name}`, 'info');
        }
      });
    }
  });

  // Layer Toggles
  if (toggleMeshBtn) {
    toggleMeshBtn.addEventListener('click', () => {
      if (window.faceMeshEngine) {
        window.faceMeshEngine.showMesh = !window.faceMeshEngine.showMesh;
        toggleMeshBtn.classList.toggle('active', window.faceMeshEngine.showMesh);
      }
    });
  }

  if (toggleBoxBtn) {
    toggleBoxBtn.addEventListener('click', () => {
      if (window.faceMeshEngine) {
        window.faceMeshEngine.showBox = !window.faceMeshEngine.showBox;
        toggleBoxBtn.classList.toggle('active', window.faceMeshEngine.showBox);
      }
    });
  }

  if (toggleAgeHudBtn) {
    toggleAgeHudBtn.addEventListener('click', () => {
      if (window.faceMeshEngine) {
        window.faceMeshEngine.showAgeHud = !window.faceMeshEngine.showAgeHud;
        toggleAgeHudBtn.classList.toggle('active', window.faceMeshEngine.showAgeHud);
      }
    });
  }
}

/**
 * ==========================================================================
 * 5. BACKEND API CONNECTOR MODAL (FOR TEAMMATES)
 * ==========================================================================
 */
function initBackendModal() {
  const modal = document.getElementById('backend-modal');
  const btnOpen = document.getElementById('btn-open-backend-modal');
  const btnClose = document.getElementById('btn-close-backend-modal');
  const btnCancel = document.getElementById('btn-cancel-backend-modal');
  const btnSave = document.getElementById('btn-save-backend-modal');
  const selectMode = document.getElementById('backend-mode-select');
  const urlGroup = document.getElementById('api-url-group');
  const inputUrl = document.getElementById('api-endpoint-url');
  const banner = document.getElementById('api-status-banner');

  if (!modal) return;

  function openModal() {
    modal.classList.add('open');
  }

  function closeModal() {
    modal.classList.remove('open');
  }

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (selectMode) {
    selectMode.addEventListener('change', () => {
      const isCustom = selectMode.value === 'custom_rest_api';
      if (urlGroup) urlGroup.style.display = isCustom ? 'flex' : 'none';
      if (banner) {
        banner.innerHTML = isCustom 
          ? `<span class="dot yellow-dot"></span><span>Connecting to custom REST server for deep model inferences.</span>`
          : `<span class="dot green-dot"></span><span>Client-side vision engine is currently active (zero latency).</span>`;
      }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const mode = selectMode.value;
      const url = inputUrl.value;

      if (window.agePredictor) {
        window.agePredictor.setMode(mode, url);
      }

      const activeModelLabel = document.getElementById('active-model-name');
      if (activeModelLabel) {
        activeModelLabel.textContent = mode === 'custom_rest_api' ? 'Python REST API' : 'BioMesh-v2 + DEX';
      }

      showToast('Backend configuration saved successfully', 'success');
      closeModal();
    });
  }
}

/**
 * ==========================================================================
 * 6. TOAST NOTIFICATION UTILITY
 * ==========================================================================
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = type === 'success'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : type === 'warning'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a4cd2" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Make toast available globally
window.showToast = showToast;
