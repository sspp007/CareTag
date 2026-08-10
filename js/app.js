/**
 * CareTag - Smart Garment Scanner
 * Flat Native App Architecture (PWA Standalone: Home, Scan, Profile)
 */

import { detectLaundrySymbols } from './api.js';
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

    // Default to Home view (camera is deferred until Scan tab is tapped)
    this.switchTab('home');
  }

  /**
   * Hydrates Lucide Icons
   */
  renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
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

    if ('vibrate' in navigator) {
      navigator.vibrate(40);
    }

    // Step 1: Capture Frame & Pause Camera
    this.freezeFrame();
    this.state = AppState.INFERENCING;
    this.updateHudState();

    // Step 2: Show Loading Overlay
    this.dom.loadingOverlay.classList.remove('hidden');
    this.dom.inferenceStepTitle.textContent = 'Detecting Care Symbols';
    this.dom.inferenceStepDesc.textContent = 'Analyzing tag frame...';

    try {
      // Step 3: Run Inference (Mock or FastAPI)
      const results = await detectLaundrySymbols(this.dom.captureCanvas);
      this.lastDetectedResults = results;

      // Step 4: Populate & Present Results
      this.populateResultsUI(results);
      
      setTimeout(() => {
        this.dom.loadingOverlay.classList.add('hidden');
        this.showResultsSheet();
        this.state = AppState.RESULTS;
        this.updateHudState();
      }, 350);

    } catch (err) {
      console.error('[Inference] Error during symbol detection:', err);
      this.dom.loadingOverlay.classList.add('hidden');
      this.showToast('Detection error: ' + err.message);
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
  populateResultsUI(results) {
    this.dom.resultsCardsContainer.innerHTML = '';

    if (!results || results.length === 0) {
      this.dom.resultsCardsContainer.innerHTML = `
        <div class="p-6 text-center text-muted">
          <p class="text-sm">No laundry symbols identified.</p>
          <p class="text-xs text-neutral-500 mt-1">Ensure the care tag is clearly lit and flat within the viewfinder.</p>
        </div>`;
      this.dom.resultsSummaryText.textContent = 'No clear symbols detected';
      return;
    }

    const summaryPieces = results.map(r => {
      if (r.category === 'Washing') return r.instruction.replace('Machine wash ', '').replace('only', '');
      if (r.category === 'Bleaching') return r.instruction.toLowerCase().includes('do not') ? 'No Bleach' : 'Bleach OK';
      if (r.category === 'Drying') return r.instruction.replace('Tumble dry ', '').replace('Do not tumble dry', 'No Tumble Dry');
      return r.instruction;
    });
    this.dom.resultsSummaryText.textContent = summaryPieces.slice(0, 3).join(' • ');

    results.forEach((item) => {
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

    const fullText = `CareTag - Garment Care Guide:\n${textList}\n\nSustainability: 85/100 | Comfort: 90/100\nISO 3758 Compliant.`;

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
}

// Instantiate when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.careTagApp = new GarmentScannerApp();
});
