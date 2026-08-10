/**
 * API Client Module for YOLOv8 / TensorRT Laundry Symbol Detection
 * 
 * Modular architecture:
 * Currently returns mock data simulating TensorRT inference (1000ms delay).
 * When ready, switch `USE_MOCK_API = false` and set `API_ENDPOINT` to your FastAPI server.
 */

export const USE_MOCK_API = true;
export const API_ENDPOINT = 'http://localhost:8000/api/v1/detect-symbols';

/**
 * Standard Expected Mock Data matching user specification
 */
export const DEFAULT_MOCK_DATA = [
  { "symbol": "washtub_30", "category": "Washing", "instruction": "Machine wash cold (max 30°C)", "confidence": 0.98 },
  { "symbol": "triangle_crossed", "category": "Bleaching", "instruction": "Do not bleach", "confidence": 0.95 },
  { "symbol": "square_circle_1dot", "category": "Drying", "instruction": "Tumble dry low heat", "confidence": 0.91 }
];

/**
 * Alternative mock scenarios for testing diverse garment tag combinations
 */
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

/**
 * Primary Detection Function
 * @param {Blob|ImageData|string} imagePayload - Image captured from camera canvas
 * @returns {Promise<Array<{symbol: string, category: string, instruction: string, confidence: number}>>}
 */
export async function detectLaundrySymbols(imagePayload) {
  if (USE_MOCK_API) {
    return simulateTensorRTInference();
  }

  return callFastApiBackend(imagePayload);
}

/**
 * Simulates YOLOv8 TensorRT inference with realistic 1000ms delay
 */
async function simulateTensorRTInference() {
  // Simulate 1.0s TensorRT inference processing time
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Return active mock scenario (defaults to exact requested JSON)
  const scenario = MOCK_SCENARIOS[activeScenarioKey] || MOCK_SCENARIOS.default;
  return JSON.parse(JSON.stringify(scenario.data));
}

/**
 * Production-ready FastAPI integration
 * Sends multipart/form-data to YOLOv8 TensorRT backend
 */
async function callFastApiBackend(imageBlob) {
  const formData = new FormData();
  formData.append('file', imageBlob, 'garment_tag.jpg');
  formData.append('confidence_threshold', '0.50');

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Inference server responded with HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[API] Inference error:', err);
    throw err;
  }
}
