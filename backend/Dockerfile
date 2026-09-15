# ── Stage 1: build deps ───────────────────────────────────────────────────────
FROM python:3.13-slim AS builder

WORKDIR /app

# Install build tools needed by some Python packages (e.g. cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy only the api package (not node_modules, .venv, etc.)
COPY api/ ./api/

# Cloud Run injects PORT env var; default to 8080
ENV PORT=8080

# Run as non-root for security
RUN adduser --disabled-password --gecos "" appuser
USER appuser

EXPOSE 8080

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT} --workers 2 --log-config api/log_config.json"]
