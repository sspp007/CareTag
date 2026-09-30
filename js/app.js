/**
 * CareTag - Smart Garment Scanner
 * Flat Native App Architecture (PWA Standalone: Home, Scan, Profile)
 */

import { detectLaundrySymbols, checkBackendHealth, API_BASE_URL, getCustomApiUrl, setCustomApiUrl } from './api.js';
import { getSymbolSvg, SYMBOL_FAMILIES } from './symbols.js';
import { initDB, saveGarment, getAllGarments, getGarmentById, deleteGarment } from './storage.js';

// Application States
const AppState = {
  INITIALIZING: 'INITIALIZING',
  STREAMING: 'STREAMING',
  CAPTURED: 'CAPTURED',
  INFERENCING: 'INFERENCING',
  RESULTS: 'RESULTS'
};

class GarmentScannerApp {
  constructor() {
    this.state = AppState.INITIALIZING;
    this.currentTab = 'home'; // 'home' | 'scan' | 'profile'
    this.hasCameraStarted = false;
    this.mediaStream = null;
    this.videoTrack = null;
    this.currentFacingMode = 'environment';
    this.torchEnabled = false;
    this.hasTorchCapability = false;
    this.lastDetectedResults = null;
    this.lastDetectedScores = null;
    this.currentCapturedBase64 = null;
    this.currentDetailGarmentId = null;

    // Cache DOM Elements
    this.dom = {
      // Main Views
      homeView: document.getElementById('home-view'),
      scanView: document.getElementById('scan-view'),
      profileView: document.getElementById('profile-view'),
      guideView: document.getElementById('guide-view'),
      bottomNav: document.getElementById('bottom-nav'),
      appHeader: document.getElementById('app-header'),
      headerScanControls: document.getElementById('header-scan-controls'),

      // Navigation Tabs
      tabHome: document.getElementById('tab-home'),
      tabScan: document.getElementById('tab-scan'),
      tabProfile: document.getElementById('tab-profile'),

      // Home View Actions
      btnHomeStartScan: document.getElementById('btn-home-start-scan'),
      btnStyleSuggestion: document.getElementById('btn-style-suggestion'),
      styleSuggestionBox: document.getElementById('style-suggestion-box'),
      styleSuggestionText: document.getElementById('style-suggestion-text'),
      cardOpenGuide: document.getElementById('card-open-guide'),
      btnGuideBack: document.getElementById('btn-guide-back'),
      dashboardTemp: document.getElementById('dashboard-temp'),
      dashboardCondition: document.getElementById('dashboard-condition'),

      // Camera & Scanner Elements
      videoFeed: document.getElementById('camera-feed'),
      captureCanvas: document.getElementById('capture-canvas'),
      syntheticFeed: document.getElementById('synthetic-feed'),
      cameraStatusBanner: document.getElementById('camera-status-banner'),
      cameraStatusText: document.getElementById('camera-status-text'),
      btnRequestCam: document.getElementById('btn-request-cam'),
      btnTorch: document.getElementById('btn-torch'),
      btnFlipCamera: document.getElementById('btn-flip-camera'),
      btnScan: document.getElementById('btn-scan'),
      btnUploadFile: document.getElementById('btn-upload-file'),
      tagFileInput: document.getElementById('tag-file-input'),
      btnServerStatus: document.getElementById('btn-server-status'),
      backendStatusDot: document.getElementById('backend-status-dot'),
      reticleBox: document.getElementById('reticle-box'),
      hudStatusHint: document.getElementById('hud-status-hint'),
      loadingOverlay: document.getElementById('loading-overlay'),
      inferenceStepTitle: document.getElementById('inference-step-title'),
      inferenceStepDesc: document.getElementById('inference-step-desc'),
      
      // Results Bottom Sheet
      resultsSheet: document.getElementById('results-sheet'),
      resultsCardsContainer: document.getElementById('results-cards-container'),
      resultsSummaryText: document.getElementById('results-summary-text'),
      resultsDragHandle: document.getElementById('results-drag-handle'),
      btnCloseResults: document.getElementById('btn-close-results'),
      btnScanAgain: document.getElementById('btn-scan-again'),
      btnCopyAdvice: document.getElementById('btn-copy-advice'),
      btnSaveWardrobe: document.getElementById('btn-save-wardrobe'),

      // Sustainability & Comfort Metrics
      sustainabilityScoreLabel: document.getElementById('sustainability-score-label'),
      sustainabilityScorePct: document.getElementById('sustainability-score-pct'),
      sustainabilityProgressBar: document.getElementById('sustainability-progress-bar'),
      comfortScoreLabel: document.getElementById('comfort-score-label'),
      comfortScorePct: document.getElementById('comfort-score-pct'),
      comfortProgressBar: document.getElementById('comfort-progress-bar'),

      // Profile View Elements
      profileClosetCount: document.getElementById('profile-closet-count'),
      btnProfileOpenCloset: document.getElementById('btn-profile-open-closet'),
      modalWardrobeCloset: document.getElementById('modal-wardrobe-closet'),
      btnCloseWardrobeModal: document.getElementById('btn-close-wardrobe-modal'),
      btnDismissCloset: document.getElementById('btn-dismiss-closet'),
      archiveGrid: document.getElementById('archive-grid'),
      archiveEmptyState: document.getElementById('archive-empty-state'),
      archiveCountBadge: document.getElementById('archive-count-badge'),

      // Save Garment Modal
      modalSaveGarment: document.getElementById('modal-save-garment'),
      inputGarmentNickname: document.getElementById('input-garment-nickname'),
      btnCancelSave: document.getElementById('btn-cancel-save'),
      btnConfirmSave: document.getElementById('btn-confirm-save'),

      // Detail Modal
      garmentDetailModal: document.getElementById('garment-detail-modal'),
      detailImage: document.getElementById('detail-image'),
      detailNickname: document.getElementById('detail-nickname'),
      detailDate: document.getElementById('detail-date'),
      detailRulesList: document.getElementById('detail-rules-list'),
      btnCloseDetail: document.getElementById('btn-close-detail'),
      btnDismissDetail: document.getElementById('btn-dismiss-detail'),
      btnDeleteGarment: document.getElementById('btn-delete-garment'),

      // Feedback Toast
      toast: document.getElementById('toast')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.renderIcons();

    try {
      await initDB();
      await this.updateProfileStats();
    } catch (e) {
      console.warn('[Storage] DB init notice:', e);
    }

    // Ensure all modals are strictly hidden on load
    this.closeSaveGarmentModal();
    this.closeWardrobeModal();
    this.closeGarmentDetail();

    // Check Backend Server Status
    this.checkApiStatus();

    // Fetch Live Dashboard Weather
    this.fetchLiveWeather();

    // Default to Home view (camera is deferred until Scan tab is tapped)
    this.switchTab('home');
  }

  /**
   * Hydrates Lucide Icons
   */
  renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    } else {
      setTimeout(() => {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }, 150);
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // 3-Tab Bottom Navigation
    if (this.dom.tabHome) this.dom.tabHome.addEventListener('click', () => this.switchTab('home'));
    if (this.dom.tabScan) this.dom.tabScan.addEventListener('click', () => this.switchTab('scan'));
    if (this.dom.tabProfile) this.dom.tabProfile.addEventListener('click', () => this.switchTab('profile'));

    // Home Action: Start Camera Scan
    if (this.dom.btnHomeStartScan) {
      this.dom.btnHomeStartScan.addEventListener('click', () => this.switchTab('scan'));
    }

    // Home Action: Style Suggestion
    if (this.dom.btnStyleSuggestion) {
      this.dom.btnStyleSuggestion.addEventListener('click', () => this.toggleStyleSuggestion());
    }

    // Home Action: College Care Guide Navigation
    if (this.dom.cardOpenGuide) {
      this.dom.cardOpenGuide.addEventListener('click', () => this.openGuideView());
    }
    if (this.dom.btnGuideBack) {
      this.dom.btnGuideBack.addEventListener('click', () => this.closeGuideView());
    }

    // Scan Actions
    if (this.dom.btnScan) this.dom.btnScan.addEventListener('click', () => this.handleScanTag());
    if (this.dom.btnScanAgain) this.dom.btnScanAgain.addEventListener('click', () => this.resetScanner());
    if (this.dom.btnCloseResults) this.dom.btnCloseResults.addEventListener('click', () => this.dismissResultsSheet());
    if (this.dom.resultsDragHandle) this.dom.resultsDragHandle.addEventListener('click', () => this.dismissResultsSheet());

    // File Upload Action
    if (this.dom.btnUploadFile) {
      this.dom.btnUploadFile.addEventListener('click', () => {
        this.dom.tagFileInput?.click();
      });
    }

    if (this.dom.tagFileInput) {
      this.dom.tagFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const img = new Image();
        img.onload = async () => {
          const canvas = this.dom.captureCanvas;
          canvas.width = img.naturalWidth || 640;
          canvas.height = img.naturalHeight || 480;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.classList.remove('hidden');

          if (this.dom.videoFeed && !this.dom.videoFeed.classList.contains('hidden')) {
            try { this.dom.videoFeed.pause(); } catch (_) {}
          }

          await this.runInferenceOnCanvas(canvas);
        };
        img.src = URL.createObjectURL(file);
        this.dom.tagFileInput.value = '';
      });
    }

    // Backend Connection Status Indicator Click & Custom URL config
    if (this.dom.btnServerStatus) {
      this.dom.btnServerStatus.addEventListener('click', async () => {
        const health = await checkBackendHealth();
        if (health.online) {
          this.showToast(`CareTag Model Online (${health.classes_count || 86} classes)`);
        } else {
          const currentUrl = getCustomApiUrl() || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'https://' : 'http://localhost:8000');
          const newUrl = prompt(
            'CareTag Backend is currently offline or unreachable.\n\nEnter your deployed backend URL (e.g. https://caretag.onrender.com or your ngrok HTTPS URL):',
            currentUrl
          );
          if (newUrl !== null) {
            setCustomApiUrl(newUrl);
            await this.checkApiStatus(true);
          }
        }
      });
    }

    // Hardware Controls
    if (this.dom.btnTorch) this.dom.btnTorch.addEventListener('click', () => this.toggleTorch());
    if (this.dom.btnFlipCamera) this.dom.btnFlipCamera.addEventListener('click', () => this.flipCamera());
    if (this.dom.btnRequestCam) this.dom.btnRequestCam.addEventListener('click', () => this.startCamera());

    // Save to Wardrobe Triggers
    if (this.dom.btnSaveWardrobe) this.dom.btnSaveWardrobe.addEventListener('click', () => this.openSaveGarmentModal());
    if (this.dom.btnCancelSave) this.dom.btnCancelSave.addEventListener('click', () => this.closeSaveGarmentModal());
    if (this.dom.btnConfirmSave) this.dom.btnConfirmSave.addEventListener('click', () => this.handleConfirmSave());
    if (this.dom.inputGarmentNickname) {
      this.dom.inputGarmentNickname.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleConfirmSave();
      });
    }
    if (this.dom.modalSaveGarment) {
      this.dom.modalSaveGarment.addEventListener('click', (e) => {
        if (e.target === this.dom.modalSaveGarment) this.closeSaveGarmentModal();
      });
    }

    // Profile & Wardrobe Modal
    if (this.dom.btnProfileOpenCloset) this.dom.btnProfileOpenCloset.addEventListener('click', () => this.openWardrobeModal());
    if (this.dom.btnCloseWardrobeModal) this.dom.btnCloseWardrobeModal.addEventListener('click', () => this.closeWardrobeModal());
    if (this.dom.btnDismissCloset) this.dom.btnDismissCloset.addEventListener('click', () => this.closeWardrobeModal());
    if (this.dom.modalWardrobeCloset) {
      this.dom.modalWardrobeCloset.addEventListener('click', (e) => {
        if (e.target === this.dom.modalWardrobeCloset) this.closeWardrobeModal();
      });
    }

    // Detail Modal Controls
    if (this.dom.btnCloseDetail) this.dom.btnCloseDetail.addEventListener('click', () => this.closeGarmentDetail());
    if (this.dom.btnDismissDetail) this.dom.btnDismissDetail.addEventListener('click', () => this.closeGarmentDetail());
    if (this.dom.btnDeleteGarment) this.dom.btnDeleteGarment.addEventListener('click', () => this.handleDeleteGarment());
    if (this.dom.garmentDetailModal) {
      this.dom.garmentDetailModal.addEventListener('click', (e) => {
        if (e.target === this.dom.garmentDetailModal) this.closeGarmentDetail();
      });
    }

    // Copy advice button
    if (this.dom.btnCopyAdvice) {
      this.dom.btnCopyAdvice.addEventListener('click', () => this.copyCareInstructions());
    }
  }

  /**
   * Toggle Style Suggestion Accordion
   */
  toggleStyleSuggestion() {
    if (!this.dom.styleSuggestionBox) return;

    const isExpanded = this.dom.styleSuggestionBox.classList.toggle('is-expanded');
    if (isExpanded) {
      const suggestions = [
        'For a 30° overcast day, wear a breathable smart-casual polo, white leather sneakers, transparent frames, and a light musk.',
        'Lightweight linen shirt in charcoal, slim-tapered cotton trousers, and minimalist canvas slip-ons for warm overcast weather.',
        'Moisture-wicking merino blend tee with tailored stretch chinos and clean low-profile trainers.'
      ];
      const picked = suggestions[Math.floor(Math.random() * suggestions.length)];
      if (this.dom.styleSuggestionText) {
        this.dom.styleSuggestionText.textContent = picked;
      }
    }
  }

  /**
   * Switch between the 3 main views: Home, Scan, Profile
   */
  async switchTab(tabName) {
    this.currentTab = tabName;

    // Reset tab button active states
    this.dom.tabHome?.classList.remove('active');
    this.dom.tabScan?.classList.remove('active');
    this.dom.tabProfile?.classList.remove('active');

    // Hide all view containers
    this.dom.homeView?.classList.add('hidden');
    this.dom.scanView?.classList.add('hidden');
    this.dom.profileView?.classList.add('hidden');
    this.dom.guideView?.classList.add('hidden');

    if (tabName === 'home') {
      this.dom.tabHome?.classList.add('active');
      this.dom.homeView?.classList.remove('hidden');
      this.dom.headerScanControls?.classList.add('hidden');

      // Pause video to conserve battery/CPU
      if (this.dom.videoFeed && !this.dom.videoFeed.classList.contains('hidden')) {
        this.dom.videoFeed.pause();
      }

    } else if (tabName === 'scan') {
      this.dom.tabScan?.classList.add('active');
      this.dom.scanView?.classList.remove('hidden');
      this.dom.headerScanControls?.classList.remove('hidden');

      // Start camera if first time, or resume existing stream
      if (!this.hasCameraStarted) {
        await this.startCamera();
      } else if (this.state === AppState.STREAMING && !this.dom.videoFeed.classList.contains('hidden')) {
        this.dom.videoFeed.play().catch(e => console.log('Resume video notice:', e));
      }

    } else if (tabName === 'profile') {
      this.dom.tabProfile?.classList.add('active');
      this.dom.profileView?.classList.remove('hidden');
      this.dom.headerScanControls?.classList.add('hidden');

      if (this.dom.videoFeed && !this.dom.videoFeed.classList.contains('hidden')) {
        this.dom.videoFeed.pause();
      }

      await this.updateProfileStats();
    }

    this.renderIcons();
  }

  /**
   * Open the College Care Guide sub-view
   */
  openGuideView() {
    // Hide all other views
    this.dom.homeView?.classList.add('hidden');
    this.dom.scanView?.classList.add('hidden');
    this.dom.profileView?.classList.add('hidden');
    this.dom.guideView?.classList.remove('hidden');

    // Keep Home tab highlighted since Guide is a sub-page of Home
    this.dom.tabHome?.classList.add('active');
    this.dom.tabScan?.classList.remove('active');
    this.dom.tabProfile?.classList.remove('active');
    this.dom.headerScanControls?.classList.add('hidden');

    // Scroll guide view to top
    if (this.dom.guideView) {
      this.dom.guideView.scrollTop = 0;
    }

    this.renderIcons();
  }

  /**
   * Return from College Care Guide back to Home view
   */
  closeGuideView() {
    this.switchTab('home');
  }

  /**
   * Initialize Camera Stream
   * Requests environment facing camera with fallback
   */
  async startCamera() {
    this.stopCamera();
    this.setCameraStatusBanner(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[Camera] mediaDevices API not available. Activating synthetic preview fallback.');
      this.activateSyntheticFeed('Camera not supported in this browser.');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: this.currentFacingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.onStreamAcquired(stream);
      this.hasCameraStarted = true;
    } catch (err) {
      console.warn('[Camera] Trying generic video constraint:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.onStreamAcquired(fallbackStream);
        this.hasCameraStarted = true;
      } catch (fallbackErr) {
        console.error('[Camera] Access denied or unavailable:', fallbackErr);
        this.activateSyntheticFeed('Running in simulated tag demo mode.');
        this.setCameraStatusBanner(true, 'Camera access required for live feed.');
        this.hasCameraStarted = true;
      }
    }
  }

  onStreamAcquired(stream) {
    this.mediaStream = stream;
    this.dom.videoFeed.srcObject = stream;
    this.dom.videoFeed.classList.remove('hidden');
    this.dom.syntheticFeed.classList.add('hidden');
    this.setCameraStatusBanner(false);

    this.videoTrack = stream.getVideoTracks()[0];
    this.checkTorchCapability();

    this.dom.videoFeed.onloadedmetadata = () => {
      if (this.currentTab === 'scan') {
        this.dom.videoFeed.play().catch(e => console.log('Autoplay notice:', e));
      }
      this.state = AppState.STREAMING;
      this.updateHudState();
    };
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
      this.videoTrack = null;
    }
  }

  activateSyntheticFeed(reason) {
    this.dom.videoFeed.classList.add('hidden');
    this.dom.syntheticFeed.classList.remove('hidden');
    this.state = AppState.STREAMING;
    this.updateHudState();
    console.log('[Camera Fallback]', reason);
  }

  checkTorchCapability() {
    if (this.videoTrack && typeof this.videoTrack.getCapabilities === 'function') {
      const capabilities = this.videoTrack.getCapabilities();
      this.hasTorchCapability = Boolean(capabilities.torch);
      if (this.hasTorchCapability) {
        this.dom.btnTorch.classList.remove('opacity-50');
      } else {
        this.dom.btnTorch.classList.add('opacity-50');
      }
    } else {
      this.hasTorchCapability = false;
      this.dom.btnTorch.classList.add('opacity-50');
    }
  }

  async toggleTorch() {
    if (!this.hasTorchCapability || !this.videoTrack) {
      this.showToast('Flashlight not supported on this device');
      return;
    }

    try {
      this.torchEnabled = !this.torchEnabled;
      await this.videoTrack.applyConstraints({
        advanced: [{ torch: this.torchEnabled }]
      });

      if (this.torchEnabled) {
        this.dom.btnTorch.classList.add('text-neon');
        this.showToast('Torch enabled');
      } else {
        this.dom.btnTorch.classList.remove('text-neon');
        this.showToast('Torch disabled');
      }
    } catch (err) {
      console.error('[Torch] Error toggling torch:', err);
      this.showToast('Could not toggle torch');
    }
  }

  async flipCamera() {
    this.currentFacingMode = (this.currentFacingMode === 'environment') ? 'user' : 'environment';
    await this.startCamera();
    this.showToast(`Switched to ${this.currentFacingMode === 'environment' ? 'Rear' : 'Front'} Camera`);
  }

  setCameraStatusBanner(visible, text = '') {
    if (!this.dom.cameraStatusBanner) return;
    if (visible) {
      this.dom.cameraStatusText.textContent = text;
      this.dom.cameraStatusBanner.classList.remove('hidden');
    } else {
      this.dom.cameraStatusBanner.classList.add('hidden');
    }
  }

  /**
   * Scan Tag Workflow
   */
  async handleScanTag() {
    if (this.state === AppState.INFERENCING) return;
    this.freezeFrame();
    await this.runInferenceOnCanvas(this.dom.captureCanvas);
  }

  /**
   * Runs inference on the given canvas element
   */
  async runInferenceOnCanvas(canvas) {
    if ('vibrate' in navigator) {
      navigator.vibrate(40);
    }

    this.state = AppState.INFERENCING;
    this.updateHudState();

    // Cache image preview for wardrobe save
    try {
      this.currentCapturedBase64 = canvas.toDataURL('image/jpeg', 0.85);
    } catch (_) {}

    // Show Loading Overlay
    this.dom.loadingOverlay.classList.remove('hidden');
    this.dom.inferenceStepTitle.textContent = 'CareTag AI Inference';
    this.dom.inferenceStepDesc.textContent = 'Analyzing symbols with YOLO model...';

    try {
      // Run Inference via real FastAPI backend
      const data = await detectLaundrySymbols(canvas);
      this.lastDetectedResults = (data && data.symbols) ? data.symbols : data;
      this.lastDetectedScores = (data && data.scores) ? data.scores : null;

      // Populate & Present Results
      this.populateResultsUI(data);
      
      setTimeout(() => {
        this.dom.loadingOverlay.classList.add('hidden');
        this.showResultsSheet();
        this.state = AppState.RESULTS;
        this.updateHudState();
      }, 300);

    } catch (err) {
      console.error('[Inference] Error during symbol detection:', err);
      this.dom.loadingOverlay.classList.add('hidden');
      this.showToast(err.message || 'Detection failed');
      this.resetScanner();
    }
  }

  freezeFrame() {
    const video = this.dom.videoFeed;
    const canvas = this.dom.captureCanvas;

    if (!video.classList.contains('hidden') && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      video.pause();
      canvas.classList.remove('hidden');
    } else {
      // In synthetic mode, render care tag onto canvas
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      this.drawSyntheticCareTag(ctx, canvas.width, canvas.height);
      canvas.classList.remove('hidden');
    }
  }

  drawSyntheticCareTag(ctx, width, height) {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    const tagW = Math.min(width * 0.75, 420);
    const tagH = Math.min(height * 0.65, 260);
    const tagX = (width - tagW) / 2;
    const tagY = (height - tagH) / 2;

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(tagX, tagY, tagW, tagH, 12);
    } else {
      ctx.rect(tagX, tagY, tagW, tagH);
    }
    ctx.fill();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('100% COTTON', width / 2, tagY + 40);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('CARE INSTRUCTIONS / ISO 3758', width / 2, tagY + 65);

    const symY = tagY + 120;
    const symSpacing = tagW / 5;
    const startX = tagX + symSpacing * 0.6;

    // Washtub 30
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX - 18, symY - 10);
    ctx.lineTo(startX + 18, symY - 10);
    ctx.lineTo(startX + 14, symY + 16);
    ctx.lineTo(startX - 14, symY + 16);
    ctx.closePath();
    ctx.stroke();
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('30°', startX, symY + 8);

    // Triangle crossed
    const s2X = startX + symSpacing;
    ctx.beginPath();
    ctx.moveTo(s2X, symY - 14);
    ctx.lineTo(s2X + 16, symY + 16);
    ctx.lineTo(s2X - 16, symY + 16);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s2X - 14, symY + 14);
    ctx.lineTo(s2X + 14, symY - 12);
    ctx.moveTo(s2X + 14, symY + 14);
    ctx.lineTo(s2X - 14, symY - 12);
    ctx.stroke();

    // Square circle (Tumble dry)
    const s3X = startX + symSpacing * 2;
    ctx.strokeRect(s3X - 16, symY - 14, 32, 30);
    ctx.beginPath();
    ctx.arc(s3X, symY + 1, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s3X, symY + 1, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Iron
    const s4X = startX + symSpacing * 3;
    ctx.beginPath();
    ctx.moveTo(s4X - 16, symY + 12);
    ctx.lineTo(s4X + 16, symY + 12);
    ctx.bezierCurveTo(s4X + 18, symY, s4X + 10, symY - 12, s4X, symY - 12);
    ctx.lineTo(s4X - 16, symY - 12);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s4X - 2, symY + 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText('MADE IN PORTUGAL • RN 98321', width / 2, tagY + tagH - 24);
  }

  async checkApiStatus(showToastOnDemand = false) {
    try {
      const health = await checkBackendHealth();
      if (health.online) {
        if (this.dom.backendStatusDot) {
          this.dom.backendStatusDot.className = 'w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50';
          this.dom.btnServerStatus?.setAttribute('title', `CareTag Model: Online (${health.classes_count || 86} classes)`);
        }
        if (showToastOnDemand) {
          this.showToast(`CareTag Model Online (${health.classes_count || 86} classes)`);
        }
      } else {
        if (this.dom.backendStatusDot) {
          this.dom.backendStatusDot.className = 'w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50';
          this.dom.btnServerStatus?.setAttribute('title', 'Backend Offline (Port 8000)');
        }
        if (showToastOnDemand) {
          this.showToast('Backend offline. Please start uvicorn on port 8000.');
        }
      }
    } catch (_) {
      if (this.dom.backendStatusDot) {
        this.dom.backendStatusDot.className = 'w-3 h-3 rounded-full bg-amber-500';
      }
    }
  }

  resetScanner() {
    this.dismissResultsSheet();
    this.dom.captureCanvas.classList.add('hidden');

    if (!this.dom.videoFeed.classList.contains('hidden') && this.currentTab === 'scan') {
      this.dom.videoFeed.play().catch(e => console.log('Resume video error:', e));
    }

    this.state = AppState.STREAMING;
    this.updateHudState();
  }

  showResultsSheet() {
    this.dom.resultsSheet.classList.remove('hidden-sheet');
    this.dom.resultsSheet.classList.add('visible-sheet');
    this.renderIcons();
  }

  dismissResultsSheet() {
    this.dom.resultsSheet.classList.remove('visible-sheet');
    this.dom.resultsSheet.classList.add('hidden-sheet');
  }

  /**
   * Renders the detected symbol cards into the bottom sheet
   */
  /**
   * Renders the detected symbol cards into the bottom sheet and updates dynamic metrics
   */
  populateResultsUI(data) {
    this.dom.resultsCardsContainer.innerHTML = '';

    // Locate the DOM elements for the Sustainability and Comfort metrics in the UI
    const sustPct = this.dom.sustainabilityScorePct 
      || document.getElementById('sustainability-score-pct') 
      || document.querySelectorAll('.metric-progress-track')[0]?.parentElement?.querySelectorAll('span')[1];
    const sustBar = this.dom.sustainabilityProgressBar 
      || document.getElementById('sustainability-progress-bar') 
      || document.querySelectorAll('.metric-progress-fill')[0];
    const sustLabel = this.dom.sustainabilityScoreLabel 
      || document.getElementById('sustainability-score-label') 
      || document.querySelectorAll('.metric-progress-track')[0]?.parentElement?.querySelectorAll('span')[0];

    const comfPct = this.dom.comfortScorePct 
      || document.getElementById('comfort-score-pct') 
      || document.querySelectorAll('.metric-progress-track')[1]?.parentElement?.querySelectorAll('span')[1];
    const comfBar = this.dom.comfortProgressBar 
      || document.getElementById('comfort-progress-bar') 
      || document.querySelectorAll('.metric-progress-fill')[1];
    const comfLabel = this.dom.comfortScoreLabel 
      || document.getElementById('comfort-score-label') 
      || document.querySelectorAll('.metric-progress-track')[1]?.parentElement?.querySelectorAll('span')[0];

    // Dynamically update the text values (e.g. "85%") and the CSS width of the progress bars using data.scores
    if (data && data.scores) {
      const sustVal = typeof data.scores.sustainability === 'number'
        ? Math.max(0, Math.min(100, Math.round(data.scores.sustainability)))
        : 85;
      const comfVal = typeof data.scores.comfort === 'number'
        ? Math.max(0, Math.min(100, Math.round(data.scores.comfort)))
        : 90;

      if (sustPct) sustPct.textContent = `${sustVal}%`;
      if (sustBar) sustBar.style.width = `${sustVal}%`;
      if (sustLabel) sustLabel.textContent = `SUSTAINABILITY ${sustVal}/100`;

      if (comfPct) comfPct.textContent = `${comfVal}%`;
      if (comfBar) comfBar.style.width = `${comfVal}%`;
      if (comfLabel) comfLabel.textContent = `COMFORT ${comfVal}/100`;
    }

    const symbols = (data && data.symbols) ? data.symbols : (Array.isArray(data) ? data : []);

    if (!symbols || symbols.length === 0) {
      this.dom.resultsCardsContainer.innerHTML = `
        <div class="p-6 text-center text-muted">
          <p class="text-sm">No laundry symbols identified.</p>
          <p class="text-xs text-neutral-500 mt-1">Ensure the care tag is clearly lit and flat within the viewfinder.</p>
        </div>`;
      this.dom.resultsSummaryText.textContent = 'No clear symbols detected';
      return;
    }

    const summaryPieces = symbols.map(r => {
      if (r.category === 'Washing') return r.instruction.replace('Machine wash ', '').replace('only', '');
      if (r.category === 'Bleaching') return r.instruction.toLowerCase().includes('do not') ? 'No Bleach' : 'Bleach OK';
      if (r.category === 'Drying') return r.instruction.replace('Tumble dry ', '').replace('Do not tumble dry', 'No Tumble Dry');
      return r.instruction;
    });
    this.dom.resultsSummaryText.textContent = summaryPieces.slice(0, 3).join(' • ');

    // Symbol rendering loop: iterate over data.symbols instead of data
    const symbolList = (data && data.symbols) ? data.symbols : symbols;
    symbolList.forEach((item) => {
      const family = SYMBOL_FAMILIES[item.category] || {
        badgeColor: 'surface-secondary text-neutral-300',
        iconColor: '#FFFFFF'
      };

      const confidencePct = Math.round(item.confidence * 100);
      const symbolSvg = getSymbolSvg(item.symbol, 32);

      const card = document.createElement('div');
      card.className = 'p-3.5 rounded-2xl surface-card flex items-start space-x-3.5';

      card.innerHTML = `
        <div class="w-12 h-12 rounded-xl surface-secondary flex items-center justify-center shrink-0 text-white">
          ${symbolSvg}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full surface-secondary text-neutral-300">
              ${item.category}
            </span>

            <span class="text-[10px] font-mono px-2 py-0.5 rounded surface-secondary text-neon font-bold flex items-center space-x-1">
              <span>${confidencePct}%</span>
              <span class="text-[8px] text-muted">MATCH</span>
            </span>
          </div>

          <h4 class="text-xs font-bold text-white mt-1.5 leading-snug tracking-tight font-sans">
            ${item.instruction}
          </h4>

          <div class="mt-1 flex items-center space-x-2 text-[10px] text-muted font-mono">
            <span>ISO: <span class="text-neutral-300">${item.symbol}</span></span>
          </div>
        </div>
      `;

      this.dom.resultsCardsContainer.appendChild(card);
    });

    this.renderIcons();
  }

  /**
   * Save to Wardrobe Modal Workflow
   */
  openSaveGarmentModal() {
    if (!this.lastDetectedResults || this.lastDetectedResults.length === 0) {
      this.showToast('Scan a garment first before saving');
      return;
    }

    this.currentCapturedBase64 = this.getFrameBase64();
    this.dom.inputGarmentNickname.value = 'Cotton T-Shirt';

    if (this.dom.modalSaveGarment) {
      this.dom.modalSaveGarment.style.display = 'flex';
      this.dom.modalSaveGarment.classList.remove('modal-hidden');
      this.dom.modalSaveGarment.classList.add('modal-visible');
    }
    setTimeout(() => this.dom.inputGarmentNickname?.focus(), 150);
  }

  closeSaveGarmentModal() {
    if (this.dom.modalSaveGarment) {
      this.dom.modalSaveGarment.style.display = 'none';
      this.dom.modalSaveGarment.classList.remove('modal-visible');
      this.dom.modalSaveGarment.classList.add('modal-hidden');
    }
  }

  async handleConfirmSave() {
    const nickname = this.dom.inputGarmentNickname.value.trim() || 'Garment Item';
    
    const garmentData = {
      nickname: nickname,
      image_base64: this.currentCapturedBase64 || this.createSyntheticGarmentThumbnail(nickname),
      care_rules: (this.lastDetectedResults || []).map(r => ({
        category: r.category,
        instruction: r.instruction,
        symbol: r.symbol
      })),
      date_added: new Date().toISOString()
    };

    try {
      await saveGarment(garmentData);
      this.closeSaveGarmentModal();
      this.showToast(`Saved "${nickname}" to Wardrobe`);
      await this.updateProfileStats();
    } catch (err) {
      console.error('[Storage] Error saving garment:', err);
      this.showToast('Could not save: ' + err.message);
    }
  }

  getFrameBase64() {
    const canvas = this.dom.captureCanvas;
    if (canvas && canvas.width > 0 && !canvas.classList.contains('hidden')) {
      try {
        return canvas.toDataURL('image/jpeg', 0.82);
      } catch (e) {
        console.warn('Canvas toDataURL notice:', e);
      }
    }
    return this.createSyntheticGarmentThumbnail();
  }

  createSyntheticGarmentThumbnail(name = 'Garment') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <rect width="100%" height="100%" fill="#1C1C1E"/>
      <g fill="none" stroke="#4ade80" stroke-width="2" opacity="0.8">
        <path d="M80 80 L150 40 L220 80 L200 240 L100 240 Z"/>
        <circle cx="150" cy="140" r="28"/>
      </g>
      <text x="150" y="270" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF" text-anchor="middle">CARE TAG</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  /**
   * Wardrobe Closet Modal (Opened from Profile)
   */
  async openWardrobeModal() {
    try {
      const garments = await getAllGarments();
      this.dom.archiveCountBadge.textContent = `${garments.length} Items`;
      this.dom.archiveGrid.innerHTML = '';

      if (garments.length === 0) {
        this.dom.archiveGrid.classList.add('hidden');
        this.dom.archiveEmptyState.classList.remove('hidden');
      } else {
        this.dom.archiveEmptyState.classList.add('hidden');
        this.dom.archiveGrid.classList.remove('hidden');

        garments.forEach(garment => {
          const card = document.createElement('div');
          card.className = 'surface-card rounded-2xl p-3 flex flex-col cursor-pointer active:opacity-80 transition-opacity';
          
          const dateStr = garment.date_added 
            ? new Date(garment.date_added).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : 'Saved';

          card.innerHTML = `
            <div class="w-full aspect-square rounded-xl overflow-hidden bg-black mb-2 flex items-center justify-center relative">
              <img src="${garment.image_base64}" alt="${garment.nickname}" class="w-full h-full object-cover">
              <span class="absolute bottom-1 right-1 text-[8px] font-mono px-1.5 py-0.5 rounded surface-secondary text-neutral-400">
                ${dateStr}
              </span>
            </div>
            <h4 class="text-xs font-bold text-white tracking-tight truncate">${garment.nickname}</h4>
          `;

          card.addEventListener('click', () => {
            this.closeWardrobeModal();
            this.openGarmentDetail(garment.id);
          });
          this.dom.archiveGrid.appendChild(card);
        });
      }

      if (this.dom.modalWardrobeCloset) {
        this.dom.modalWardrobeCloset.style.display = 'flex';
        this.dom.modalWardrobeCloset.classList.remove('modal-hidden');
        this.dom.modalWardrobeCloset.classList.add('modal-visible');
      }
      this.renderIcons();
    } catch (err) {
      console.error('[Wardrobe] Error loading closet:', err);
    }
  }

  closeWardrobeModal() {
    if (this.dom.modalWardrobeCloset) {
      this.dom.modalWardrobeCloset.style.display = 'none';
      this.dom.modalWardrobeCloset.classList.remove('modal-visible');
      this.dom.modalWardrobeCloset.classList.add('modal-hidden');
    }
  }

  /**
   * Opens the Garment Detail Modal
   */
  async openGarmentDetail(id) {
    try {
      const garment = await getGarmentById(id);
      if (!garment) return;

      this.currentDetailGarmentId = garment.id;

      this.dom.detailImage.src = garment.image_base64;
      this.dom.detailNickname.textContent = garment.nickname;
      this.dom.detailDate.textContent = `Added ${new Date(garment.date_added).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;

      this.dom.detailRulesList.innerHTML = '';
      (garment.care_rules || []).forEach(rule => {
        const symbolSvg = getSymbolSvg(rule.symbol, 26);

        const row = document.createElement('div');
        row.className = 'p-2.5 rounded-xl surface-secondary flex items-center space-x-3';
        row.innerHTML = `
          <div class="w-9 h-9 rounded-lg bg-black flex items-center justify-center text-white shrink-0">
            ${symbolSvg}
          </div>
          <div class="flex-1 min-w-0">
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded surface-card text-neutral-300">${rule.category}</span>
            <p class="text-xs font-semibold text-white mt-0.5 leading-snug">${rule.instruction}</p>
          </div>
        `;
        this.dom.detailRulesList.appendChild(row);
      });

      if (this.dom.garmentDetailModal) {
        this.dom.garmentDetailModal.style.display = 'flex';
        this.dom.garmentDetailModal.classList.remove('modal-hidden');
        this.dom.garmentDetailModal.classList.add('modal-visible');
      }
      this.renderIcons();

    } catch (err) {
      console.error('[Detail] Error loading garment detail:', err);
    }
  }

  closeGarmentDetail() {
    if (this.dom.garmentDetailModal) {
      this.dom.garmentDetailModal.style.display = 'none';
      this.dom.garmentDetailModal.classList.remove('modal-visible');
      this.dom.garmentDetailModal.classList.add('modal-hidden');
    }
    this.currentDetailGarmentId = null;
  }

  async handleDeleteGarment() {
    if (!this.currentDetailGarmentId) return;

    try {
      await deleteGarment(this.currentDetailGarmentId);
      this.closeGarmentDetail();
      this.showToast('Removed garment from wardrobe');
      await this.updateProfileStats();
    } catch (err) {
      console.error('[Detail] Delete error:', err);
      this.showToast('Could not delete item');
    }
  }

  async updateProfileStats() {
    try {
      const garments = await getAllGarments();
      if (this.dom.profileClosetCount) {
        this.dom.profileClosetCount.textContent = garments.length;
      }
    } catch (e) {
      console.warn('Profile stats update notice:', e);
    }
  }

  updateHudState() {
    if (!this.dom.hudStatusHint) return;

    if (this.state === AppState.STREAMING) {
      this.dom.hudStatusHint.textContent = 'Hold steady in frame';
      this.dom.hudStatusHint.className = 'px-3 py-1 rounded-full text-xs font-medium surface-secondary text-neutral-300';
    } else if (this.state === AppState.INFERENCING) {
      this.dom.hudStatusHint.textContent = 'Analyzing tag frame...';
      this.dom.hudStatusHint.className = 'px-3 py-1 rounded-full text-xs font-medium surface-secondary text-neon';
    } else if (this.state === AppState.RESULTS) {
      this.dom.hudStatusHint.textContent = 'Analysis complete';
      this.dom.hudStatusHint.className = 'px-3 py-1 rounded-full text-xs font-medium surface-secondary text-neon';
    }
  }

  async copyCareInstructions() {
    if (!this.lastDetectedResults || this.lastDetectedResults.length === 0) {
      this.showToast('No instructions to copy');
      return;
    }

    const textList = this.lastDetectedResults
      .map(r => `• [${r.category}] ${r.instruction}`)
      .join('\n');

    const scores = this.lastDetectedScores || { sustainability: 85, comfort: 90 };
    const fullText = `CareTag - Garment Care Guide:\n${textList}\n\nSustainability: ${scores.sustainability}/100 | Comfort: ${scores.comfort}/100\nISO 3758 Compliant.`;

    try {
      await navigator.clipboard.writeText(fullText);
      this.showToast('Care instructions copied');
    } catch (e) {
      console.warn('Clipboard write notice:', e);
      this.showToast('Instructions copied');
    }
  }

  showToast(message) {
    const toast = this.dom.toast;
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  async fetchLiveWeather() {
    return await fetchLiveWeather();
  }
}

/**
 * Fetches live ambient weather metrics from Open-Meteo for Ghaziabad
 * and updates the Home dashboard weather widget
 */
export async function fetchLiveWeather() {
  const tempEl = document.getElementById('dashboard-temp');
  const condEl = document.getElementById('dashboard-condition');

  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=28.6692&longitude=77.4538&current=temperature_2m,relative_humidity_2m';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API returned status: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current || {};
    const temp = current.temperature_2m;
    const humidity = current.relative_humidity_2m;

    if (temp != null && tempEl) {
      tempEl.textContent = `${Math.round(temp)}°`;
    }

    if (condEl) {
      if (humidity != null && humidity > 60) {
        condEl.textContent = 'Warm and humid conditions';
      } else {
        condEl.textContent = 'Clear and dry conditions';
      }
    }

    return { temp, humidity };
  } catch (err) {
    console.warn('[Weather] Could not fetch live weather:', err);
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.fetchLiveWeather = fetchLiveWeather;
}

function bootCareTagApp() {
  if (!window.careTagApp) {
    window.careTagApp = new GarmentScannerApp();
  }
  fetchLiveWeather();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootCareTagApp);
} else {
  bootCareTagApp();
}
