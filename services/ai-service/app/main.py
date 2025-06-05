# services/ai-service/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from app.routes import health
# from app.routes import predictions  # Comment out temporarily

# Create FastAPI app
app = FastAPI(
    title="Warely AI Service",
    description="AI/ML predictions and analytics for warehouse management",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/health", tags=["health"])
# app.include_router(predictions.router, prefix="/ai", tags=["predictions"])  # Comment out temporarily

# Root endpoint
@app.get("/hello")
async def root():
    return ("Hello from Warely AI-Service")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 6001))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("NODE_ENV") == "development"
    )