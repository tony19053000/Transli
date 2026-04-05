# AI Live Voice Translator

A real-time, multi-page voice translation application that records speech, transcribes it, translates it across languages, and speaks the result back — all from your browser.

## Features

| Feature | Description |
|---------|-------------|
| **Quick Translate** | Record a phrase and get instant translation with audio playback |
| **Live Conversation** | Two-speaker sequential interpreted conversation mode |
| **File & Visual Translation** | Upload audio, document, or image files for translation (incl. OCR) |
| **History & Downloads** | Persistent session history with search, filtering, and TXT/JSON export |
| **Settings** | Configure AI models, languages, glossary, TTS voices, accessibility, and intelligence features |

## Intelligence Features

- **Auto Language Detection** — Whisper + Gemini automatically identify the source language
- **Context-Aware Translation** — Live Conversation feeds recent turns into Gemini for pronoun/reference consistency
- **Glossary / Protected Words** — Define term mappings that are enforced during translation
- **One-to-Many Translation** — Translate a single recording into multiple target languages simultaneously
- **Session Summarization** — Generate AI summaries of conversations and translated documents
- **TTS Voice Selection** — Choose from multiple ElevenLabs voices (Rachel, Clyde, Domi, Bella, Antoni)

## Accessibility & Usability

| Setting | Description |
|---------|-------------|
| High Contrast Mode | Replaces glassmorphism with solid high-contrast borders and backgrounds |
| Large Subtitles | Increases font size on transcript and translation text across all pages |
| Playback Speed | Adjustable 0.5x–2.0x speed for all TTS audio playback |
| Voice Expressiveness | Choose between Neutral (stable) and Expressive (dynamic) TTS voice styles |
| Dialect/Vocabulary Hint | Provide context to local Whisper STT for improved dialect recognition |
| Local-Preferred Mode | Override to prioritize local models (Whisper + NLLB) over cloud providers |

## Supported Languages

| Language | Code |
|----------|------|
| English  | en   |
| Hindi    | hi   |
| Spanish  | es   |
| French   | fr   |
| German   | de   |

All 5 languages work end-to-end with both cloud (ElevenLabs + Gemini) and local (Whisper + NLLB) providers.

## Architecture

| Layer | Technology |
|-------|-----------| 
| **Frontend** | React + Vite |
| **Backend** | Python FastAPI |
| **STT** | ElevenLabs (cloud) or Whisper (local) |
| **Translation** | Google Gemini (cloud) or Meta NLLB-200 (local) |
| **TTS** | ElevenLabs (cloud, fixed provider) |
| **OCR** | Tesseract + Pillow (local, for image translation) |

## Prerequisites

- **Node.js** v18+
- **Python** 3.9+
- **FFmpeg** — Required for local Whisper STT processing
- **tesseract-ocr** — Required for Visual/Image translation (OCR). Install via `sudo apt install tesseract-ocr` on Debian/Ubuntu or `brew install tesseract` on macOS.
- **Disk Space** — ~3 GB free if using local models (Whisper & NLLB)
- System microphone accessible via browser

## Setup

### 1. API Keys

Create `backend/.env`:

```env
GEMINI_API_KEY="your-gemini-key"
ELEVENLABS_API_KEY="your-elevenlabs-key"
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite (typically `http://localhost:5173/`).

## Default Configuration

| Setting | Default |
|---------|---------|
| STT Provider | ElevenLabs (Cloud) |
| Translation Provider | Gemini (Cloud) |
| Auto-Detect Language | Enabled |
| Context-Aware Translation | Enabled |
| Default Target Language | Hindi |
| TTS Voice | Default (ElevenLabs) |
| High Contrast | Off |
| Large Subtitles | Off |
| Playback Speed | 1.0x |
| Local-Preferred Mode | Off |

## Supported File Types

| Type | Extensions |
|------|-----------| 
| Audio | .mp3, .wav, .m4a, .webm |
| Documents | .txt, .pdf, .docx |
| Images (OCR) | .png, .jpg, .jpeg |
| Max Size | 10 MB |

## Demo Flow

1. Open the app → Quick Translate loads with auto-detect enabled
2. Click **Start Speaking** → say a phrase in any supported language
3. The app transcribes, detects the language, translates to Hindi, and plays the audio
4. Switch to **Live Conversation** → alternate between Speaker 1 and Speaker 2
5. Click **Summarize** to generate an AI session summary
6. Visit **File & Visual Translation** → drop an audio, document, or image file for translation
7. Check **History & Downloads** → review, search, and export past translations
8. Visit **Settings** → switch providers, add glossary terms, select TTS voices, enable accessibility modes

## Known Limitations

- **NLLB** does not support auto-detect or context-aware translation (Gemini-only features)
- **NLLB** glossary support uses post-processing string replacement (less precise than Gemini prompt injection)
- **TTS** is ElevenLabs-only; no local TTS fallback exists
- **OCR** quality depends on image clarity and text contrast; tesseract-ocr must be installed separately
- **Local-Preferred Mode** reduces STT to Whisper and Translation to NLLB — cloud-only features (auto-detect, context) become unavailable or degraded
- Local models (Whisper, NLLB) require significant disk space and GPU for best performance
- File uploads are capped at 10 MB

## Project Structure

```
ai-live-translator/
├── backend/
│   ├── main.py              # FastAPI endpoints
│   ├── config.py             # Environment config
│   ├── services/
│   │   ├── stt.py            # STT dispatcher
│   │   ├── stt_whisper.py    # Local Whisper STT
│   │   ├── translation.py    # Translation dispatcher
│   │   ├── translation_gemini.py  # Gemini translation + summarization
│   │   ├── translation_nllb.py    # NLLB local translation
│   │   ├── tts.py            # ElevenLabs TTS
│   │   ├── text_extract.py   # Document + OCR text extraction
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Root component + state management
│   │   ├── components/
│   │   │   └── Sidebar.jsx   # Navigation sidebar
│   │   ├── pages/
│   │   │   ├── QuickTranslate.jsx
│   │   │   ├── LiveConversation.jsx
│   │   │   ├── FileTranslation.jsx

│   │   └── utils/
│   │       └── historyStorage.js  # localStorage persistence
│   └── package.json
└── README.md
```
