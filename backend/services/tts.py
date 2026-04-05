import base64
import asyncio
import io
import httpx
from config import Config

LANG_MAP_GTTS = {
    # Indian
    "en": "en", "hi": "hi", "bn": "bn", "te": "te", "mr": "mr",
    "ta": "ta", "ur": "ur", "gu": "gu", "pa": "pa",
    # International
    "zh-TW": "zh-TW", "zh-CN": "zh-CN", "fr": "fr", "de": "de",
    "ru": "ru", "ja": "ja", "ko": "ko", "ar": "ar",
    # Sanskrit not supported by gTTS — falls back to code directly
}

async def _elevenlabs_tts(text: str, voice_id: str = "", voice_style: str = "") -> str:
    """ElevenLabs TTS — high quality, requires API key."""
    if not Config.ELEVENLABS_API_KEY or Config.ELEVENLABS_API_KEY == "your_elevenlabs_api_key_here":
        raise ValueError("ELEVENLABS_API_KEY is missing or invalid.")

    v_id = voice_id.strip() if voice_id and voice_id.strip() else Config.ELEVENLABS_VOICE_ID
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{v_id}"

    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": Config.ELEVENLABS_API_KEY
    }

    stability_val = 0.5
    if voice_style == "expressive":
        stability_val = 0.25
    elif voice_style == "neutral":
        stability_val = 0.75

    data = {
        "text": text,
        "model_id": Config.ELEVENLABS_MODEL,
        "voice_settings": {
            "stability": stability_val,
            "similarity_boost": 0.5
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers, timeout=30.0)
        if response.status_code != 200:
            raise ValueError(f"ElevenLabs API Error: {response.text}")
        return base64.b64encode(response.content).decode('utf-8')


async def _gtts_tts(text: str, target_lang: str) -> str:
    """Google TTS fallback — free, no API key needed."""
    from gtts import gTTS

    if target_lang not in LANG_MAP_GTTS:
        raise ValueError(f"Language '{target_lang}' is not supported by gTTS fallback.")
    lang_code = LANG_MAP_GTTS[target_lang]

    def _synthesize():
        buf = io.BytesIO()
        tts = gTTS(text=text, lang=lang_code)
        tts.write_to_fp(buf)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode('utf-8')

    return await asyncio.get_event_loop().run_in_executor(None, _synthesize)


async def generate_speech(text: str, target_lang: str, voice_id: str = "", voice_style: str = "", provider: str = "elevenlabs") -> str:
    """Route to the requested TTS provider. Falls back to gTTS on failure."""
    if provider == "gtts":
        print(f"[TTS] Using gTTS provider")
        return await _gtts_tts(text, target_lang)

    if provider == "piper":
        print(f"[TTS] Using Piper (local) provider")
        from services.tts_piper import piper_tts
        try:
            return await piper_tts(text, target_lang)
        except Exception as e:
            print(f"[TTS] Piper failed ({e}), falling back to gTTS")
            return await _gtts_tts(text, target_lang)

    # Default: ElevenLabs with gTTS fallback
    try:
        return await _elevenlabs_tts(text, voice_id, voice_style)
    except Exception as e:
        print(f"[TTS] ElevenLabs failed ({e}), falling back to gTTS")
        return await _gtts_tts(text, target_lang)
