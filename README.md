```text
   ████████╗██████╗  █████╗ ███╗   ██╗███████╗██╗     ██╗
   ╚══██╔══╝██╔══██╗██╔══██╗████╗  ██║██╔════╝██║     ██║
      ██║   ██████╔╝███████║██╔██╗ ██║███████╗██║     ██║
      ██║   ██╔══██╗██╔══██║██║╚██╗██║╚════██║██║     ██║
      ██║   ██║  ██║██║  ██║██║ ╚████║███████║███████╗██║
      ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝╚═╝
```

<div align="center">

**Real-time multi-modal speech translation with hybrid cloud and local AI.**

[📦 Source Code](https://github.com/tony19053000/Transli.git)

---

*Speak in one language. Hear it back in another. Skip the copy-paste translation loop.*

</div>

---

## The Real Bottleneck in Cross-Language Communication

Every translation tool on the market gives you a text box and a swap button. Almost none of them solve the part that actually breaks the flow:

> You're in a meeting with someone who speaks Hindi. You pull out your phone, open a translator, type what you want to say, copy the result, read it out loud — badly — and wait while they do the same thing back. The conversation dies somewhere between the third tab switch and the autocorrect mishap.
>
> Or you have a PDF invoice in Spanish. You copy-paste paragraphs into Google Translate, lose the formatting, guess at the context, and end up with something that's technically translated but practically useless.

That's not translation. That's friction with a language dropdown.

The bottleneck in multilingual communication has never been about translation accuracy alone. It's about **getting speech in and translated speech out without breaking the conversational flow**. If your tool still expects a human to type, copy, paste, and read aloud, you haven't solved the problem — you've just moved the dictionary into a browser.

**Transli attacks that bottleneck directly.**

You speak into the mic. The AI hears it, transcribes it, translates it, and speaks it back in the target language. You review the text if you want. The whole loop — voice in, voice out — completes in 1.5 to 9.6 seconds depending on the provider combination you choose.

---

## How It Works

```text
   ┌──────────────────────────┐
   │  Speak into Browser Mic   │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │  Record WebM Audio Blob   │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────────────┐
   │  Speech-to-Text                  │
   │  → ElevenLabs Scribe (cloud)     │
   │  → OpenAI Whisper base (local)   │
   └──────────┬───────────────────────┘
              │
              ▼
   ┌──────────────────────────────────┐
   │  Translation                     │
   │  → Gemini 2.5 Flash (cloud)      │
   │  → Meta NLLB-200 (local)         │
   │  → glossary + context injection  │
   └──────────┬───────────────────────┘
              │
              ▼
   ┌──────────────────────────────────┐
   │  Text-to-Speech                  │
   │  → ElevenLabs (cloud)            │
   │  → Piper ONNX (local, CPU)       │
   │  → gTTS (free fallback)          │
   └──────────┬───────────────────────┘
              │
              ▼
   ┌──────────────────────────────────┐
   │  Play Translated Audio            │
   │  → display transcript + translation│
   │  → save to browser history        │
   └──────────────────────────────────┘
```

The entire user flow reduces to four words: **Speak → Translate → Listen → Done.** Every design decision in Transli exists to keep that loop as tight as possible.

---

## Features

Transli does one job and goes deep on it — turning spoken language into translated spoken language, across providers and modes.

**`Quick Translate`** — Speak into the mic. Get back a transcript, translation, and synthesized audio in the target language. One button, one result.

**`Live Conversation`** — Two speakers, two languages, alternating turns. Transli translates each direction in real time, with context from previous turns fed into the AI so pronouns and references stay consistent.

**`File Translation`** — Upload an audio clip, PDF, Word doc, image, or plain text file. Transli extracts the content (OCR for images, text extraction for documents) and translates it. Side-by-side display with downloadable output.

**`One-to-Many Translation`** — Speak once, translate into multiple languages simultaneously. Hindi, French, and German at the same time — each with independent audio playback. Powered by asyncio.gather() for parallel execution.

**`Provider Switching`** — Choose between cloud and local AI for each pipeline stage. ElevenLabs or Whisper for STT. Gemini or NLLB for translation. ElevenLabs, Piper, or gTTS for TTS. Mix and match at runtime — no code changes, no restarts.

**`Fully Offline Mode`** — Set STT to Whisper, translation to NLLB, TTS to Piper. Everything runs locally. No API keys needed. No internet required. Benchmarked at 1.49 seconds total — actually the fastest configuration.

**`Context-Aware Translation`** — In Live Conversation mode, recent turns are passed as context to Gemini. This means "he said" refers to the right person, topic flow is maintained, and idioms don't get mistranslated in isolation.

**`Custom Glossary`** — Define term pairs like `ISRO = ISRO` or `neural network = न्यूरल नेटवर्क`. Glossary terms are enforced during translation — injected into Gemini's prompt or applied as post-processing for NLLB.

**`Session Summaries`** — After a Live Conversation session, click Summarize. Gemini generates a plain-language summary of everything that was discussed.

**`Translation History`** — Every translation is saved to browser localStorage with full metadata. Search, filter by type, delete entries, or export everything as .txt or .json.

**`Accessibility`** — High-contrast mode, large subtitles, and adjustable TTS playback speed (0.5× to 2.0×).

---

## Tech Stack

```text
┌──────────────────────────────────────────────────────┐
│                   Transli Stack                      │
├──────────────┬───────────────────────────────────────┤
│  Frontend    │  React 19, Vite 8, Tailwind CSS 4    │
│  Backend     │  Python, FastAPI, Uvicorn             │
│  STT         │  ElevenLabs Scribe v1, Whisper base  │
│  Translation │  Gemini 2.5 Flash, NLLB-200          │
│  TTS         │  ElevenLabs, Piper ONNX, gTTS        │
│  OCR         │  Tesseract + Pillow                   │
│  Documents   │  PyPDF2, python-docx                  │
│  Audio       │  FFmpeg                               │
└──────────────┴───────────────────────────────────────┘
```

Transli is a decoupled frontend-backend split. The React frontend handles recording, playback, and UI state. The FastAPI backend handles all AI model calls, keeps API keys server-side, and acts as a provider abstraction layer. Whisper and NLLB run on CUDA when a GPU is available. Piper runs on CPU intentionally to keep GPU memory free. The frontend is stateless with respect to AI — every interaction is a REST call; the backend decides which model to invoke.

---

## Provider Combinations

All 12 combinations have been tested on the same long audio clip. All passed.

| #  | STT        | Translation | TTS        | Total Time |
|----|------------|-------------|------------|------------|
| 1  | ElevenLabs | Gemini      | ElevenLabs | 9.64s      |
| 2  | ElevenLabs | Gemini      | Piper      | 20.31s     |
| 3  | ElevenLabs | Gemini      | gTTS       | 15.27s     |
| 4  | ElevenLabs | NLLB        | ElevenLabs | 10.20s     |
| 5  | ElevenLabs | NLLB        | Piper      | 8.61s      |
| 6  | ElevenLabs | NLLB        | gTTS       | 17.83s     |
| 7  | Whisper    | Gemini      | ElevenLabs | 8.56s      |
| 8  | Whisper    | Gemini      | Piper      | 7.06s      |
| 9  | Whisper    | Gemini      | gTTS       | 15.28s     |
| 10 | Whisper    | NLLB        | ElevenLabs | 6.92s      |
| 11 | Whisper    | NLLB        | Piper      | **1.49s**  |
| 12 | Whisper    | NLLB        | gTTS       | 14.00s     |

**Fastest** — Run 11 (Whisper + NLLB + Piper): 1.49s. Fully local, fully free, fully offline.

**Best cloud hybrid** — Run 8 (Whisper + Gemini + Piper): 7.06s. Fast local STT, high-quality context-aware translation, free local TTS.

---

## Local Setup

Get Transli running locally:

```bash
# Clone the repository
git clone https://github.com/tony19053000/Transli.git
cd Transli
```

Install system dependencies:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y ffmpeg tesseract-ocr

# macOS
brew install ffmpeg tesseract
```

Set up API keys (optional for fully local mode):

```bash
# Create backend/.env
GEMINI_API_KEY="your-google-gemini-api-key"
ELEVENLABS_API_KEY="your-elevenlabs-api-key"
```

Start the backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
# Runs at http://localhost:8000
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
# Runs at http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) and speak your first translation.

---

## Who It's For

Transli fits anywhere the gap between "two people speak different languages" and "they actually understand each other" is costing someone time. That includes **students and researchers** working with multilingual content, **travellers** navigating conversations in unfamiliar languages, **small businesses** dealing with vendors and clients across language borders, **medical or legal professionals** needing quick translations during consultations, **educators** in multilingual classrooms, and **developers** looking for a flexible speech translation platform they can extend and self-host.

---

## Why This Project Matters

Most translation tools start at the text box and stop there — assuming the user will handle the voice part themselves. That assumption breaks down the moment you need real-time conversation.

In practice, multilingual communication starts with someone speaking. The value of a translation system depends on how well it handles that full loop: listening, understanding, translating, and speaking back — without making the user do the tedious parts manually.

Transli is built around closing that loop. It combines browser-based audio capture, multi-provider speech recognition, neural machine translation with context injection, and multi-engine voice synthesis into one cohesive flow. The provider dispatcher architecture means you can run everything in the cloud, everything locally, or any mix in between — switching at runtime without touching code.

That makes it meaningful both as a real tool people can use and as a full-stack project that demonstrates end-to-end system design — from microphone input to AI pipeline to audio playback to persistent history.

---

## License

MIT License. See the [`LICENSE`](LICENSE) file for details.

---

<div align="center">

**Stop typing what you want to say.**

[Get Started with Transli →](https://github.com/tony19053000/Transli.git)

</div>
