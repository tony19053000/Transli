from typing import Optional
from services.translation_gemini import translate_gemini, summarize_gemini
from services.translation_nllb import translate_nllb

async def translate_text(text: str, source_lang: str, target_lang: str, provider: str = "gemini", context: Optional[str] = None, glossary: Optional[str] = None) -> str:
    """Dispatcher for Translation providers."""
    print(f"[DEBUG TRANSLATION DISPATCHER] Dispatching translation to provider: {provider}")
    if provider == "nllb":
        try:
            return await translate_nllb(text, source_lang, target_lang, glossary=glossary)
        except ValueError as e:
            # NLLB_FALLBACK prefix means NLLB detected an input it fundamentally can't handle
            # (wrong language, auto-detect, Romanized text). Fall back to Gemini gracefully.
            if str(e).startswith("NLLB_FALLBACK"):
                print(f"[TRANSLATION] NLLB fallback to Gemini: {e}")
                return await translate_gemini(text, source_lang, target_lang, context, glossary)
            raise
    else:
        # Default to Gemini
        return await translate_gemini(text, source_lang, target_lang, context, glossary)

async def summarize_text(text: str, provider: str = "gemini") -> str:
    """Dispatcher for Session Summarizer"""
    if provider == "nllb":
        # NLLB is a pure MT model, it cannot easily summarize. Document limitation natively and fallback to gemini or raise.
        print("[WARNING] NLLB cannot summarize. Falling back to Gemini.")
        return await summarize_gemini(text)
    else:
        return await summarize_gemini(text)
