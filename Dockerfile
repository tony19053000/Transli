# HuggingFace Spaces — CPU backend
# Port 7860 is required by HF Spaces.

FROM python:3.11-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    espeak-ng \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces runs as user 1000
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Install CPU-only PyTorch first (avoids pulling multi-GB CUDA packages)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Download Piper voice models into the expected location
# Models are from rhasspy/piper-voices on HuggingFace Hub.
RUN mkdir -p piper_voices

RUN BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main" && \
    for VOICE_PATH in \
      "en/en_US/lessac/medium/en_US-lessac-medium" \
      "hi/hi_IN/rohan/medium/hi_IN-rohan-medium" \
      "te/te_IN/maya/medium/te_IN-maya-medium" \
      "de/de_DE/thorsten/medium/de_DE-thorsten-medium" \
      "fr/fr_FR/siwis/medium/fr_FR-siwis-medium" \
      "ru/ru_RU/irina/medium/ru_RU-irina-medium" \
      "ar/ar_JO/kareem/medium/ar_JO-kareem-medium" \
      "zh/zh_CN/huayan/medium/zh_CN-huayan-medium" \
    ; do \
      FNAME=$(basename $VOICE_PATH); \
      wget -q "$BASE/$VOICE_PATH.onnx" -O "piper_voices/$FNAME.onnx"; \
      wget -q "$BASE/$VOICE_PATH.onnx.json" -O "piper_voices/$FNAME.onnx.json"; \
    done

# Copy backend source
COPY backend/ ./

# Fix piper_voices path: tts_piper.py expects the folder next to services/
# The WORKDIR /app is the backend root, so piper_voices is already in the right place.

# Switch to non-root user
USER 1000

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
