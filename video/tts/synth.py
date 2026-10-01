"""Run Kokoro v1.1-zh directly with ids from frontend.py."""
import os
import numpy as np
import onnxruntime as ort
import frontend

SR = 24000
_sess = None
_voices = None


def _load():
    global _sess, _voices
    if _sess is None:
        so = ort.SessionOptions()
        so.intra_op_num_threads = int(os.environ.get('TTS_THREADS', '4'))
        _sess = ort.InferenceSession(os.path.join(frontend.MODEL_DIR, 'model.onnx'), so,
                                     providers=['CPUExecutionProvider'])
        _voices = np.fromfile(os.path.join(frontend.MODEL_DIR, 'voices.bin'), dtype=np.float32).reshape(103, 510, 256)
    return _sess, _voices


def synth_ids(ids, sid, speed=1.0):
    sess, voices = _load()
    style = voices[sid, min(len(ids) - 2, 509)][None, :]
    audio, dur = sess.run(None, {'tokens': np.array([ids], dtype=np.int64),
                                 'style': style.astype(np.float32),
                                 'speed': np.array([speed], dtype=np.float32)})
    return audio.astype(np.float32), dur


def synth(text, sid, speed=1.0):
    phonemes, units, review = frontend.g2p(text)
    ids = frontend.to_ids(phonemes)
    audio, dur = synth_ids(ids, sid, speed)
    return audio, dur, units, review
