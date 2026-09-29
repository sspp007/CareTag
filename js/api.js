/**
 * API Client Module for YOLOv8 Garment Care Symbol Detection
 * 
 * Communicates with FastAPI backend running the YOLOv8 model (`best.pt`).
 */

export const USE_MOCK_API = false;

// Optional production backend URL (e.g., 'https://caretag-backend.onrender.com')
export const PRODUCTION_API_URL = '';

/**
 * Dynamically resolves the API base URL across Localhost, Vercel, and custom deployments.
 */
export const getBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000';

  // 1. User-configured override stored in localStorage
  const customUrl = localStorage.getItem('caretag_api_url');
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }

  // 2. Global window configuration (e.g., set via script tag or Vercel env)
  if (window.CARETAG_API_URL && typeof window.CARETAG_API_URL === 'string') {
    return window.CARETAG_API_URL.trim().replace(/\/+$/, '');
  }

  // 3. Static production URL if defined
  if (PRODUCTION_API_URL && PRODUCTION_API_URL.trim()) {
    return PRODUCTION_API_URL.trim().replace(/\/+$/, '');
  }

  // 4. Same-origin if served by FastAPI on port 8000
  if (window.location && window.location.port === '8000') {
    return window.location.origin;
  }

  // 5. Localhost fallback
  if (window.location && ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname)) {
    return 'http://localhost:8000';
  }

  // 6. Remote deployment fallback
  return window.location.protocol === 'https:' ? 'https://localhost:8000' : 'http://localhost:8000';
};

export const API_BASE_URL = getBaseUrl();
export const API_ENDPOINT = `${API_BASE_URL}/api/v1/detect-symbols`;

export function setCustomApiUrl(url) {
  if (!url || !url.trim()) {
    localStorage.removeItem('caretag_api_url');
  } else {
    localStorage.setItem('caretag_api_url', url.trim().replace(/\/+$/, ''));
  }
}

export function getCustomApiUrl() {
  return localStorage.getItem('caretag_api_url') || '';
}

/**
 * Standard Expected Mock Data for fallback/testing
 */
export const DEFAULT_MOCK_DATA = [
  { "symbol": "washtub_30", "category": "Washing", "instruction": "Machine wash cold (max 30°C)", "confidence": 0.98 },
  { "symbol": "triangle_crossed", "category": "Bleaching", "instruction": "Do not bleach", "confidence": 0.95 },
  { "symbol": "square_circle_1dot", "category": "Drying", "instruction": "Tumble dry low heat", "confidence": 0.91 }
];

export const MOCK_SCENARIOS = {
  default: {
    name: 'Everyday Cotton Blend',
    description: '30°C Cold Wash, Do Not Bleach, Low Tumble Dry',
    data: DEFAULT_MOCK_DATA
  },
  delicate_silk: {
    name: 'Delicate Silk Blouse',
    description: 'Hand Wash Only, No Bleach, Line Dry, Cool Iron',
    data: [
      { "symbol": "washtub_hand", "category": "Washing", "instruction": "Hand wash only (max 30°C)", "confidence": 0.97 },
      { "symbol": "triangle_crossed", "category": "Bleaching", "instruction": "Do not bleach", "confidence": 0.99 },
      { "symbol": "square_crossed", "category": "Drying", "instruction": "Do not tumble dry (drip dry)", "confidence": 0.94 },
      { "symbol": "iron_1dot", "category": "Ironing", "instruction": "Iron low heat (max 110°C, no steam)", "confidence": 0.92 }
    ]
  },
  wool_suit: {
    name: 'Wool Blend Formal Suit',
    description: 'Dry Clean Only, Do Not Wash, Iron Medium',
    data: [
      { "symbol": "circle_p", "category": "Professional Care", "instruction": "Dry clean with PCE only", "confidence": 0.96 },
      { "symbol": "washtub_hand", "category": "Washing", "instruction": "Do not machine wash", "confidence": 0.93 },
      { "symbol": "triangle_crossed", "category": "Bleaching", "instruction": "Do not bleach", "confidence": 0.98 },
      { "symbol": "iron_1dot", "category": "Ironing", "instruction": "Steam iron low temperature", "confidence": 0.89 }
    ]
  }
};

let activeScenarioKey = 'default';

export function setActiveScenario(scenarioKey) {
  if (MOCK_SCENARIOS[scenarioKey]) {
    activeScenarioKey = scenarioKey;
  }
}

