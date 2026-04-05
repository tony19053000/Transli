import httpx
from config import Config

# ElevenLabs Scribe uses ISO 639-1. Normalize BCP-47 variants the app uses.
_ELEVENLABS_LANG_NORM = {
    "zh-CN": "zh",
    "zh-TW": "zh",
}

async def transcribe_elevenlabs(file_path: str, source_lang: str) -> tuple[str, str]:
    """Uses ElevenLabs Speech-to-Text API to transcribe audio.
    Returns (transcript, source_lang) — ElevenLabs doesn't expose detected language,
    so source_lang is passed through as-is for pipeline consistency.
    """
    if not Config.ELEVENLABS_API_KEY or Config.ELEVENLABS_API_KEY == "your_elevenlabs_api_key_here":
        raise ValueError("ELEVENLABS_API_KEY is missing or invalid.")

    url = "https://api.elevenlabs.io/v1/speech-to-text"
    headers = {"xi-api-key": Config.ELEVENLABS_API_KEY}

    with open(file_path, "rb") as audio_file:
        files = {"file": (file_path.split("/")[-1], audio_file, "audio/webm")}
        data = {"model_id": Config.ELEVENLABS_STT_MODEL}
        if source_lang and source_lang != "auto":
            data["language_code"] = _ELEVENLABS_LANG_NORM.get(source_lang, source_lang)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, data=data, files=files, headers=headers, timeout=60.0)
            except httpx.TimeoutException:
                raise ValueError("ElevenLabs STT provider timed out or could not connect. This is typically temporary.")
            except httpx.RequestError as e:
                raise ValueError(f"ElevenLabs STT Network Error: {str(e)}")
                
            if response.status_code != 200:
                raise ValueError(f"ElevenLabs STT Error: {response.text}")
            return response.json().get("text", ""), source_lang
