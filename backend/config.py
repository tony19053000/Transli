import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
    
    # Model Configurations
    GEMINI_MODEL = "gemini-2.5-flash"
    ELEVENLABS_STT_MODEL = "scribe_v1"
    
    # ElevenLabs TTS Configurations
    ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
    ELEVENLABS_MODEL = "eleven_multilingual_v2"
