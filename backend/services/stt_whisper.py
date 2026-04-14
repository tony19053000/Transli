import whisper
import asyncio
import os
import threading

_DEVICE = "cpu"

# Global model cache to avoid reloading on every request
_model_cache = {}
_whisper_lock = threading.Lock()

def get_whisper_model(model_name="base", device: str | None = None):
    resolved_device = device or _DEVICE
    cache_key = (model_name, resolved_device)
    with _whisper_lock:
        if cache_key not in _model_cache:
            print(f"[DEBUG WHISPER] Loading model: {model_name}.pt on {resolved_device}")
            _model_cache[cache_key] = whisper.load_model(model_name, device=resolved_device)
        else:
            print(f"[DEBUG WHISPER] Using cached model: {model_name}.pt on {resolved_device}")
    return _model_cache[cache_key]

# Whisper uses ISO 639-1 codes. App uses BCP-47 for Chinese variants — normalize here.
_WHISPER_LANG_NORM = {
    "zh-CN": "zh",
    "zh-TW": "zh",
}

async def transcribe_whisper(file_path: str, source_lang: str, model_name: str = "base", prompt: str = "") -> tuple[str, str]:
    """Uses local Whisper model to transcribe audio.
    Returns (transcript, detected_lang) — detected_lang is what Whisper actually heard,
    which may differ from the declared source_lang (e.g. user set EN but spoke HI).
    """
    try:
        print(f"[DEBUG WHISPER] Starting transcription with model={model_name} on {_DEVICE}")
        loop = asyncio.get_event_loop()
        whisper_lang = None if source_lang == "auto" else _WHISPER_LANG_NORM.get(source_lang, source_lang)
        kwargs = {"task": "transcribe", "fp16": False}
        if whisper_lang:
            kwargs["language"] = whisper_lang
        if prompt:
            kwargs["initial_prompt"] = prompt

        def _transcribe_with_device(device: str):
            model = get_whisper_model(model_name, device=device)
            local_kwargs = dict(kwargs)
            local_kwargs["fp16"] = device == "cuda"
            print(f"[DEBUG WHISPER] Executing inference on {device}...")
            return model.transcribe(file_path, **local_kwargs)

        result = await loop.run_in_executor(None, lambda: _transcribe_with_device(_DEVICE))

        text = result.get("text", "").strip()
        detected_lang = result.get("language") or (source_lang if source_lang != "auto" else "en")
        # Reverse-normalize: Whisper returns "zh" — keep app codes consistent
        if source_lang in ("zh-CN", "zh-TW") and detected_lang == "zh":
            detected_lang = source_lang
        print(f"[DEBUG WHISPER] Transcription successful (detected={detected_lang}): {text[:20]}...")
        return text, detected_lang
    except Exception as e:
        raise ValueError(f"Whisper Local Error: {str(e)}")
