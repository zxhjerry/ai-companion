#!/usr/bin/env bash
# Regenerate ALL non-voice audio and the final mix from $BUILD/cues.json:
#   sfx.py   -> $BUILD/sfx.wav
#   score.py -> $BUILD/music.wav + $BUILD/stems/*.wav
#   mix.py   -> $BUILD/final_audio.wav (+ $BUILD/mix_buses/*)
#   qa.py    -> objective checks + $BUILD/qa/*.png
#
# Usage:  BUILD=/path/to/build bash audio/build_audio.sh [--clean] [--no-qa]
#   --clean  drop the FluidSynth render cache ($BUILD/score_work) first
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export BUILD="${BUILD:-$(dirname "$HERE")/build}"
export ASSETS="${ASSETS:-${MODELS:-$(dirname "$HERE")/.models}/assets}"
CLEAN=0
QA=1
for a in "$@"; do
  case "$a" in
    --clean) CLEAN=1 ;;
    --no-qa) QA=0 ;;
  esac
done

[ -f "$BUILD/cues.json" ] || { echo "missing $BUILD/cues.json" >&2; exit 1; }
[ -f "$BUILD/narration.wav" ] || { echo "missing $BUILD/narration.wav" >&2; exit 1; }

# ---- toolchain
command -v fluidsynth >/dev/null || apt-get install -y fluidsynth
python3 -c "import mido, pyloudnorm, matplotlib, soundfile, scipy" 2>/dev/null \
  || pip install -q mido pyloudnorm matplotlib soundfile scipy

# ---- soundfont: GeneralUser GS (fallback: FluidR3 GM from apt)
SF2_DEFAULT="$ASSETS/generaluser-gs/GeneralUser-GS.sf2"
if [ -z "${SF2:-}" ]; then
  if [ ! -f "$SF2_DEFAULT" ]; then
    mkdir -p "$ASSETS"
    GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/mrbumpy409/GeneralUser-GS \
      "$ASSETS/generaluser-gs" || true
  fi
  if [ -f "$SF2_DEFAULT" ]; then
    SF2="$SF2_DEFAULT"
  else
    apt-get install -y fluid-soundfont-gm
    SF2=/usr/share/sounds/sf2/FluidR3_GM.sf2
  fi
fi
export SF2
echo "soundfont: $SF2"

[ "$CLEAN" = 1 ] && rm -rf "$BUILD/score_work"

cd "$HERE"
T0=$(date +%s)
python3 sfx.py &
SFX_PID=$!
python3 score.py
wait $SFX_PID
python3 mix.py
[ "$QA" = 1 ] && python3 qa.py 2>&1 | grep -v -E "UserWarning|plt\.(tight_layout|savefig)"
echo "audio build done in $(( $(date +%s) - T0 )) s -> $BUILD/final_audio.wav"
