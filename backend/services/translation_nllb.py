from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import asyncio
import threading
import torch
from typing import Optional as _Optional

if not torch.cuda.is_available():
    raise RuntimeError("NLLB requires a CUDA GPU. No GPU detected.")
_DEVICE = "cuda"
_DTYPE  = torch.float16

# Global cache for NLLB
_nllb_cache = {}
_nllb_lock = threading.Lock()

# Semaphore to serialize GPU inference — NLLB model.generate() is not thread-safe
# when called concurrently from multiple threads on the same model instance.
# This prevents concurrent GPU calls from corrupting each other's outputs and
# avoids OOM from stacking beam-search activations.
_nllb_inference_semaphore: _Optional[asyncio.Semaphore] = None

def _get_inference_semaphore() -> asyncio.Semaphore:
    global _nllb_inference_semaphore
    if _nllb_inference_semaphore is None:
        _nllb_inference_semaphore = asyncio.Semaphore(1)
    return _nllb_inference_semaphore

def get_nllb_resources():
    model_name = "facebook/nllb-200-distilled-600M"
    with _nllb_lock:
        if model_name not in _nllb_cache:
            print(f"[DEBUG NLLB] Loading model on {_DEVICE} (dtype={_DTYPE}): {model_name}")
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSeq2SeqLM.from_pretrained(model_name, dtype=_DTYPE)
            model = model.to(_DEVICE)
            model.eval()
            _nllb_cache[model_name] = (model, tokenizer)
        else:
            print(f"[DEBUG NLLB] Using cached model in memory for: {model_name}")
    return _nllb_cache[model_name]

# NLLB FLORES-200 language codes for all supported languages
LANG_MAP = {
    # Indian
    "en": "eng_Latn",
    "hi": "hin_Deva",
    "bn": "ben_Beng",
    "te": "tel_Telu",
    "mr": "mar_Deva",
    "ta": "tam_Taml",
    "ur": "urd_Arab",
    "gu": "guj_Gujr",
    "pa": "pan_Guru",
    "sa": "san_Deva",
    # International
    "zh-TW": "zho_Hant",
    "zh-CN": "zho_Hans",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "ru": "rus_Cyrl",
    "ja": "jpn_Jpan",
    "ko": "kor_Hang",
    "ar": "arb_Arab",
}

import re
from typing import Optional

# Common Romanized Hindustani/Indian words that do NOT appear in standard English.
# If source_lang="en" but the text is full of these, NLLB will produce garbage.
_ROMANIZED_INDIAN = frozenset({
    # Hindustani (Hindi/Urdu)
    "hum", "hai", "hain", "mera", "meri", "mein", "main", "yeh", "ye", "woh", "wo",
    "kya", "nahi", "nahin", "aur", "ke", "ka", "ki", "ko", "se", "jo", "par", "bhi",
    "koi", "sab", "aap", "tum", "unhe", "unka", "mujhe", "tumhe", "kyunki", "lekin",
    "phir", "jab", "tab", "kab", "kahan", "kaisa", "kitna", "sirf", "bas", "matlab",
    "bilkul", "zaroor", "abhi", "kal", "aaj", "accha", "theek", "bahut", "doston",
    "dost", "bhai", "yaar", "sahib", "beta", "beti", "gaana", "gaate", "khana",
    "paani", "ghar", "kaam", "jana", "aana", "rehna", "bolna", "sunna", "dekho",
    "samajh", "chahiye", "chahte", "chahti", "milna", "milte", "karke", "karein",
    # Tamil (Romanized)
    "naan", "nee", "avan", "aval", "enna", "epdi", "illai", "irukku", "vanakkam",
    # Telugu (Romanized)
    "nenu", "meeru", "idi", "emi", "ela", "emiti", "cheppandi", "chestanu",
    # Gujarati (Romanized)
    "tame", "ame", "chhe", "che", "nathi", "karvo", "javanu",
    # Bengali (Romanized)
    "ami", "tumi", "apni", "kemon", "achho", "ache", "ektu", "amader",
    # Marathi (Romanized)
    "mala", "tumhi", "ahe", "nahi", "aho", "hoye", "karay",
})

def _is_romanized_indian(text: str) -> bool:
    """Returns True if text declared as English is actually Romanized Indian language."""
    words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
    if not words:
        return False
    hits = sum(1 for w in words if w in _ROMANIZED_INDIAN)
    # ≥2 matching words, or >20% of the sentence matches
    return hits >= 2 or (len(words) >= 5 and hits / len(words) > 0.20)


# NLLB-200 is a sentence-pair model trained on ~30-100 token sequences. Even inputs
# well under the 1024 positional limit cause early EOS if the text spans many sentences.
# 150 tokens (~100 words) matches NLLB's reliable quality range per chunk.
_NLLB_TOKEN_LIMIT = 150


def _tok_len(tokenizer, text: str, src_lang_code: str) -> int:
    """Return the tokenized length of text (includes special tokens)."""
    return len(tokenizer(text, src_lang=src_lang_code)["input_ids"])


