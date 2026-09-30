from pathlib import Path
from typing import List, Optional
import urllib.parse
import cv2
import numpy as np
import requests
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from ultralytics import YOLO

app = FastAPI(
    title="CareTag AI Backend",
    description="YOLOv8 Garment Tag Symbol Detection & ISO 3758 Classifier",
    version="1.0.0"
)

# Enable CORS so frontend (localhost, Vercel, or custom domain) can connect seamlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load custom YOLOv8 care tag model
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")

model = YOLO(str(MODEL_PATH))

class SymbolDetection(BaseModel):
    symbol: str
    category: str
    instruction: str
    confidence: float

# Map the model's raw class codes (ER_*, KR_*, etc.) to ISO 3758 symbol categories and instructions
SYMBOL_MAP = {
    # European / ISO Standard (ER_*)
    "ER_1": {"symbol": "washtub_30", "category": "Washing", "instruction": "Machine wash cold (30°C)"},
    "ER_2": {"symbol": "washtub_40", "category": "Washing", "instruction": "Machine wash warm (40°C)"},
    "ER_3": {"symbol": "washtub_40", "category": "Washing", "instruction": "Machine wash medium (50°C)"},
    "ER_4": {"symbol": "washtub_60", "category": "Washing", "instruction": "Machine wash hot (60°C)"},
    "ER_5": {"symbol": "washtub_60", "category": "Washing", "instruction": "Machine wash very hot (70°C)"},
    "ER_6": {"symbol": "washtub_95", "category": "Washing", "instruction": "Machine wash boil (95°C)"},
    "ER_7": {"symbol": "washtub_hand", "category": "Washing", "instruction": "Hand wash only (max 40°C)"},
    "ER_8": {"symbol": "washtub_crossed", "category": "Washing", "instruction": "Do not wash in water"},
    "ER_9": {"symbol": "triangle_any", "category": "Bleaching", "instruction": "Any bleach allowed (chlorine or oxygen)"},
    "ER_10": {"symbol": "triangle_any", "category": "Bleaching", "instruction": "Non-chlorine / oxygen bleach only"},
    "ER_11": {"symbol": "square_circle_1dot", "category": "Drying", "instruction": "Tumble dry low heat"},
    "ER_12": {"symbol": "iron_1dot", "category": "Ironing", "instruction": "Iron at low temperature (max 110°C)"},
    "ER_13": {"symbol": "iron_2dots", "category": "Ironing", "instruction": "Iron at medium temperature (max 150°C)"},
    "ER_14": {"symbol": "iron_3dots", "category": "Ironing", "instruction": "Iron at high temperature (max 200°C)"},
    "ER_15": {"symbol": "iron_crossed", "category": "Ironing", "instruction": "Do not iron / steam"},
    "ER_16": {"symbol": "square_circle_2dots", "category": "Drying", "instruction": "Tumble dry normal / medium heat"},
    "ER_17": {"symbol": "square_crossed", "category": "Drying", "instruction": "Do not tumble dry"},
    "ER_18": {"symbol": "circle_p", "category": "Professional Care", "instruction": "Dry clean with PCE only"},
    "ER_19": {"symbol": "circle_crossed", "category": "Professional Care", "instruction": "Do not dry clean"},
    "ER_20": {"symbol": "circle_p", "category": "Professional Care", "instruction": "Gentle professional dry clean"},
    "ER_27": {"symbol": "Professional care", "category": "Professional Care", "instruction": "Dry clean using standard solvents"},

    # Korean Standards (KR_*)
    "KR_1": {"symbol": "washtub_95", "category": "Washing", "instruction": "Machine wash boil (95°C)"},
    "KR_2": {"symbol": "washtub_60", "category": "Washing", "instruction": "Machine wash hot (60°C)"},
    "KR_3": {"symbol": "washtub_40", "category": "Washing", "instruction": "Machine wash warm (40°C)"},
    "KR_4": {"symbol": "washtub_30", "category": "Washing", "instruction": "Machine wash cold (30°C)"},
    "KR_5": {"symbol": "washtub_30", "category": "Washing", "instruction": "Gentle machine wash (30°C)"},
    "KR_6": {"symbol": "washtub_hand", "category": "Washing", "instruction": "Hand wash only (30°C)"},
    "KR_7": {"symbol": "washtub_crossed", "category": "Washing", "instruction": "Do not wash with water"},
    "KR_8": {"symbol": "triangle_any", "category": "Bleaching", "instruction": "Chlorine bleach permitted"},
    "KR_9": {"symbol": "triangle_any", "category": "Bleaching", "instruction": "Oxygen bleach permitted"},
    "KR_10": {"symbol": "triangle_crossed", "category": "Bleaching", "instruction": "Chlorine bleach prohibited"},
    "KR_11": {"symbol": "triangle_crossed", "category": "Bleaching", "instruction": "Do not bleach"},
    "KR_12": {"symbol": "iron_3dots", "category": "Ironing", "instruction": "Iron high heat (180-210°C)"},
    "KR_13": {"symbol": "iron_2dots", "category": "Ironing", "instruction": "Iron medium heat (140-160°C)"},
    "KR_14": {"symbol": "iron_1dot", "category": "Ironing", "instruction": "Iron low heat (80-120°C)"},
    "KR_15": {"symbol": "iron_2dots", "category": "Ironing", "instruction": "Iron with press cloth (medium)"},
    "KR_16": {"symbol": "iron_1dot", "category": "Ironing", "instruction": "Iron with press cloth (low)"},
    "KR_17": {"symbol": "iron_crossed", "category": "Ironing", "instruction": "Do not iron"},
    "KR_18": {"symbol": "circle_p", "category": "Professional Care", "instruction": "Dry clean (perchloroethylene)"},
    "KR_19": {"symbol": "square_crossed", "category": "Drying", "instruction": "Do not tumble dry"},
    "KR_20": {"symbol": "square_circle_1dot", "category": "Washing", "instruction": "Wring lightly"},
    "KR_21": {"symbol": "square_crossed", "category": "Drying", "instruction": "Do not wring"},
    "KR_22": {"symbol": "square_crossed", "category": "Drying", "instruction": "Hang dry in sun"},
    "KR_23": {"symbol": "square_crossed", "category": "Drying", "instruction": "Hang dry in shade"},
    "KR_24": {"symbol": "square_crossed", "category": "Drying", "instruction": "Flat dry in sun"},
    "KR_25": {"symbol": "square_crossed", "category": "Drying", "instruction": "Flat dry in shade"},
    "KR_26": {"symbol": "circle_p", "category": "Professional Care", "instruction": "Specialist petroleum dry clean"},
    "KR_27": {"symbol": "circle_crossed", "category": "Professional Care", "instruction": "Do not dry clean"},
    "wash-care-symbols": {"symbol": "washtub_30", "category": "Washing", "instruction": "Wash care symbol detected"},
}

