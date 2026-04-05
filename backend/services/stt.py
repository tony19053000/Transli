from services.stt_elevenlabs import transcribe_elevenlabs
from services.stt_whisper import transcribe_whisper

async def transcribe_audio(file_path: str, source_lang: str, provider: str = "elevenlabs", prompt: str = "") -> tuple[str, str]:
    """Dispatcher for STT providers.
    Returns (transcript, detected_lang).
    detected_lang = language Whisper actually heard (may differ from source_lang).
    For ElevenLabs, detected_lang == source_lang (no detection available).
    """
    print(f"[DEBUG STT DISPATCHER] Dispatching STT to provider: {provider}")
    if provider == "whisper":
        return await transcribe_whisper(file_path, source_lang, model_name="base", prompt=prompt)
    else:
        # Default to ElevenLabs
        return await transcribe_elevenlabs(file_path, source_lang)
