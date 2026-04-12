import os
import time
import json
import asyncio
import tempfile
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from services.stt import transcribe_audio
from services.translation import translate_text, summarize_text
from services.tts import generate_speech

app = FastAPI(title="AI Voice Translator API")

# Harden CORS for frontend integration correctly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup warmup ────────────────────────────────────────────────────────────
# Pre-load local model weights into memory so the first real user request is
# fast. Each step is isolated — a missing model just logs a skip and moves on.
# Nothing here changes model settings, accuracy, or inference behaviour.

async def _run_warmup():
    from services.stt_whisper import get_whisper_model
    from services.translation_nllb import get_nllb_resources, translate_nllb
    from services.tts_piper import get_piper_voice, piper_tts

    print("[WARMUP] Pre-loading local models in background...")

    try:
        await asyncio.to_thread(get_whisper_model, "base")
        print("[WARMUP] Whisper ready")
    except Exception as e:
        print(f"[WARMUP] Whisper skipped: {e}")

    try:
        await asyncio.to_thread(get_nllb_resources)
        print("[WARMUP] NLLB weights loaded — running inference warmup...")
        # Fire a short dummy translation to compile CUDA kernels now, not on first real request
        await translate_nllb("Hello.", "en", "hi")
        print("[WARMUP] NLLB inference kernels compiled and ready")
    except Exception as e:
        print(f"[WARMUP] NLLB skipped: {e}")

    for lang in ("en", "hi"):
        try:
            await asyncio.to_thread(get_piper_voice, lang)
            print(f"[WARMUP] Piper voice ready: {lang}")
        except Exception as e:
            print(f"[WARMUP] Piper voice skipped ({lang}): {e}")

    try:
        # Compile Piper's ONNX graph on first synthesis so it's not counted against first request
        await piper_tts("Hello.", "en")
        print("[WARMUP] Piper synthesis ready")
    except Exception as e:
        print(f"[WARMUP] Piper synthesis skipped: {e}")

    print("[WARMUP] All models warmed up — first request will be full speed")

@app.on_event("startup")
async def warmup_local_models():
    await _run_warmup()

# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/translate")
async def translate_audio_endpoint(
    audio: Optional[UploadFile] = File(None),
    text: str = Form(""),
    source_lang: str = Form("en"),
    target_lang: str = Form("hi"),
    stt_provider: str = Form("elevenlabs"),
    translation_provider: str = Form("gemini"),
    tts_provider: str = Form("elevenlabs"),
    context_text: str = Form(""),
    glossary: str = Form(""),
    voice_id: str = Form("")
):
    if not audio and not text.strip():
        raise HTTPException(status_code=400, detail="Provide either an audio file or text input.")

    try:
        t0 = time.perf_counter()
        stt_time = 0.0

        if audio and audio.filename:
            # Audio path — run STT
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
                temp_file.write(await audio.read())
                temp_file_path = temp_file.name
            try:
                print(f"[DEBUG MAIN] Received STT Provider: {stt_provider}")
                print(f"[DEBUG MAIN] Received Translation Provider: {translation_provider}")
                transcript, detected_lang = await transcribe_audio(temp_file_path, source_lang, provider=stt_provider)
                t1 = time.perf_counter()
                stt_time = round(t1 - t0, 3)  # type: ignore[no-matching-overload]
                print(f"[TIMING] STT ({stt_provider}): {stt_time}s")
            finally:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
        else:
            # Text path — skip STT
            transcript = text.strip()
            detected_lang = source_lang
            print(f"[DEBUG MAIN] Text mode — skipping STT. Translation Provider: {translation_provider}")

        if not transcript:
            return {"error": "Could not understand audio.", "transcript": "", "translated_text": "", "audio_base64": None, "debug_stt_received": stt_provider, "debug_trans_received": translation_provider}

        # 2. Text execution
        t2 = time.perf_counter()
        translated_text = await translate_text(transcript, source_lang, target_lang, provider=translation_provider, context=context_text, glossary=glossary)
        t3 = time.perf_counter()
        trans_time = round(t3 - t2, 3)
        print(f"[TIMING] Translation ({translation_provider}): {trans_time}s")

        # 3. Speech Execution — unwrap Gemini auto-detect JSON before TTS
        tts_text = translated_text
        try:
            parsed = json.loads(translated_text)
            if isinstance(parsed, dict) and "translation" in parsed:
                tts_text = parsed["translation"]
        except Exception:
            pass
        print(f"[DEBUG MAIN] Routing to TTS provider: {tts_provider}")
        t4 = time.perf_counter()
        audio_base64 = await generate_speech(tts_text, target_lang, voice_id=voice_id, provider=tts_provider)
        t5 = time.perf_counter()
        tts_time = round(t5 - t4, 3)
        total_time = round(t5 - t0, 3)
        print(f"[TIMING] TTS ({tts_provider}): {tts_time}s")
        print(f"[TIMING] Total pipeline: {total_time}s")

        return {
            "transcript": transcript,
            "translated_text": tts_text,
            "audio_base64": audio_base64,
            "timing": {
                "stt_time": stt_time,
                "translation_time": trans_time,
                "tts_time": tts_time,
                "total_time": total_time,
                "stt_provider": stt_provider,
                "translation_provider": translation_provider,
                "tts_provider": tts_provider
            }
        }
        
    except ValueError as ve:
        # Bubble specific credential or execution checks directly accurately
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/translate-multi")
async def translate_multi_endpoint(
    audio: Optional[UploadFile] = File(None),
    text: str = Form(""),
    source_lang: str = Form("en"),
    target_langs: str = Form("hi"), # comma separated
    stt_provider: str = Form("elevenlabs"),
    translation_provider: str = Form("gemini"),
    tts_provider: str = Form("elevenlabs"),
    context_text: str = Form(""),
    glossary: str = Form(""),
    voice_id: str = Form("")
):
    """Endpoint for one-to-many translations. Runs STT once, translates safely to multiple targets."""
    if not audio and not text.strip():
        raise HTTPException(status_code=400, detail="Provide either an audio file or text input.")

    # Clean the requested target languages
    requested_langs = [l.strip() for l in target_langs.split(",") if l.strip()]
    if not requested_langs:
        raise HTTPException(status_code=400, detail="No target languages provided")
    if len(requested_langs) > 10:
        raise HTTPException(status_code=400, detail="Too many target languages. Maximum is 10.")

    try:
        t0 = time.perf_counter()
        stt_time = 0.0

        if audio and audio.filename:
            # Audio path — run STT
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
                temp_file.write(await audio.read())
                temp_file_path = temp_file.name
            try:
                print(f"[DEBUG MAIN] Multi-Translate STT Provider: {stt_provider}")
                transcript, detected_lang = await transcribe_audio(temp_file_path, source_lang, provider=stt_provider)
                t1 = time.perf_counter()
                stt_time = round(t1 - t0, 3)  # type: ignore[no-matching-overload]
                print(f"[TIMING] STT ({stt_provider}): {stt_time}s")
            finally:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
        else:
            # Text path — skip STT
            transcript = text.strip()
            detected_lang = source_lang
            print(f"[DEBUG MAIN] Multi text mode — skipping STT. Translation Provider: {translation_provider}")

        if not transcript:
            return {"error": "Could not understand audio.", "transcript": "", "translations": []}

        import json as _json

        async def _translate_lang(tgt_lang):
            translated_text = await translate_text(transcript, source_lang, tgt_lang, provider=translation_provider, context=context_text, glossary=glossary)
            return tgt_lang, translated_text

        async def _tts_lang(tgt_lang, translated_text):
            tts_text = translated_text
            try:
                parsed = _json.loads(translated_text)
                if isinstance(parsed, dict) and "translation" in parsed:
                    tts_text = parsed["translation"]
            except Exception:
                pass
            audio_base64 = await generate_speech(tts_text, tgt_lang, voice_id=voice_id, provider=tts_provider)
            return tgt_lang, audio_base64

        # Phase 1: all translations in parallel — wall-clock = slowest single translation
        t_trans_start = time.perf_counter()
        trans_results = await asyncio.gather(*[_translate_lang(lang) for lang in requested_langs], return_exceptions=True)
        trans_wall = round(time.perf_counter() - t_trans_start, 3)

        # Build translation map; mark failed langs
        trans_map = {}
        translations = []
        for lang, r in zip(requested_langs, trans_results):
            if isinstance(r, Exception):
                translations.append({"lang": lang, "error": str(r)})
            else:
                _, translated_text = r
                try:
                    parsed = json.loads(translated_text)
                    if isinstance(parsed, dict) and "translation" in parsed:
                        translated_text = parsed["translation"]
                except Exception:
                    pass
                trans_map[lang] = translated_text

        # Phase 2: TTS for successful translations in parallel — wall-clock = slowest single TTS
        t_tts_start = time.perf_counter()
        tts_langs = [lang for lang in requested_langs if lang in trans_map]
        tts_results = await asyncio.gather(
            *[_tts_lang(lang, trans_map[lang]) for lang in tts_langs],
            return_exceptions=True
        )
        tts_wall = round(time.perf_counter() - t_tts_start, 3)

        for lang, r in zip(tts_langs, tts_results):
            if isinstance(r, Exception):
                translations.append({"lang": lang, "error": str(r)})
            else:
                _, audio_base64 = r
                translations.append({
                    "lang": lang,
                    "translated_text": trans_map[lang],
                    "audio_base64": audio_base64,
                })

        # Restore original lang order
        lang_order = {lang: i for i, lang in enumerate(requested_langs)}
        translations.sort(key=lambda x: lang_order.get(x.get("lang", ""), 999))

        total_time = round(time.perf_counter() - t0, 3)
        print(f"[TIMING] Multi Trans wall ({translation_provider}): {trans_wall}s | TTS wall ({tts_provider}): {tts_wall}s | Total: {total_time}s")

        return {
            "transcript": transcript,
            "translations": translations,
            "timing": {
                "stt_time": stt_time,
                "translation_time": trans_wall,
                "tts_time": tts_wall,
                "total_time": total_time,
                "stt_provider": stt_provider,
                "translation_provider": translation_provider,
                "tts_provider": tts_provider,
                "lang_count": len(requested_langs),
            }
        }
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/translate-text")
async def translate_text_file_endpoint(
    file: UploadFile = File(...),
    source_lang: str = Form("en"),
    target_lang: str = Form("hi"),
    translation_provider: str = Form("gemini"),
    context_text: str = Form(""),
    glossary: str = Form("")
):
    """Endpoint for translating text/document files (.txt, .pdf, .docx)."""
    from services.text_extract import extract_text

    ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx", ".png", ".jpg", ".jpeg"}
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit

    # Validate extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Supported: {', '.join(ALLOWED_EXTENSIONS)}")

    try:
        file_bytes = await file.read()

        # Validate size
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File exceeds 10 MB size limit.")
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # Write to temp file for extraction
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            print(f"[DEBUG FILE-TRANSLATE] Extracting text from {file.filename} ({ext})")
            original_text = await extract_text(tmp_path)

            if not original_text.strip():
                raise ValueError("No text content could be extracted from the file.")

            # Combine file content with context if provided, else just file content
            # Wait, for files, we might just pass glossary. 
            print(f"[DEBUG FILE-TRANSLATE] Extracted {len(original_text)} chars. Translating with {translation_provider}...")
            t0 = time.perf_counter()

            if translation_provider == "nllb":
                # NLLB's internal chunker greedily combines short sentences into one chunk,
                # then NLLB drops sentences from that combined blob. Fix: split into sentences
                # here and translate each one independently so NLLB gets one sentence at a time.
                import re as _re
                sentences = [s.strip() for s in _re.split(r'(?<=[.!?;।])\s+', original_text.strip()) if s.strip()]
                print(f"[DEBUG FILE-TRANSLATE] NLLB mode: translating {len(sentences)} sentences individually")
                translated_parts = []
                for sent in sentences:
                    part = await translate_text(sent, source_lang, target_lang, provider=translation_provider, context=context_text, glossary=glossary)
                    translated_parts.append(part)
                translated_text = " ".join(translated_parts)
            else:
                translated_text = await translate_text(original_text, source_lang, target_lang, provider=translation_provider, context=context_text, glossary=glossary)

            t1 = time.perf_counter()
            trans_time = round(float(t1 - t0), 3)  # type: ignore
            print(f"[TIMING] File translation ({translation_provider}): {trans_time}s")

            try:
                parsed = json.loads(translated_text)
                if isinstance(parsed, dict) and "translation" in parsed:
                    translated_text = parsed["translation"]
            except Exception:
                pass

            return {
                "original_text": original_text,
                "translated_text": translated_text,
                "filename": file.filename,
                "file_type": ext,
                "timing": {
                    "translation_time": trans_time,
                    "translation_provider": translation_provider
                }
            }
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/summarize")
async def summarize_endpoint(
    text: str = Form(...),
    translation_provider: str = Form("gemini")
):
    try:
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="No text provided for summarization.")
        
        t0 = time.perf_counter()
        summary = await summarize_text(text, provider=translation_provider)
        t1 = time.perf_counter()
        
        return {
            "summary": summary,
            "timing": {
                "summarization_time": round(t1 - t0, 3)
            }
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tts")
async def tts_endpoint(
    text: str = Form(...),
    lang: str = Form("en"),
    provider: str = Form("elevenlabs"),
    voice_id: str = Form("")
):
    """Standalone TTS endpoint — converts text to speech audio."""
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="No text provided for TTS.")

    try:
        t0 = time.perf_counter()
        clean_text = text.strip()
        if clean_text.startswith('{') and clean_text.endswith('}'):
            try:
                parsed = json.loads(clean_text)
                clean_text = parsed.get("translation") or parsed.get("text") or clean_text
            except Exception:
                pass
        audio_base64 = await generate_speech(clean_text, lang, voice_id=voice_id, provider=provider)
        t1 = time.perf_counter()
        print(f"[TIMING] Standalone TTS ({provider}): {round(t1 - t0, 3)}s")

        return {
            "audio_base64": audio_base64,
            "timing": {
                "tts_time": round(t1 - t0, 3),
                "tts_provider": provider
            }
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

frontend_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../frontend/dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