def _split_by_words(text: str, tokenizer, src_lang_code: str, max_tokens: int) -> list:
    """Split text at word boundaries so each piece tokenizes to <= max_tokens."""
    words = text.split()
    if not words:
        return [text]
    chunks = []
    buf = ""
    for word in words:
        candidate = (buf + " " + word) if buf else word
        if _tok_len(tokenizer, candidate, src_lang_code) > max_tokens and buf:
            chunks.append(buf)
            buf = word
        else:
            buf = candidate
    if buf:
        chunks.append(buf)
    return chunks if chunks else [text]


def _chunk_for_nllb(tokenizer, text: str, src_lang_code: str) -> list:
    """
    Split text into chunks that each tokenize to <= _NLLB_TOKEN_LIMIT.
    Strategy:
      1. Split on sentence-ending punctuation, preserving delimiters.
      2. Greedily accumulate sentences into a chunk; flush before overflow.
      3. If a single sentence exceeds the limit, fall back to word splitting.
    All input content is preserved in order — nothing is dropped.
    """
    limit = _NLLB_TOKEN_LIMIT
    sentences = [s for s in re.split(r'(?<=[.!?;।\n])\s*', text.strip()) if s.strip()]
    if not sentences:
        return [text]

    chunks = []
    buf = ""

    for sent in sentences:
        candidate = (buf + " " + sent).strip() if buf else sent
        if _tok_len(tokenizer, candidate, src_lang_code) <= limit:
            buf = candidate
        else:
            if buf:
                chunks.append(buf)
            if _tok_len(tokenizer, sent, src_lang_code) <= limit:
                buf = sent
            else:
                # Single sentence too long — split at word boundaries
                for piece in _split_by_words(sent, tokenizer, src_lang_code, limit):
                    chunks.append(piece)
                buf = ""

    if buf:
        chunks.append(buf)

    return chunks if chunks else [text]


async def translate_nllb(text: str, source_lang: str, target_lang: str, glossary: Optional[str] = None) -> str:
    """Uses local Meta NLLB-200 model for translation. Supports basic Glossary via post-processing."""
    try:
        print(f"[DEBUG NLLB] Starting translation for text length: {len(text)}")
        loop = asyncio.get_event_loop()

        if source_lang == "auto":
            raise ValueError("NLLB_FALLBACK: source language is 'auto' — NLLB needs an explicit language.")
        if source_lang not in LANG_MAP:
            raise ValueError(f"NLLB_FALLBACK: source language '{source_lang}' not supported by NLLB.")
        # Detect Romanized Indian text mis-declared as English — NLLB cannot translate this.
        if source_lang == "en" and _is_romanized_indian(text):
            raise ValueError("NLLB_FALLBACK: transcript appears to be Romanized Indian text, not English. NLLB requires properly written source text.")
        if target_lang not in LANG_MAP:
            raise ValueError(f"Target language '{target_lang}' not supported by NLLB model.")
            
        src_lang_code = LANG_MAP[source_lang]
        tgt_lang_code = LANG_MAP[target_lang]

        print(f"[DEBUG NLLB] Translating from {src_lang_code} to {tgt_lang_code}")

        def _load_and_infer():
            model, tokenizer = get_nllb_resources()
            print("[DEBUG NLLB] Executing generation inference...")
            tgt_token_id = tokenizer.convert_tokens_to_ids(tgt_lang_code)

            def _translate_chunk(chunk: str) -> str:
                inputs = tokenizer(chunk, return_tensors="pt", src_lang=src_lang_code).to(_DEVICE)
                input_len = inputs["input_ids"].shape[1]
                # Allow output up to 3x the input length; floor at 128 for very short chunks.
                max_len = max(128, input_len * 3)
                with torch.inference_mode():
                    translated_tokens = model.generate(
                        **inputs,
                        forced_bos_token_id=tgt_token_id,
                        max_length=max_len,
                        num_beams=8,
                        length_penalty=1.2,
                        repetition_penalty=1.3,
                        early_stopping=False,
                    )
                return tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]

            # Always split by sentences — translating multiple sentences together
            # causes NLLB to silently drop earlier sentences. Each sentence
            # gets its own inference pass so nothing is lost.
            chunks = _chunk_for_nllb(tokenizer, text, src_lang_code)
            print(f"[DEBUG NLLB] Translating {len(chunks)} chunk(s)...")
            res = " ".join(_translate_chunk(c) for c in chunks)

            print(f"[DEBUG NLLB] Generation successful: {res[:20]}...")
            return res

        async with _get_inference_semaphore():
            result = await loop.run_in_executor(None, _load_and_infer)
        result = result.strip()
        
        if glossary and glossary.strip():
            print("[DEBUG NLLB] Applying glossary replacements...")
            import re
            for line in glossary.strip().split('\n'):
                if '->' in line:
                    term, mapped = line.split('->', 1)
                    term = term.strip()
                    mapped = mapped.strip()
                    # Case-insensitive whole-word replacement
                    result = re.sub(re.escape(term), mapped, result, flags=re.IGNORECASE)
                    
        return result
    except Exception as e:
        raise ValueError(f"NLLB Local Error: {str(e)}")
