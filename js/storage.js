/**
 * CareTag AI - Storage Controller (IndexedDB)
 * Database: CareTagDB
 * Store: garments
 */

const DB_NAME = 'CareTagDB';
const DB_VERSION = 1;
const STORE_NAME = 'garments';

let dbInstance = null;

/**
 * Initializes and opens the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('date_added', 'date_added', { unique: false });
        store.createIndex('nickname', 'nickname', { unique: false });
      }
    };

    request.onsuccess = async (event) => {
      dbInstance = event.target.result;
      await seedInitialGarmentsIfEmpty(dbInstance);
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] Failed to open CareTagDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Saves a garment object to IndexedDB
 * @param {Object} garmentData
 * @param {string} garmentData.nickname
 * @param {string} garmentData.image_base64
 * @param {Array<{category: string, instruction: string, symbol?: string}>} garmentData.care_rules
 * @param {string} [garmentData.date_added]
 * @returns {Promise<number>} New record ID
 */
export async function saveGarment(garmentData) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      ...garmentData,
      date_added: garmentData.date_added || new Date().toISOString()
    };

    const request = store.add(record);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] saveGarment error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Retrieves all garments sorted chronologically (newest first)
 * @returns {Promise<Array<Object>>}
 */
export async function getAllGarments() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const garments = request.result || [];
      // Sort newest first
      garments.sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
      resolve(garments);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] getAllGarments error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Retrieves a single garment by ID
 * @param {number} id
 * @returns {Promise<Object>}
 */
export async function getGarmentById(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(Number(id));

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] getGarmentById error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Deletes a garment by ID
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function deleteGarment(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(Number(id));

    request.onsuccess = () => {
      resolve(true);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] deleteGarment error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Generates an aesthetic SVG-based base64 placeholder thumbnail for denim
 */
function createSampleDenimImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <defs>
      <linearGradient id="denimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#denimGrad)"/>
    <g fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.6">
      <path d="M70 90 L150 50 L230 90 L210 240 L90 240 Z" stroke-dasharray="6 3"/>
      <path d="M120 120 L180 120 L180 170 L120 170 Z" stroke-width="1.5"/>
      <line x1="150" y1="50" x2="150" y2="240" stroke-dasharray="3 3"/>
    </g>
    <text x="150" y="275" font-family="sans-serif" font-size="12" font-weight="bold" fill="#7dd3fc" text-anchor="middle" letter-spacing="1">DENIM ARCHIVE #01</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generates an aesthetic SVG-based base64 placeholder thumbnail for silk
 */
function createSampleSilkImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <defs>
      <linearGradient id="silkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#7c3aed"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#silkGrad)"/>
    <g fill="none" stroke="#c084fc" stroke-width="2" opacity="0.6">
      <circle cx="150" cy="140" r="50" stroke-dasharray="4 4"/>
      <path d="M100 80 Q150 140 200 80" stroke-width="2"/>
      <path d="M110 200 Q150 170 190 200" stroke-width="2"/>
    </g>
    <text x="150" y="275" font-family="sans-serif" font-size="12" font-weight="bold" fill="#e9d5ff" text-anchor="middle" letter-spacing="1">SILK SHIRT #02</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Seeds initial mock data if IndexedDB is completely empty
 */
async function seedInitialGarmentsIfEmpty(db) {
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      if (countRequest.result === 0) {
        console.log('[IndexedDB] Seeding default wardrobe garments...');
        const writeTx = db.transaction([STORE_NAME], 'readwrite');
        const writeStore = writeTx.objectStore(STORE_NAME);

        // Required Mock Item matching prompt schema exactly
        writeStore.add({
          nickname: "Vintage Denim Jacket",
          image_base64: createSampleDenimImage(),
          care_rules: [
            { "category": "Washing", "instruction": "Machine wash cold", "symbol": "washtub_30" },
            { "category": "Drying", "instruction": "Line dry in shade", "symbol": "square_crossed" }
          ],
          date_added: "2026-09-27T03:03:54Z"
        });

        // Supplementary stylish wardrobe item
        writeStore.add({
          nickname: "Italian Silk Button-Down",
          image_base64: createSampleSilkImage(),
          care_rules: [
            { "category": "Washing", "instruction": "Hand wash only (max 30°C)", "symbol": "washtub_hand" },
            { "category": "Bleaching", "instruction": "Do not bleach", "symbol": "triangle_crossed" },
            { "category": "Ironing", "instruction": "Iron low heat (no steam)", "symbol": "iron_1dot" }
          ],
          date_added: "2026-09-26T18:20:00Z"
        });

        writeTx.oncomplete = () => resolve();
        writeTx.onerror = () => resolve();
      } else {
        resolve();
      }
    };

    countRequest.onerror = () => resolve();
  });
}
