# StudySphere — single-image build (React frontend + FastAPI backend)

# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build      # -> /app/frontend/dist

# ---- Stage 2: Python runtime serving API + built SPA ----
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Backend deps
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Backend code + built frontend
COPY backend/ backend/
COPY --from=frontend /app/frontend/dist frontend/dist

# Persistent data dir (mount a volume here in production)
ENV STUDYSPHERE_DATA_DIR=/data
RUN mkdir -p /data

WORKDIR /app/backend
EXPOSE 8000
# Hosts (Render/Railway/Fly) inject $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