def resolve_symbol_meta(cls_name: str) -> dict:
    if cls_name in SYMBOL_MAP:
        return SYMBOL_MAP[cls_name]
    
    # Fallback heuristics for numbered classes
    if cls_name.startswith("ER_"):
        num_str = cls_name.split("_")[-1]
        if num_str.isdigit():
            num = int(num_str)
            if num <= 8:
                return {"symbol": "washtub_30", "category": "Washing", "instruction": f"Wash care ({cls_name})"}
            elif num <= 10:
                return {"symbol": "triangle_any", "category": "Bleaching", "instruction": f"Bleach care ({cls_name})"}
            elif num in (11, 16, 17) or (21 <= num <= 25):
                return {"symbol": "square_circle_1dot", "category": "Drying", "instruction": f"Dry care ({cls_name})"}
            elif 12 <= num <= 15:
                return {"symbol": "iron_1dot", "category": "Ironing", "instruction": f"Iron care ({cls_name})"}
            elif 18 <= num <= 20 or num >= 26:
                return {"symbol": "circle_p", "category": "Professional Care", "instruction": f"Professional care ({cls_name})"}

    if cls_name.startswith("KR_"):
        num_str = cls_name.split("_")[-1]
        if num_str.isdigit():
            num = int(num_str)
            if num <= 7:
                return {"symbol": "washtub_30", "category": "Washing", "instruction": f"Wash care ({cls_name})"}
            elif num <= 11:
                return {"symbol": "triangle_crossed", "category": "Bleaching", "instruction": f"Bleach care ({cls_name})"}
            elif num <= 17:
                return {"symbol": "iron_1dot", "category": "Ironing", "instruction": f"Iron care ({cls_name})"}
            elif num in (19, 20, 21, 22, 23, 24, 25):
                return {"symbol": "square_crossed", "category": "Drying", "instruction": f"Dry care ({cls_name})"}
            elif num in (18, 26, 27, 28, 29, 30, 31, 32):
                return {"symbol": "circle_p", "category": "Professional Care", "instruction": f"Professional care ({cls_name})"}

    return {
        "symbol": "circle_p",
        "category": "Detected",
        "instruction": f"Identified care mark: {cls_name}"
    }

@app.get("/api/v1/health")
@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint to verify API and model status."""
    return {
        "status": "healthy",
        "model": "YOLOv8 CareTag",
        "classes_count": len(model.names),
        "endpoint": "/api/v1/detect-symbols"
    }

def calculate_garment_metrics(detected_symbols: list) -> dict:
    """
    Calculate dynamic sustainability and comfort scores based on detected care symbols
    and current ambient weather metrics for Ghaziabad from Open-Meteo.
    """
    sustainability = 85
    comfort = 90

    for item in detected_symbols:
        if isinstance(item, str):
            sym = item
            inst = ""
        elif isinstance(item, dict):
            sym = item.get("symbol", "")
            inst = item.get("instruction", "")
        else:
            sym = getattr(item, "symbol", "")
            inst = getattr(item, "instruction", "")

        sym_lower = sym.lower()
        inst_lower = inst.lower()

        # Rule: subtract 15 from sustainability for tumble dry symbols
        if (
            "square_circle" in sym_lower
            or ("tumble" in sym_lower and "not" not in sym_lower and "crossed" not in sym_lower)
            or ("tumble" in inst_lower and "not" not in inst_lower and "no " not in inst_lower)
        ):
            sustainability -= 15
        # Rule: subtract 20 for dry cleaning ('circle_p')
        elif (
            "circle_p" in sym_lower
            or ("dry_clean" in sym_lower and "not" not in sym_lower and "crossed" not in sym_lower)
            or ("dry clean" in inst_lower and "not" not in inst_lower and "no " not in inst_lower and "circle_crossed" not in sym_lower)
        ):
            sustainability -= 20
        # Rule: add 10 for hand washing
        elif (
            "washtub_hand" in sym_lower
            or ("hand" in sym_lower and "wash" in sym_lower)
            or "hand wash" in inst_lower
        ):
            sustainability += 10

    # Fetch ambient temperature and humidity for Ghaziabad from Open-Meteo API
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": 28.6692,
            "longitude": 77.4538,
            "current": "temperature_2m,relative_humidity_2m"
        }
        resp = requests.get(url, params=params, timeout=5)
        if resp.status_code == 200:
            weather_data = resp.json()
            current = weather_data.get("current", {})
            current_weather = weather_data.get("current_weather", {})

            temp = (
                current.get("temperature_2m")
                if current.get("temperature_2m") is not None
                else current.get("temperature", current_weather.get("temperature", weather_data.get("temperature")))
            )
            humidity = (
                current.get("relative_humidity_2m")
                if current.get("relative_humidity_2m") is not None
                else current.get("humidity", current_weather.get("humidity", weather_data.get("humidity")))
            )

            if temp is not None:
                temp_val = float(temp)
                hum_val = float(humidity) if humidity is not None else None
                if hum_val is not None and temp_val > 30 and hum_val > 60:
                    comfort -= 15
                elif temp_val > 35:
                    comfort -= 10
    except Exception:
        pass

    # Return bounded scores (min 0, max 100)
    sustainability = max(0, min(100, sustainability))
    comfort = max(0, min(100, comfort))

    return {
        "sustainability": sustainability,
        "comfort": comfort
    }

def generate_smart_search_insights(detected_symbols: list) -> dict:
    """
    Generate tailored search query, inspection tip, and direct Google Shopping link
    based on detected care symbols.
    """
    has_dry_clean = False
    has_hand_wash = False
    has_low_iron = False
    has_no_tumble = False

    for item in detected_symbols:
        sym = getattr(item, "symbol", "") if hasattr(item, "symbol") else (item.get("symbol", "") if isinstance(item, dict) else str(item))
        inst = getattr(item, "instruction", "") if hasattr(item, "instruction") else (item.get("instruction", "") if isinstance(item, dict) else "")
        sym_lower = sym.lower()
        inst_lower = inst.lower()

        if "circle_p" in sym_lower or ("dry clean" in inst_lower and "not" not in inst_lower and "crossed" not in sym_lower):
            has_dry_clean = True
        elif "washtub_hand" in sym_lower or "hand wash" in inst_lower:
            has_hand_wash = True
        elif "iron_1dot" in sym_lower or ("low" in inst_lower and "iron" in inst_lower):
            has_low_iron = True
        elif "square_crossed" in sym_lower or ("tumble" in inst_lower and "not" in inst_lower):
            has_no_tumble = True

    if has_dry_clean:
        query = "premium wool tailored formal garment price range online"
        tip = "Ensure professional dry cleaning compliance for this fabric type. Check shoulder padding and structural stitching."
    elif has_hand_wash:
        query = "delicate silk linen blend garment price range online"
        tip = "Inspect fine fiber knit tension and delicate hem integrity. Use mild detergent and dry flat to prevent fiber warping."
    elif has_no_tumble:
        query = "air dry delicate garment price range online"
        tip = "Air-dry flat or drip dry in shade to preserve garment shape and avoid heat shrinkage."
    elif has_low_iron:
        query = "wrinkle resistant lightweight travel garment price range online"
        tip = "Inspect synthetic and elastane thread elasticity. Use a low temperature iron with a press cloth to avoid fabric shine."
    else:
        query = "organic cotton breathable garment price range online"
        tip = "Check for high stitch density and verify fabric breathability against current weather conditions."

    encoded_query = urllib.parse.quote_plus(query)
    shopping_url = f"https://www.google.com/search?q={encoded_query}&tbm=shop"

    return {
        "query": query,
        "inspection_tip": tip,
        "tip": tip,
        "shopping_url": shopping_url,
        "search_url": shopping_url
    }

@app.post("/api/v1/detect-symbols")
async def detect_symbols(
    file: UploadFile = File(...),
    confidence_threshold: float = Form(0.55)
):
    """
    Receives an image (multipart/form-data), performs YOLOv8 inference,
    and returns detected care symbols with ISO 3758 metadata.
    """
    try:
        image_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")

    if not image_bytes or len(image_bytes) < 10:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or too small.")

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image. Supported formats: JPEG, PNG, WebP.")

    # Prevent memory and CPU spikes from high-resolution smartphone camera uploads
    h, w = img.shape[:2]
    max_dim = 1280
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # Run YOLOv8 inference with optimal standard 640px tensor input
    results = model.predict(source=img, imgsz=640, conf=0.55, verbose=False)
    
    detections = []
    for r in results:
        if r.boxes is None:
            continue
        for box in r.boxes:
            cls_id = int(box.cls[0].item())
            cls_name = r.names.get(cls_id, f"Class_{cls_id}")
            conf = float(box.conf[0].item())

            mapped = resolve_symbol_meta(cls_name)

            detections.append(
                SymbolDetection(
                    symbol=mapped["symbol"],
                    category=mapped["category"],
                    instruction=mapped["instruction"],
                    confidence=round(conf, 2)
                )
            )

    # Sort by confidence descending and de-duplicate by symbol
    detections.sort(key=lambda d: d.confidence, reverse=True)
    unique_map = {}
    for d in detections:
        if d.category not in unique_map and d.symbol not in unique_map:
            unique_map[d.category] = d

    unique_symbols = list(unique_map.values())
    metrics = calculate_garment_metrics(unique_symbols)
    smart_search = generate_smart_search_insights(unique_symbols)
    return {
        "symbols": unique_symbols,
        "scores": metrics,
        "smart_search": smart_search
    }

# Mount static frontend files if served directly through FastAPI
if (ROOT_DIR / "js").is_dir():
    app.mount("/js", StaticFiles(directory=str(ROOT_DIR / "js")), name="js")
if (ROOT_DIR / "css").is_dir():
    app.mount("/css", StaticFiles(directory=str(ROOT_DIR / "css")), name="css")
if (ROOT_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(ROOT_DIR / "assets")), name="assets")

@app.get("/")
async def serve_index():
    index_file = ROOT_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "CareTag API is live"}

@app.get("/manifest.json")
async def serve_manifest():
    manifest_file = ROOT_DIR / "manifest.json"
    if manifest_file.exists():
        return FileResponse(manifest_file, media_type="application/manifest+json")
    raise HTTPException(status_code=404, detail="manifest.json not found")

@app.get("/sw.js")
async def serve_service_worker():
    sw_file = ROOT_DIR / "sw.js"
    if sw_file.exists():
        return FileResponse(sw_file, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="sw.js not found")