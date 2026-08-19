/**
 * COGNIAGE AI - EXPLAINABLE AI (XAI) PANEL CONTROLLER
 * Manages real-time metric visual updates, DEX probability histograms, and tab switching.
 */

class XaiPanelController {
  constructor() {
    this.activeTab = 'features';
    this.init();
  }

  init() {
    this.bindTabEvents();
    this.renderInitialDistribution();
  }

  bindTabEvents() {
    const tabs = document.querySelectorAll('.xai-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        this.switchTab(target);
      });
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update active tab buttons
    document.querySelectorAll('.xai-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    // Update active tab panes
    document.querySelectorAll('.xai-tab-content').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });
  }

  /**
   * Update Main HUD & Feature Bars with latest prediction
   */
  updateMetrics(prediction) {
    if (!prediction) return;

    // 1. Update Hero Card Age & Margin
    const ageEl = document.getElementById('live-age-val');
    const maeEl = document.getElementById('live-mae-val');
    const confValEl = document.getElementById('live-conf-val');
    const confBarEl = document.getElementById('live-conf-bar');
    const stateBadge = document.getElementById('detection-state-badge');

    if (ageEl) ageEl.textContent = prediction.age.toFixed(1);
    if (maeEl) maeEl.innerHTML = `&plusmn; ${prediction.mae.toFixed(1)} yrs (95% CI)`;
    
    const confPercent = Math.round(prediction.confidence * 100);
    if (confValEl) confValEl.textContent = `${confPercent}%`;
    if (confBarEl) confBarEl.style.width = `${confPercent}%`;

    if (stateBadge) {
      stateBadge.textContent = 'Biometrics Locked';
      stateBadge.style.color = '#facc15';
      stateBadge.style.borderColor = '#facc15';
    }

    // 2. Update Feature Metrics
    const f = prediction.features;
    if (f) {
      this.updateFeatureRow('periocular', f.periocular.score, f.periocular.percent, f.periocular.class);
      this.updateFeatureRow('nasolabial', f.nasolabial.score, f.nasolabial.percent, f.nasolabial.class);
      this.updateFeatureRow('forehead', f.forehead.score, f.forehead.percent, f.forehead.class);
      this.updateFeatureRow('jawline', f.jawline.score, f.jawline.percent, f.jawline.class);
    }

    // 3. Update Distribution Histogram
    if (prediction.distribution) {
      this.updateDistributionChart(prediction.distribution, prediction.age);
    }
  }

  updateFeatureRow(id, scoreText, percent, fillClass) {
    const scoreEl = document.getElementById(`score-${id}`);
    const barEl = document.getElementById(`bar-${id}`);

    if (scoreEl) scoreEl.textContent = scoreText;
    if (barEl) {
      barEl.style.width = `${percent}%`;
      barEl.className = `f-bar-fill ${fillClass}`;
    }
  }

  renderInitialDistribution() {
    const container = document.getElementById('age-dist-bars');
    if (!container) return;

    const initialBins = [
      { label: '<18', percent: 2, isPeak: false },
      { label: '19-24', percent: 68, isPeak: true },
      { label: '25-30', percent: 22, isPeak: false },
      { label: '31-38', percent: 5, isPeak: false },
      { label: '39-48', percent: 2, isPeak: false },
      { label: '49-60', percent: 1, isPeak: false },
      { label: '60+', percent: 0, isPeak: false }
    ];

    this.updateDistributionChart(initialBins, 24.6);
  }

  updateDistributionChart(bins, age) {
    const container = document.getElementById('age-dist-bars');
    const peakText = document.getElementById('peak-age-bin');
    if (!container) return;

    container.innerHTML = '';

    bins.forEach(bin => {
      const col = document.createElement('div');
      col.className = 'dist-bar-col';

      const bar = document.createElement('div');
      bar.className = `dist-bar ${bin.isPeak ? 'peak' : ''}`;
      bar.style.height = `${Math.max(8, bin.percent * 1.1)}px`;
      bar.title = `${bin.label}: ${bin.percent}% probability`;

      const label = document.createElement('span');
      label.className = 'dist-label';
      label.textContent = bin.label;

      col.appendChild(bar);
      col.appendChild(label);
      container.appendChild(col);

      if (bin.isPeak && peakText) {
        peakText.textContent = `${bin.label} yrs (${bin.percent}% Prob)`;
      }
    });
  }
}

// Instantiate Global XAI Panel
window.xaiPanel = new XaiPanelController();
