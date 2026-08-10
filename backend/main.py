import base64
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Smart Garment Scanner API")

# Configure CORS so the frontend can communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins during local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImagePayload(BaseModel):
    image: str

@app.post("/api/analyze")
async def analyze_garment(payload: ImagePayload):
    """
    Receives a Base64 encoded image from the frontend and returns AI analysis results.
    For Phase 2, this returns a perfectly structured mocked response to build the frontend UI flow.
    """
    # 1. Simulate network latency and AI processing time (e.g. 1.5 seconds)
    time.sleep(1.5)
    
    # 2. (Future) Decode and process image with real AI model:
    # image_data = base64.b64decode(payload.image.split(",")[1])
    # results = my_ai_model.predict(image_data)

    # 3. Return the AI response
    return {
        "status": "success",
        "data": {
            "composition": "60% Organic Cotton, 40% Recycled Polyester",
            "sustainability_score": 85,
            "comfort_score": 90,
            "estimated_price_tier": "$$"
        }
    }
