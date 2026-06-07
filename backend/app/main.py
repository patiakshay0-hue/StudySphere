"""StudySphere application entry point.

Serves the JSON API under ``/api``. When a built frontend exists at
``frontend/dist`` (production), it also serves the React single-page app so the
whole product runs as one service. In local dev (no build), run the Vite dev
server separately (``npm run dev``).
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import config
from app.api import api_router
from app.db import init_db
from app.services.vector_store import store


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    store.load_from_db()
    yield


app = FastAPI(
    title="StudySphere API",
    description="Smart MCA Assistant using RAG and Generative AI — accounts, credits, payments.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS: same-origin in production (SPA served here). Set STUDYSPHERE_CORS_ORIGINS
# (comma-separated) if you host the frontend on a different domain.
_origins = os.getenv("STUDYSPHERE_CORS_ORIGINS", "*")
allow_origins = ["*"] if _origins.strip() == "*" else [o.strip() for o in _origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "ai_enabled": config.AI_ENABLED, "razorpay_enabled": config.RAZORPAY_ENABLED}


# Serve the built SPA (production). Mounted last so /api and /health win.
if config.DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(config.DIST_DIR), html=True), name="spa")
else:
    @app.get("/")
    async def root():
        return {
            "name": "StudySphere API",
            "version": "2.0.0",
            "docs": "/docs",
            "frontend_dev": "Run the React app in ../frontend (npm run dev) at http://localhost:5173",
        }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