export function getActiveScenario() {
  return activeScenarioKey;
}

export function getApiEndpoint() {
  return `${getBaseUrl()}/api/v1/detect-symbols`;
}

export const API_ENDPOINT = getApiEndpoint();

/**
 * Health check helper to verify connection with the YOLO backend
 */
export async function checkBackendHealth() {
  const baseUrl = getBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v1/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      return { online: true, ...data };
    }
    return { online: false, status: res.status };
  } catch (err) {
    return { online: false, error: err.message, url: baseUrl };
  }
}

/**
 * Convert diverse inputs (Canvas, DataURL, Blob, Image) into a binary JPEG Blob
 */
async function payloadToBlob(payload) {
  if (!payload) {
    throw new Error('No image frame provided for tag detection.');
  }

  // Already a Blob or File
  if (payload instanceof Blob) {
    return payload;
  }

  // HTMLCanvasElement
  if (typeof HTMLCanvasElement !== 'undefined' && payload instanceof HTMLCanvasElement) {
    const width = payload.width || 640;
    const height = payload.height || 480;
    if (payload.width === 0 || payload.height === 0) {
      payload.width = width;
      payload.height = height;
    }
    return new Promise((resolve, reject) => {
      payload.toBlob((blob) => {
        if (blob && blob.size > 0) {
          resolve(blob);
        } else {
          // If toBlob failed, try dataURL fallback
          try {
            const dataUrl = payload.toDataURL('image/jpeg', 0.92);
            fetch(dataUrl).then(r => r.blob()).then(resolve).catch(reject);
          } catch (e) {
            reject(new Error('Canvas image conversion failed'));
          }
        }
      }, 'image/jpeg', 0.92);
    });
  }

  // Base64 Data URL string
  if (typeof payload === 'string' && payload.startsWith('data:image')) {
    const res = await fetch(payload);
    return await res.blob();
  }

  // HTMLImageElement
  if (typeof HTMLImageElement !== 'undefined' && payload instanceof HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = payload.naturalWidth || payload.width || 640;
    canvas.height = payload.naturalHeight || payload.height || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(payload, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }

  throw new Error('Unsupported image format for detection payload.');
}

/**
 * Primary Detection Function
 * @param {HTMLCanvasElement|Blob|File|string} imagePayload - Image captured from camera or canvas
 * @returns {Promise<Array<{symbol: string, category: string, instruction: string, confidence: number}>>}
 */
export async function detectLaundrySymbols(imagePayload) {
  if (USE_MOCK_API) {
    return simulateTensorRTInference();
  }

  try {
    return await callFastApiBackend(imagePayload);
  } catch (err) {
    console.warn('[API] Real model inference failed, checking fallback:', err);
    throw err;
  }
}

/**
 * Simulates YOLOv8 inference with 1000ms delay (used when USE_MOCK_API = true)
 */
async function simulateTensorRTInference() {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const scenario = MOCK_SCENARIOS[activeScenarioKey] || MOCK_SCENARIOS.default;
  return JSON.parse(JSON.stringify(scenario.data));
}

/**
 * Production-ready FastAPI integration
 * Sends multipart/form-data with image file to YOLOv8 inference backend
 */
async function callFastApiBackend(imagePayload) {
  const imageBlob = await payloadToBlob(imagePayload);
  const endpoint = getApiEndpoint();

  // Check Mixed Content issue on HTTPS deployments (Vercel)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && endpoint.startsWith('http://')) {
    throw new Error(
      `Mixed Content Blocked: You are browsing via HTTPS on Vercel, but attempting to reach an insecure HTTP backend (${endpoint}). Please deploy your backend to an HTTPS host (Render, Railway, or Hugging Face) or configure a secure HTTPS tunnel.`
    );
  }

  const formData = new FormData();
  formData.append('file', imageBlob, 'garment_tag.jpg');
  formData.append('confidence_threshold', '0.20');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let detailMsg = response.statusText;
      try {
        const errorJson = await response.json();
        detailMsg = errorJson.detail || detailMsg;
      } catch (_) {}
      throw new Error(`Model API error (${response.status}): ${detailMsg}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Inference request timed out (20s) connecting to ${endpoint}.`);
    }
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error(`Cannot reach CareTag backend at ${endpoint}. Please verify your backend server is deployed and running.`);
    }
    throw err;
  }
}
