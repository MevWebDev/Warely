from fastapi import APIRouter
from datetime import datetime
import psutil
import os

router = APIRouter()

@router.get("")
async def health_check():
    """Health check endpoint for Docker health checks"""
    return {
        "status": "ok",
        "service": "ai-service",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

@router.get("/detailed")
async def detailed_health():
    """Detailed health information"""
    try:
        # Get system information
        memory = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent()
        
        return {
            "status": "ok",
            "service": "ai-service",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0",
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available": memory.available,
                "environment": os.getenv("NODE_ENV", "production")
            },
            "dependencies": {
                "tensorflow": "ready",
                "mongodb": "connected",  # Add actual checks
                "redis": "connected"     # Add actual checks
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }