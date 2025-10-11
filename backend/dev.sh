#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"
echo "[dev] Backend one-click dev starting..."

if [[ ! -d .venv ]]; then
  echo "[dev] Creating virtualenv at .venv"
  python -m venv .venv
fi
echo "[dev] Activating virtualenv"
source .venv/bin/activate

if [[ -f requirements.txt ]]; then
  echo "[dev] Installing Python dependencies"
  python -m pip install --upgrade pip >/dev/null
  pip install -r requirements.txt
fi

if command -v docker >/dev/null 2>&1; then
  if [[ -f ../docker/docker-compose.yml ]]; then
    echo "[dev] Starting Postgres via docker compose (docker/docker-compose.yml)"
    (cd .. && docker compose -f docker/docker-compose.yml up -d postgres)
    echo "[dev] Waiting for database port 5433..."
    for i in {1..30}; do
      (echo > /dev/tcp/127.0.0.1/5433) >/dev/null 2>&1 && break || true
      sleep 1
    done || true
  elif [[ -f ../docker-compose.yml ]]; then
    echo "[dev] Starting Postgres via docker compose (legacy root docker-compose.yml)"
    (cd .. && docker compose up -d postgres)
    echo "[dev] Waiting for database port 5433..."
    for i in {1..30}; do
      (echo > /dev/tcp/127.0.0.1/5433) >/dev/null 2>&1 && break || true
      sleep 1
    done || true
  fi
fi

if [[ -f alembic.ini ]]; then
  echo "[dev] Applying DB migrations (alembic upgrade head)"
  alembic upgrade head || echo "[dev] Alembic migration failed; continuing"
fi

echo "[dev] Starting Uvicorn on http://localhost:8001 (reload)"
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

