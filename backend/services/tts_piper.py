import asyncio
import base64
import io
import os
import subprocess
import tempfile
import wave
from pathlib import Path

from piper.voice import PiperVoice
from piper.config import PiperConfig
import onnxruntime
import json as _json

_VOICES_DIR = Path(__file__).parent.parent / "piper_voices"

# Map app language codes → piper voice model filenames
# Languages without official Piper models (bn, mr, ta, ur, gu, pa, sa, ko, ja, zh-TW)
# will raise ValueError and fall back to gTTS in tts.py
_LANG_TO_MODEL = {
    "en":    "en_US-lessac-medium",
    "hi":    "hi_IN-rohan-medium",
    "te":    "te_IN-maya-medium",
    "de":    "de_DE-thorsten-medium",
    "fr":    "fr_FR-siwis-medium",
    "ru":    "ru_RU-irina-medium",
    "ar":    "ar_JO-kareem-medium",
    "zh-CN": "zh_CN-huayan-medium",
}

# Cache loaded PiperVoice instances
_voice_cache: dict[str, PiperVoice] = {}


def get_piper_voice(lang: str) -> PiperVoice | None:
    model_name = _LANG_TO_MODEL.get(lang)
    if not model_name:
        return None

    if model_name not in _voice_cache:
        onnx_path = _VOICES_DIR / f"{model_name}.onnx"
        json_path  = _VOICES_DIR / f"{model_name}.onnx.json"

        if not onnx_path.exists():
            print(f"[PIPER] Model not found: {onnx_path}")
            return None

        print(f"[PIPER] Loading voice: {model_name}")
        with open(str(json_path), "r", encoding="utf-8") as f:
            config_dict = _json.load(f)
        sess_options = onnxruntime.SessionOptions()
        sess_options.intra_op_num_threads = 4
        sess_options.inter_op_num_threads = 1
        sess_options.execution_mode = onnxruntime.ExecutionMode.ORT_PARALLEL
        _voice_cache[model_name] = PiperVoice(
            config=PiperConfig.from_dict(config_dict),
            session=onnxruntime.InferenceSession(
                str(onnx_path),
                sess_options=sess_options,
                providers=["CPUExecutionProvider"],
            ),
        )
        print(f"[PIPER] Voice ready: {model_name}")

    return _voice_cache[model_name]


def _synthesize_to_mp3(text: str, voice: PiperVoice) -> bytes:
    """Synthesize text → WAV → MP3 bytes using ffmpeg."""
    # Collect AudioChunk objects from Piper
    chunks = list(voice.synthesize(text))
    if not chunks:
        raise ValueError("Piper returned no audio chunks")

    # Build WAV from raw int16 bytes using chunk metadata
    c0 = chunks[0]
    wav_buf = io.BytesIO()
    with wave.open(wav_buf, "wb") as wf:
        wf.setnchannels(c0.sample_channels)
        wf.setsampwidth(c0.sample_width)
        wf.setframerate(c0.sample_rate)
        for chunk in chunks:
            wf.writeframes(chunk.audio_int16_bytes)
    wav_bytes = wav_buf.getvalue()

    # Convert WAV → MP3 via ffmpeg (already installed)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
        tmp_wav.write(wav_bytes)
        wav_path = tmp_wav.name

    mp3_path = wav_path.replace(".wav", ".mp3")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-q:a", "4", mp3_path],
            capture_output=True, check=True,
        )
        with open(mp3_path, "rb") as f:
            return f.read()
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)
        if os.path.exists(mp3_path):
            os.remove(mp3_path)


async def piper_tts(text: str, target_lang: str) -> str:
    """Generate speech with Piper (local, CPU). Returns base64 MP3.
    Raises ValueError if no voice model available for the language."""
    voice = get_piper_voice(target_lang)
    if voice is None:
        raise ValueError(f"[PIPER] No voice model available for language: {target_lang}")

    loop = asyncio.get_event_loop()
    mp3_bytes = await loop.run_in_executor(None, _synthesize_to_mp3, text, voice)
    return base64.b64encode(mp3_bytes).decode("utf-8")
