#!/usr/bin/env bash
# One-time setup: Python deps + offline TTS / ASR models (GitHub releases only).
set -euo pipefail
MODELS=${MODELS:-$(dirname "$0")/.models}
mkdir -p "$MODELS"
pip3 install -q sherpa-onnx onnxruntime numpy scipy soundfile pypinyin pypinyin-dict pillow
REL=https://github.com/k2-fsa/sherpa-onnx/releases/download
fetch() { [ -d "$MODELS/$2" ] || (curl -sSL "$REL/$1/$2.tar.bz2" | tar xj -C "$MODELS"); }
fetch tts-models kokoro-multi-lang-v1_1
fetch asr-models sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17
# jieba ships as an sdist only; it is pure Python, so just unpack it
if [ ! -d "$MODELS/jieba-0.42.1" ]; then
  pip3 download -q jieba==0.42.1 --no-deps --no-binary :all: -d "$MODELS"
  tar xzf "$MODELS/jieba-0.42.1.tar.gz" -C "$MODELS"
fi
echo "models in $MODELS"
