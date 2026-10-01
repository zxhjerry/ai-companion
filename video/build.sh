#!/usr/bin/env bash
# Full build: narration -> cue sheet -> score/SFX/mix -> fonts -> frames -> final MP4.
set -euo pipefail
cd "$(dirname "$0")"
export MODELS=${MODELS:-$PWD/.models}
export BUILD=${BUILD:-$PWD/build}
export KOKORO_DIR=$MODELS/kokoro-multi-lang-v1_1
export JIEBA_SRC=$MODELS/jieba-0.42.1
export ASR_DIR=$MODELS/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17
WORKERS=${WORKERS:-4}
OUT=${OUT:-$PWD/output/千锤百炼之后_最难是被看见.mp4}
mkdir -p "$BUILD/chunks" "$(dirname "$OUT")"

echo "== narration";  (cd tts && python3 build_narration.py && python3 verify_narration.py)
echo "== cues";       python3 cues.py
echo "== audio";      bash audio/build_audio.sh
echo "== fonts";      python3 visual/fonts.py
echo "== frames"
N=$(python3 -c "import json,math;print(math.ceil(json.load(open('$BUILD/timeline.json'))['duration']*30))")
Q=$(( (N + WORKERS - 1) / WORKERS ))
for ((k = 0; k < WORKERS; k++)); do
  a=$((k * Q)); b=$(( (k + 1) * Q < N ? (k + 1) * Q : N ))
  node visual/render.js video "$BUILD/chunks/c$k.mp4" $a $b &
done
wait
echo "== mux"
: > "$BUILD/chunks/list.txt"
for ((k = 0; k < WORKERS; k++)); do echo "file 'c$k.mp4'" >> "$BUILD/chunks/list.txt"; done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$BUILD/chunks/list.txt" -i "$BUILD/final_audio.wav" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "$OUT"
echo "done: $OUT"
