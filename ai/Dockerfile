# Build with ai/ as the context: docker build -t bantai-ai:local ai
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    BANTAI_AI_ENVIRONMENT=production \
    BANTAI_AI_MODEL_DIR=/models/model \
    BANTAI_AI_MODEL_APPROVAL_PATH=/run/bantai/model-approval.json \
    BANTAI_AI_RETRAIN_QUEUE_PATH=/var/lib/bantai/retrain/jobs.json

WORKDIR /app

COPY requirements.inference.txt ./
RUN python -m pip install --no-cache-dir --no-compile \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r requirements.inference.txt \
    && groupadd --system --gid 10001 bantai \
    && useradd --system --uid 10001 --gid bantai --no-create-home bantai \
    && mkdir -p /models/model /run/bantai /var/lib/bantai/retrain \
    && chown -R bantai:bantai /app /var/lib/bantai

COPY --chown=bantai:bantai preprocessing ./preprocessing
COPY --chown=bantai:bantai retraining/__init__.py retraining/checksum.py retraining/registry.py retraining/version_file.py ./retraining/
COPY --chown=bantai:bantai service ./service

USER 10001:10001
EXPOSE 8001

# Liveness intentionally does not depend on model readiness. Configure the
# orchestrator readiness probe against /ready so unapproved models get no traffic.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=3).read()"]

CMD ["python", "-m", "uvicorn", "service.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
