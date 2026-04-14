import React, { useState, useRef, useEffect, useCallback } from 'react';
import API_BASE from '../config/api';
import {
  FileText, Upload, Loader2, AlertCircle, Download, Play, Pause, RotateCcw,
  X, Copy, Check, ArrowRightLeft, Trash2, RefreshCw, Save, Image, Headphones,
  Volume2
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, INDIAN_LANGUAGES, INTERNATIONAL_LANGUAGES, getLanguageName } from '../config/languages';

const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.webm'];
const TEXT_EXTS  = ['.txt', '.pdf', '.docx'];
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg'];
const ALL_ACCEPTED = [...AUDIO_EXTS, ...TEXT_EXTS, ...IMAGE_EXTS];

const SPEED_MIN  = 0.5;
const SPEED_MAX  = 2.0;
const SPEED_STEP = 0.25;

const DRAFT_KEY = 'ai_translator_ft_draft_v1';
const VALID_LANG_CODES = new Set(SUPPORTED_LANGUAGES.map(l => l.code));

const langName = (code) => getLanguageName(code);

/**
 * Normalize STT transcript or translation text for clean readable display.
 * Strips structural formatting artifacts that are not part of the actual spoken content:
 *   - SRT/VTT timestamp lines  ("00:00:01,000 --> 00:00:03,000")
 *   - Bare sequence-number lines  ("1", "2", …)
 *   - Numbered-list prefixes on lines  ("1. ", "2) ", "[1] ", …)
 *   - JSON-wrapped Gemini auto-detect responses  ({"detected_language":…,"translation":…})
 * Preserves spoken numbers (dates, prices, quantities) because they appear
 * inside text, not as standalone line prefixes.
 */
const normalizeAudioText = (text) => {
  if (!text || typeof text !== 'string') return text || '';

  const trimmed = text.trim();

  // Unwrap Gemini auto-detect JSON (may reach here when NLLB falls back to Gemini
  // but the frontend provider variable is still 'nllb', so the JSON isn't parsed above)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const inner = parsed.translation || parsed.text;
      if (typeof inner === 'string') return normalizeAudioText(inner);
    } catch {}
  }

  const lines = trimmed.split('\n');

  // SRT/VTT timestamp patterns
  const SRT_TS  = /^\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}$/;
  const VTT_TS  = /^\d{1,2}:\d{2}[,.]\d{3}\s*-->\s*\d{1,2}:\d{2}[,.]\d{3}$/;
  // Numbered-list prefix: "1. " | "1) " | "1: " | "[1] "
  const NUM_PFX = /^(\[\d+]|\d+[.):]) /;

  const hasTimestamps  = lines.some(l => SRT_TS.test(l.trim()) || VTT_TS.test(l.trim()));
  const numberedCount  = lines.filter(l => NUM_PFX.test(l.trim())).length;
  const hasNumberedFmt = numberedCount >= 2;

  if (!hasTimestamps && !hasNumberedFmt) return text; // nothing structural — return unchanged

  return lines
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .filter(l => !SRT_TS.test(l) && !VTT_TS.test(l))   // drop timestamp lines
    .filter(l => !/^\d+$/.test(l))                       // drop bare sequence-number lines
    .map(l => (hasNumberedFmt ? l.replace(NUM_PFX, '') : l)) // strip numbered prefixes
    .filter(l => l.length > 0)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const d = JSON.parse(raw);
    if (d.sourceLang && !VALID_LANG_CODES.has(d.sourceLang)) delete d.sourceLang;
    if (d.targetLang && !VALID_LANG_CODES.has(d.targetLang)) delete d.targetLang;
    return d;
  } catch { return {}; }
};

export default function FileTranslation({
  sttProvider, translationProvider, ttsProvider, onSaveHistory
}) {
  const [draft] = useState(() => loadDraft());

  // ── Page-local controls ──
  const [activeTab, setActiveTab]       = useState(draft.activeTab || 'document');
  const [sourceLang, setSourceLang]     = useState(draft.sourceLang || 'en');
  const [targetLang, setTargetLang]     = useState(draft.targetLang || 'hi');
  const [autoDetect, setAutoDetect]     = useState(draft.autoDetect ?? true);
  const [playbackSpeed, setPlaybackSpeed] = useState(draft.playbackSpeed || 1.0);
  const [autoSaveHistory, setAutoSaveHistory] = useState(draft.autoSaveHistory ?? true);

  // ── File / workspace state ──
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus]             = useState('idle');
  const [errorMsg, setErrorMsg]         = useState('');
  const [result, setResult]             = useState(draft.result || null);
  const [dragOver, setDragOver]         = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary]           = useState(draft.summary || '');
  const [savedToHistory, setSavedToHistory] = useState(draft.savedToHistory || false);

  // ── Audio refs ──
  const fileInputRef   = useRef(null);
  const outputAudioRef = useRef(null);
  const inputAudioRef  = useRef(null);
  const [isOutputPlaying, setIsOutputPlaying] = useState(false);
  const [isInputPlaying, setIsInputPlaying]   = useState(false);
  const [inputAudioUrl, setInputAudioUrl]     = useState(null);

  // ── On-demand TTS audio refs ──
  const originalTtsRef = useRef(null);
  const translatedTtsRef = useRef(null);
  const [originalTtsUrl, setOriginalTtsUrl]     = useState(null);
  const [translatedTtsUrl, setTranslatedTtsUrl] = useState(null);
  const [isOriginalTtsPlaying, setIsOriginalTtsPlaying]     = useState(false);
  const [isTranslatedTtsPlaying, setIsTranslatedTtsPlaying] = useState(false);
  const [isOriginalTtsLoading, setIsOriginalTtsLoading]     = useState(false);
  const [isTranslatedTtsLoading, setIsTranslatedTtsLoading] = useState(false);

  // ── Copy helper ──
  const [copiedId, setCopiedId] = useState(null);

  // ── Image preview URL ──
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (outputAudioRef.current) try { outputAudioRef.current.pause(); } catch {}
      if (inputAudioRef.current) try { inputAudioRef.current.pause(); } catch {}
      if (originalTtsRef.current) try { originalTtsRef.current.pause(); } catch {}
      if (translatedTtsRef.current) try { translatedTtsRef.current.pause(); } catch {}
      if (inputAudioUrl) URL.revokeObjectURL(inputAudioUrl);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, []);

  // ── Draft persistence ──
  useEffect(() => {
    const d = {
      activeTab, sourceLang, targetLang, autoDetect,
      playbackSpeed, autoSaveHistory, savedToHistory,
      summary,
      result: result ? {
        original: result.original,
        translated: result.translated,
        filename: result.filename,
        type: result.type,
        detectedLang: result.detectedLang,
        // audio URL is a data: URI (base64) — safe to persist
        audio: result.audio || null,
      } : null,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  }, [activeTab, sourceLang, targetLang, autoDetect, playbackSpeed, autoSaveHistory, savedToHistory, summary, result]);

  // ── Update playback rate when speed changes ──
  useEffect(() => {
    if (outputAudioRef.current) outputAudioRef.current.playbackRate = playbackSpeed;
    if (inputAudioRef.current) inputAudioRef.current.playbackRate = playbackSpeed;
    if (originalTtsRef.current) originalTtsRef.current.playbackRate = playbackSpeed;
    if (translatedTtsRef.current) translatedTtsRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // ── File helpers ──
  const getFileExt = (filename) => {
    const dot = filename.lastIndexOf('.');
    return dot !== -1 ? filename.substring(dot).toLowerCase() : '';
  };
  const isAudioFile = (fn) => AUDIO_EXTS.includes(getFileExt(fn));
  const isTextFile  = (fn) => TEXT_EXTS.includes(getFileExt(fn));
  const isImageFile = (fn) => IMAGE_EXTS.includes(getFileExt(fn));

  const getAcceptedForTab = () => {
    if (activeTab === 'document') return TEXT_EXTS.join(',');
    if (activeTab === 'audio')    return AUDIO_EXTS.join(',');
    if (activeTab === 'visual')   return IMAGE_EXTS.join(',');
    return ALL_ACCEPTED.join(',');
  };

  // ── Tab change ──
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    clearWorkspace();
  };

  // ── File selection ──
  const handleFileSelect = (file) => {
    if (!file) return;
    const ext = getFileExt(file.name);
    if (!ALL_ACCEPTED.includes(ext)) {
      setErrorMsg(`Unsupported file type: ${ext}. Supported: ${ALL_ACCEPTED.join(', ')}`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File exceeds 10 MB size limit.');
      return;
    }

    // Auto-switch tab
    if (isAudioFile(file.name))      setActiveTab('audio');
    else if (isTextFile(file.name))  setActiveTab('document');
    else if (isImageFile(file.name)) setActiveTab('visual');

    // Create image preview
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    if (isImageFile(file.name)) {
      setImagePreviewUrl(URL.createObjectURL(file));
    } else {
      setImagePreviewUrl(null);
    }

    // Create input audio preview URL
    if (inputAudioUrl) URL.revokeObjectURL(inputAudioUrl);
    if (isAudioFile(file.name)) {
      setInputAudioUrl(URL.createObjectURL(file));
    } else {
      setInputAudioUrl(null);
    }

    setSelectedFile(file);
    setErrorMsg('');
    setResult(null);
    setSummary('');
    setStatus('idle');
    setSavedToHistory(false);
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); };
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  // ── Stop all audio helper ──
  const stopAllAudio = () => {
    if (outputAudioRef.current) try { outputAudioRef.current.pause(); } catch {}
    if (inputAudioRef.current) try { inputAudioRef.current.pause(); } catch {}
    if (originalTtsRef.current) try { originalTtsRef.current.pause(); } catch {}
    if (translatedTtsRef.current) try { translatedTtsRef.current.pause(); } catch {}
    setIsOutputPlaying(false);
    setIsInputPlaying(false);
    setIsOriginalTtsPlaying(false);
    setIsTranslatedTtsPlaying(false);
  };

  // ── Clear workspace (data only) ──
  const clearWorkspace = () => {
    stopAllAudio();
    if (inputAudioUrl) URL.revokeObjectURL(inputAudioUrl);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setInputAudioUrl(null);
    setImagePreviewUrl(null);
    setOriginalTtsUrl(null);
    setTranslatedTtsUrl(null);
    originalTtsRef.current = null;
    translatedTtsRef.current = null;
    setSelectedFile(null);
    setResult(null);
    setSummary('');
    setStatus('idle');
    setErrorMsg('');
    setSavedToHistory(false);
    localStorage.removeItem(DRAFT_KEY);
  };

  // ── Reset controls (settings only) ──
  const resetControls = () => {
    setSourceLang('en');
    setTargetLang('hi');
    setAutoDetect(true);
    setPlaybackSpeed(1.0);
    setAutoSaveHistory(true);
  };

  // ── Swap languages ──
  const swapLanguages = () => {
    if (autoDetect) return;
    const tmp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(tmp);
  };

  // ── Process file ──
  const processFile = async () => {
    if (!selectedFile) return;
    setStatus('processing');
    setErrorMsg('');
    setResult(null);
    setSummary('');
    setSavedToHistory(false);

    const formData = new FormData();
    const filename = selectedFile.name;

    try {
      if (isAudioFile(filename)) {
        formData.append('audio', selectedFile, filename);
        formData.append('source_lang', autoDetect ? 'auto' : sourceLang);
        formData.append('target_lang', targetLang);
        formData.append('stt_provider', sttProvider);
        formData.append('translation_provider', translationProvider);

        const res = await fetch(`${API_BASE}/api/translate`, { method: 'POST', body: formData });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Audio processing failed'); }
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        let actualTranslation = data.translated_text;
        let actualSourceTag = autoDetect ? 'auto' : sourceLang;
        if (autoDetect) {
          try {
            const parsed = JSON.parse(actualTranslation);
            if (parsed.detected_language) { actualSourceTag = parsed.detected_language; actualTranslation = parsed.translation || actualTranslation; }
          } catch {}
        }

        let audioUrl = data.audio_base64 ? `data:audio/mpeg;base64,${data.audio_base64}` : null;

        const newResult = {
          original: normalizeAudioText(data.transcript),
          translated: normalizeAudioText(actualTranslation),
          audio: audioUrl, filename, type: 'audio',
          detectedLang: (autoDetect && actualSourceTag !== 'auto') ? actualSourceTag : null,
        };
        setResult(newResult);

        if (autoSaveHistory && onSaveHistory) {
          onSaveHistory({
            type: 'file_translation', sourceLang: actualSourceTag, targetLang,
            sttModel: sttProvider, translationModel: translationProvider,
            originalText: data.transcript, translatedText: actualTranslation,
            fileName: filename, fileType: 'audio',
          });
          setSavedToHistory(true);
        }

        // Auto-play translated audio
        if (audioUrl) setTimeout(() => playOutputAudio(audioUrl), 300);

      } else if (isTextFile(filename) || isImageFile(filename)) {
        formData.append('file', selectedFile, filename);
        formData.append('source_lang', autoDetect ? 'auto' : sourceLang);
        formData.append('target_lang', targetLang);
        formData.append('translation_provider', translationProvider);

        const res = await fetch(`${API_BASE}/api/translate-text`, { method: 'POST', body: formData });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Text processing failed'); }
        const data = await res.json();

        let actualTranslation = data.translated_text;
        let actualSourceTag = autoDetect ? 'auto' : sourceLang;
        if (autoDetect) {
          try {
            const parsed = JSON.parse(actualTranslation);
            if (parsed.detected_language) { actualSourceTag = parsed.detected_language; actualTranslation = parsed.translation || actualTranslation; }
          } catch {}
        }

        const newResult = {
          original: data.original_text, translated: actualTranslation,
          audio: null, filename, type: isImageFile(filename) ? 'image' : 'text',
          detectedLang: (autoDetect && actualSourceTag !== 'auto') ? actualSourceTag : null,
        };
        setResult(newResult);

        if (autoSaveHistory && onSaveHistory) {
          onSaveHistory({
            type: 'file_translation', sourceLang: actualSourceTag, targetLang,
            sttModel: sttProvider, translationModel: translationProvider,
            originalText: data.original_text, translatedText: actualTranslation,
            fileName: filename, fileType: isImageFile(filename) ? 'image' : 'text',
          });
          setSavedToHistory(true);
        }
      }

      setStatus('done');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Processing failed.');
      setStatus('error');
    }
  };

  // ── Summarize ──
  const summarizeFile = async () => {
    if (!result) return;
    setIsSummarizing(true);
    setErrorMsg('');
    const formData = new FormData();
    formData.append('text', result.original);
    formData.append('translation_provider', translationProvider);
    try {
      const res = await fetch(`${API_BASE}/api/summarize`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to summarize');
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to generate summary');
    } finally {
      setIsSummarizing(false);
    }
  };

  // ── Re-translate from current extracted text ──
  const retranslate = async () => {
    if (!result?.original) return;
    setStatus('processing');
    setErrorMsg('');
    setSummary('');
    setSavedToHistory(false);

    const formData = new FormData();
    formData.append('text', result.original);
    formData.append('source_lang', autoDetect ? 'auto' : sourceLang);
    formData.append('target_lang', targetLang);
    formData.append('translation_provider', translationProvider);

    try {
      const res = await fetch(`${API_BASE}/api/translate-text`, { method: 'POST', body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Re-translation failed'); }
      const data = await res.json();

      let actualTranslation = data.translated_text;
      let actualSourceTag = autoDetect ? 'auto' : sourceLang;
      if (autoDetect) {
        try {
          const parsed = JSON.parse(actualTranslation);
          if (parsed.detected_language) { actualSourceTag = parsed.detected_language; actualTranslation = parsed.translation || actualTranslation; }
        } catch {}
      }

      setResult(prev => ({
        ...prev,
        translated: actualTranslation,
        detectedLang: autoDetect ? (actualSourceTag !== 'auto' ? actualSourceTag : prev?.detectedLang) : null,
      }));
      setStatus('done');

      if (autoSaveHistory && onSaveHistory) {
        onSaveHistory({
          type: 'file_translation', sourceLang: actualSourceTag, targetLang,
          sttModel: sttProvider, translationModel: translationProvider,
          originalText: result.original, translatedText: actualTranslation,
          fileName: result.filename, fileType: result.type,
        });
        setSavedToHistory(true);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Re-translation failed.');
      setStatus('error');
    }
  };

  // ── Audio playback (output) ──
  const playOutputAudio = (url) => {
    const audioUrl = url || result?.audio;
    if (!audioUrl) return;

    stopAllAudio();

    if (!outputAudioRef.current || outputAudioRef.current._srcUrl !== audioUrl) {
      outputAudioRef.current = new Audio(audioUrl);
      outputAudioRef.current._srcUrl = audioUrl;
    }
    outputAudioRef.current.playbackRate = playbackSpeed;
    outputAudioRef.current.currentTime = 0;
    const finish = () => setIsOutputPlaying(false);
    outputAudioRef.current.onended = finish;
    outputAudioRef.current.onerror = finish;
    outputAudioRef.current.play().catch(finish);
    setIsOutputPlaying(true);
  };

  const pauseOutputAudio = () => {
    if (outputAudioRef.current) { outputAudioRef.current.pause(); setIsOutputPlaying(false); }
  };

  const restartOutputAudio = () => playOutputAudio(result?.audio);

  // ── Audio playback (input — only when real file exists) ──
  const playInputAudio = () => {
    if (!inputAudioUrl) return;
    stopAllAudio();

    if (!inputAudioRef.current || inputAudioRef.current._srcUrl !== inputAudioUrl) {
      inputAudioRef.current = new Audio(inputAudioUrl);
      inputAudioRef.current._srcUrl = inputAudioUrl;
    }
    inputAudioRef.current.playbackRate = playbackSpeed;
    inputAudioRef.current.currentTime = 0;
    const finish = () => setIsInputPlaying(false);
    inputAudioRef.current.onended = finish;
    inputAudioRef.current.onerror = finish;
    inputAudioRef.current.play().catch(finish);
    setIsInputPlaying(true);
  };

  const pauseInputAudio = () => {
    if (inputAudioRef.current) { inputAudioRef.current.pause(); setIsInputPlaying(false); }
  };

  // ── On-demand TTS synthesis ──
  const synthesizeTts = async (text, lang, which) => {
    if (!text || !text.trim()) return;
    const setLoading = which === 'original' ? setIsOriginalTtsLoading : setIsTranslatedTtsLoading;
    const setUrl = which === 'original' ? setOriginalTtsUrl : setTranslatedTtsUrl;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('text', text.trim().substring(0, 5000)); // limit to prevent huge TTS calls
      formData.append('lang', lang);
      const res = await fetch(`${API_BASE}/api/tts`, { method: 'POST', body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'TTS failed'); }
      const data = await res.json();
      if (data.audio_base64) {
        const audioUrl = `data:audio/mpeg;base64,${data.audio_base64}`;
        setUrl(audioUrl);
        // Auto-play after synthesis
        playTtsAudio(which, audioUrl);
      }
    } catch (err) {
      console.error(`TTS synthesis failed (${which}):`, err);
      setErrorMsg(`Could not generate audio: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── TTS audio playback ──
  const playTtsAudio = (which, urlOverride) => {
    stopAllAudio();
    const ref = which === 'original' ? originalTtsRef : translatedTtsRef;
    const url = urlOverride || (which === 'original' ? originalTtsUrl : translatedTtsUrl);
    const setPlaying = which === 'original' ? setIsOriginalTtsPlaying : setIsTranslatedTtsPlaying;
    if (!url) return;

    if (!ref.current || ref.current._srcUrl !== url) {
      ref.current = new Audio(url);
      ref.current._srcUrl = url;
    }
    ref.current.playbackRate = playbackSpeed;
    ref.current.currentTime = 0;
    const finish = () => setPlaying(false);
    ref.current.onended = finish;
    ref.current.onerror = finish;
    ref.current.play().catch(finish);
    setPlaying(true);
  };

  const pauseTtsAudio = (which) => {
    const ref = which === 'original' ? originalTtsRef : translatedTtsRef;
    const setPlaying = which === 'original' ? setIsOriginalTtsPlaying : setIsTranslatedTtsPlaying;
    if (ref.current) { ref.current.pause(); setPlaying(false); }
  };

  const restartTtsAudio = (which) => {
    playTtsAudio(which);
  };

  // ── Determine effective source lang for TTS ──
  const getOriginalLang = () => {
    if (result?.detectedLang) return result.detectedLang;
    if (!autoDetect) return sourceLang;
    return 'en'; // safe fallback
  };

  // ── Copy helper ──
  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  };

  // ── Download helpers ──
  const downloadTxt = (text, filename) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMp3 = (audioUrl, filename) => {
    if (!audioUrl) return;
    const a = document.createElement('a'); a.href = audioUrl; a.download = filename; a.click();
  };

  const downloadBilingual = () => {
    if (!result) return;
    let text = `=== TRANSLI FILE TRANSLATION RESULT ===\n`;
    text += `File: ${result.filename}\n`;
    const labelSrc = result.detectedLang ? `Auto-Detect (${result.detectedLang})` : (autoDetect ? 'Auto-Detect' : langName(sourceLang));
    text += `Direction: ${labelSrc} → ${langName(targetLang)}\n`;
    text += `============================\n\n`;
    text += `--- ORIGINAL ---\n${result.original}\n\n`;
    text += `--- TRANSLATED (${langName(targetLang)}) ---\n${result.translated}\n\n`;
    if (summary) text += `--- SUMMARY ---\n${summary}\n`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `translated_${result.filename.replace(/\.[^.]+$/, '')}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Save to History (manual) ──
  const saveToHistory = () => {
    if (!result || savedToHistory) return;
    if (onSaveHistory) {
      onSaveHistory({
        type: 'file_translation',
        sourceLang: autoDetect ? (result.detectedLang || 'auto') : sourceLang,
        targetLang, sttModel: sttProvider, translationModel: translationProvider,
        originalText: result.original, translatedText: result.translated,
        fileName: result.filename, fileType: result.type,
      });
      setSavedToHistory(true);
    }
  };

  // ── Status helpers ──
  const isBusy = status === 'processing';
  const statusText = {
    idle: activeTab === 'document' ? 'Upload a document to begin'
        : activeTab === 'audio' ? 'Upload an audio file to transcribe and translate'
        : 'Upload an image to extract and translate text',
    processing: activeTab === 'audio' ? 'Transcribing & translating…' : activeTab === 'visual' ? 'Extracting text via OCR…' : 'Extracting & translating…',
    done: 'Completed',
    error: 'Error',
  }[status] || 'Ready';

  const statusClass = status === 'processing' ? 'processing' : status === 'done' ? 'completed' : status === 'error' ? 'error' : 'idle';

  const tabIcon = { document: <FileText size={16} />, audio: <Headphones size={16} />, visual: <Image size={16} /> };

  return (
    <>
      {/* TopAppBar Shell */}
      <header className="flex justify-between items-center w-full h-16 px-8 sticky top-0 z-40 ml-64 bg-[#111318]/80 backdrop-blur-xl shadow-[0_0_32px_rgba(173,198,255,0.08)]">
        <div className="flex items-center gap-4">
          <span className="text-lg font-black text-[#E2E2E8] font-manrope">File & Visual Translation</span>
          <div className="h-4 w-[1px] bg-outline-variant/30"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full">
            <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_#ADC6FF] ${statusClass === 'error' ? 'bg-error' : statusClass === 'completed' ? 'bg-secondary' : 'bg-primary'}`}></span>
            <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest">{statusText}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-[#C2C6D6] hover:text-[#ADC6FF] transition-all duration-300">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/30 group-hover:border-primary/50 transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">account_circle</span>
            </div>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="ml-64 flex h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
        <div className="flex-1 flex flex-col p-8 gap-6">
          
          <div className="flex items-center justify-between mb-2">
             <div className="flex bg-surface-container-highest rounded-lg p-1">
                {['document', 'audio', 'visual'].map(tab => (
                   <button
                     key={tab}
                     className={`flex items-center gap-2 px-6 py-2 rounded-md text-xs font-bold transition-all ${activeTab === tab ? 'bg-[#282A2E] text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                     onClick={() => handleTabChange(tab)}
                     disabled={isBusy}
                   >
                     <span className="material-symbols-outlined text-sm">
                       {tab === 'document' ? 'article' : tab === 'audio' ? 'headphones' : 'image'}
                     </span>
                     {tab === 'document' ? 'Document' : tab === 'audio' ? 'Audio' : 'Visual (Image)'}
                   </button>
                ))}
             </div>
          </div>

          {errorMsg && (
            <div className="bg-error-container/20 border border-error/50 p-4 rounded-xl flex items-center gap-3">
               <AlertCircle size={18} className="text-error" />
               <p className="text-error font-medium flex-1 m-0">{errorMsg}</p>
            </div>
          )}

          {/* Upload Zone */}
          <section
            className={`bg-surface-container-low rounded-2xl border ${dragOver ? 'border-primary border-dashed bg-primary/5' : 'border-outline-variant/10'} shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden relative transition-all min-h-[220px] items-center justify-center p-8`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !selectedFile && !isBusy && fileInputRef.current?.click()}
            style={{ cursor: !selectedFile && !isBusy ? 'pointer' : 'default' }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => { handleFileSelect(e.target.files[0]); e.target.value = ''; }}
              accept={getAcceptedForTab()}
              style={{ display: 'none' }}
            />
            
            {!selectedFile ? (
              <div className="flex flex-col items-center gap-4 text-center opacity-80 hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 rounded-full bg-surface-container-high border-2 border-outline-variant/20 flex items-center justify-center">
                   <span className="material-symbols-outlined text-3xl text-primary drop-shadow-[0_0_12px_#ADC6FF]">upload_file</span>
                </div>
                <div>
                   <p className="text-on-surface font-bold mb-1 group-hover:text-primary transition-colors">
                     Drop a {activeTab === 'document' ? 'document' : activeTab === 'audio' ? 'audio file' : 'image'} here or click to browse
                   </p>
                   <p className="text-xs text-on-surface-variant font-medium">
                     Supported: {getAcceptedForTab().replace(/,/g, ', ')} • Max 10 MB
                   </p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                <div className="flex items-center justify-between w-full max-w-lg bg-surface-container-highest rounded-xl p-4 border border-outline-variant/20 shadow-sm relative">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                     <span className="material-symbols-outlined text-2xl">
                       {activeTab === 'audio' ? 'audio_file' : activeTab === 'visual' ? 'image' : 'description'}
                     </span>
                  </div>
                  <div className="flex-1 min-w-0 ml-4">
                    <p className="text-sm font-bold text-on-surface truncate">{selectedFile.name}</p>
                    <p className="text-xs text-on-surface-variant font-medium mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB •{' '}
                      {result?.detectedLang ? `Detected: ${result.detectedLang}` : (autoDetect ? 'Auto-Detect' : langName(sourceLang))} → {langName(targetLang)}
                    </p>
                  </div>
                  <button className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error transition-all ml-4" onClick={(e) => { e.stopPropagation(); clearWorkspace(); }}>
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                
                {status !== 'done' && (
                  <button
                    className={`px-8 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-primary to-primary-container text-on-primary-container shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 ${isBusy ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:-translate-y-0.5'}`}
                    onClick={(e) => { e.stopPropagation(); processFile(); }}
                    disabled={isBusy}
                  >
                    {isBusy ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : <span className="material-symbols-outlined text-sm">translate</span>}
                    {isBusy ? 'Processing…' : 'Translate File'}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ── Image Preview ── */}
          {result?.type === 'image' && imagePreviewUrl && (
            <div className="bg-surface-container-lowest/50 rounded-2xl border border-outline-variant/10 overflow-hidden flex justify-center p-4 min-h-[100px]">
              <img src={imagePreviewUrl} alt="Uploaded" className="max-w-full max-h-[300px] object-contain rounded-lg shadow-sm" />
            </div>
          )}

          {/* ── Summary Card ── */}
          {summary && (
            <div className="bg-surface-container-low rounded-2xl border border-primary/20 p-6 flex flex-col gap-3 shadow-sm relative">
               <div className="flex items-center gap-2">
                 <span className="material-symbols-outlined text-primary text-sm">summarize</span>
                 <h4 className="text-xs font-bold text-primary uppercase tracking-widest m-0">Document Summary</h4>
               </div>
               <p className="text-[#E2E2E8] text-sm leading-relaxed m-0">{summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0 mb-8">
            {/* ── Original Content Card ── */}
            <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 shadow-lg flex flex-col overflow-hidden h-[450px] shrink-0">
              <div className="flex items-center justify-between border-b border-outline-variant/10 px-6 py-3 bg-gradient-to-r from-surface-container-lowest/50 to-transparent">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="text-[11px] font-black text-on-surface-variant tracking-widest uppercase">{result?.type === 'audio' ? 'Transcript' : 'Original Text'}</span>
                  {result?.detectedLang && <span className="text-[10px] font-extrabold text-tertiary bg-tertiary/20 px-2.5 py-1 rounded-lg border border-tertiary/30 shadow-[0_0_8px_rgba(79,220,162,0.15)] uppercase tracking-wider">Detected: {result.detectedLang}</span>}
                  {!result?.detectedLang && autoDetect && result && <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-sm uppercase tracking-widest">Auto-detect</span>}
                  {!autoDetect && result && <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-sm uppercase tracking-widest">{langName(sourceLang)}</span>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="text-on-surface text-[15px] leading-relaxed font-medium whitespace-pre-wrap">
                  {result?.original || (
                    <span className="opacity-40">{activeTab === 'audio' ? 'Audio transcript will appear here' : activeTab === 'visual' ? 'OCR-extracted text will appear here' : 'Extracted text will appear here'}</span>
                  )}
                </div>
              </div>
              {result?.original && (
                <div className="bg-surface-container-lowest/80 border-t border-outline-variant/10 px-6 py-3 flex items-center gap-4 flex-wrap z-10">
                  {inputAudioUrl && activeTab === 'audio' && (
                    <div className="flex items-center gap-2">
                       <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isInputPlaying ? 'bg-primary/20 text-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`} onClick={isInputPlaying ? pauseInputAudio : playInputAudio}>
                         <span className="material-symbols-outlined text-[16px]">{isInputPlaying ? 'pause' : 'play_arrow'}</span>
                       </button>
                       <button className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-all" onClick={playInputAudio}>
                         <span className="material-symbols-outlined text-[16px]">replay</span>
                       </button>
                       <div className="w-px h-4 bg-outline-variant/20 mx-1 border-none pb-0 mt-0"></div>
                    </div>
                  )}
                  {!originalTtsUrl ? (
                    <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary/80 transition-colors flex items-center gap-1.5" onClick={() => synthesizeTts(result.original, getOriginalLang(), 'original')} disabled={isOriginalTtsLoading}>
                      <span className="material-symbols-outlined text-[14px]">{isOriginalTtsLoading ? 'sync' : 'volume_up'}</span> {isOriginalTtsLoading ? 'Generating…' : 'Speak'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOriginalTtsPlaying ? 'bg-primary/20 text-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`} onClick={() => isOriginalTtsPlaying ? pauseTtsAudio('original') : playTtsAudio('original')}>
                        <span className="material-symbols-outlined text-[16px]">{isOriginalTtsPlaying ? 'pause' : 'play_arrow'}</span>
                      </button>
                      <button className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-all" onClick={() => restartTtsAudio('original')}>
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                      </button>
                    </div>
                  )}
                  <div className="w-px h-4 bg-outline-variant/20 mx-1"></div>
                  <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5" onClick={() => handleCopy(result.original, 'original')}>
                    <span className="material-symbols-outlined text-[14px]">{copiedId === 'original' ? 'check' : 'content_copy'}</span> {copiedId === 'original' ? 'Copied' : 'Copy'}
                  </button>
                  <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5" onClick={() => downloadTxt(result.original, `original_${result.filename.replace(/\.[^.]+$/, '')}.txt`)}>
                    <span className="material-symbols-outlined text-[14px]">download</span> TXT
                  </button>
                  <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ml-auto" onClick={retranslate} disabled={isBusy}>
                    <span className="material-symbols-outlined text-[14px]">refresh</span> Re-translate
                  </button>
                </div>
              )}
            </div>

            {/* ── Translated Content Card ── */}
            <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 shadow-lg flex flex-col overflow-hidden h-[450px] shrink-0">
              <div className="flex items-center justify-between border-b border-outline-variant/10 px-6 py-3 bg-gradient-to-r from-surface-container-lowest/50 to-transparent">
                <span className="text-[11px] font-black text-secondary tracking-widest uppercase">Translated ({langName(targetLang)})</span>
                {result && (
                  <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-secondary transition-colors flex items-center gap-1.5" onClick={summarizeFile} disabled={isSummarizing}>
                    <span className={`material-symbols-outlined text-[14px] ${isSummarizing ? 'animate-spin' : ''}`}>{isSummarizing ? 'sync' : 'summarize'}</span> {isSummarizing ? 'Summarizing…' : 'Summarize'}
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="text-on-surface text-lg leading-relaxed font-medium whitespace-pre-wrap">
                  {result?.translated || <span className="opacity-40 font-normal text-[15px]">Your translation will appear here</span>}
                </div>
              </div>
              {result?.translated && (
                <div className="bg-surface-container-lowest/80 border-t border-outline-variant/10 px-6 py-3 flex items-center gap-4 flex-wrap z-10">
                  {result.audio ? (
                    <div className="flex items-center gap-2">
                       <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOutputPlaying ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`} onClick={isOutputPlaying ? pauseOutputAudio : () => playOutputAudio()}>
                         <span className="material-symbols-outlined text-[16px]">{isOutputPlaying ? 'pause' : 'play_arrow'}</span>
                       </button>
                       <button className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-all" onClick={restartOutputAudio}>
                         <span className="material-symbols-outlined text-[16px]">replay</span>
                       </button>
                    </div>
                  ) : (
                    !translatedTtsUrl ? (
                      <button className="text-[10px] font-bold text-secondary uppercase tracking-widest hover:text-secondary/80 transition-colors flex items-center gap-1.5" onClick={() => synthesizeTts(result.translated, targetLang, 'translated')} disabled={isTranslatedTtsLoading}>
                        <span className="material-symbols-outlined text-[14px]">{isTranslatedTtsLoading ? 'sync' : 'volume_up'}</span> {isTranslatedTtsLoading ? 'Generating…' : 'Speak'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isTranslatedTtsPlaying ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`} onClick={() => isTranslatedTtsPlaying ? pauseTtsAudio('translated') : playTtsAudio('translated')}>
                          <span className="material-symbols-outlined text-[16px]">{isTranslatedTtsPlaying ? 'pause' : 'play_arrow'}</span>
                        </button>
                        <button className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-all" onClick={() => restartTtsAudio('translated')}>
                          <span className="material-symbols-outlined text-[16px]">replay</span>
                        </button>
                      </div>
                    )
                  )}
                  {(result.audio || translatedTtsUrl) && (
                    <div className="w-px h-4 bg-outline-variant/20 mx-1"></div>
                  )}
                  <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-secondary transition-colors flex items-center gap-1.5" onClick={() => handleCopy(result.translated, 'translated')}>
                    <span className="material-symbols-outlined text-[14px]">{copiedId === 'translated' ? 'check' : 'content_copy'}</span> {copiedId === 'translated' ? 'Copied' : 'Copy'}
                  </button>
                  <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-secondary transition-colors flex items-center gap-1.5" onClick={() => downloadTxt(result.translated, `translated_${result.filename.replace(/\.[^.]+$/, '')}.txt`)}>
                    <span className="material-symbols-outlined text-[14px]">download</span> TXT
                  </button>
                  {(result.audio || translatedTtsUrl) && (
                    <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-secondary transition-colors flex items-center gap-1.5" onClick={() => downloadMp3(result.audio || translatedTtsUrl, `translated_${result.filename.replace(/\.[^.]+$/, '')}.mp3`)}>
                      <span className="material-symbols-outlined text-[14px]">download</span> MP3
                    </button>
                  )}
                  <button className="text-[10px] font-bold text-secondary uppercase tracking-widest hover:bg-secondary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ml-auto" onClick={downloadBilingual}>
                    <span className="material-symbols-outlined text-[14px]">save_alt</span> Bilingual
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Control Panel */}
        <aside className="w-80 border-l border-outline-variant/15 bg-surface-container-lowest p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar shadow-[-10px_0_30px_rgba(0,0,0,0.2)] z-10">
          
          <div className="space-y-6">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">translate</span>
              Languages
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2 relative">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-on-surface-variant/70 font-semibold ml-1">Source Language</label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="sr-only peer" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
                    <div className="relative w-7 h-4 bg-surface-container border border-outline-variant/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-on-surface-variant peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary/80 peer-checked:border-primary"></div>
                    <span className="text-[10px] font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">Auto-detect</span>
                  </label>
                </div>
                {autoDetect ? (
                  <div className="w-full bg-primary/5 border border-primary/20 rounded-xl text-sm py-3 px-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm animate-pulse">auto_awesome</span>
                    <span className="font-bold text-primary text-xs">Auto-detecting...</span>
                    {result?.detectedLang && <span className="ml-auto text-[10px] font-extrabold text-tertiary bg-tertiary/20 px-2.5 py-1 rounded-lg border border-tertiary/30 shadow-[0_0_8px_rgba(79,220,162,0.15)] uppercase tracking-wider">{result.detectedLang}</span>}
                  </div>
                ) : (
                  <div className="relative group">
                    <select 
                      className="w-full bg-surface-container-high border border-transparent rounded-xl text-sm py-3 px-4 appearance-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all cursor-pointer text-on-surface outline-none"
                      value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} disabled={isBusy}
                    >
                      <optgroup label="Indian Languages">
                        {INDIAN_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                      </optgroup>
                      <optgroup label="International Languages">
                        {INTERNATIONAL_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                      </optgroup>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none transition-transform group-focus-within:rotate-180">expand_more</span>
                  </div>
                )}
              </div>

              <div className="flex justify-center -my-2 relative z-10 w-full">
                <button 
                  className={`w-8 h-8 bg-surface-container-highest border border-outline-variant/20 rounded-full flex items-center justify-center ${autoDetect || isBusy ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110 hover:border-primary/40 hover:text-primary'} transition-all`}
                  onClick={swapLanguages} disabled={autoDetect || isBusy}
                  title={autoDetect ? 'Disable auto-detect to swap' : 'Swap languages'}
                >
                  <span className="material-symbols-outlined text-[16px]">swap_vert</span>
                </button>
              </div>

              <div className="space-y-2 relative">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-on-surface-variant/70 font-semibold ml-1">Target Language</label>
                </div>
                <div className="relative group">
                  <select 
                    className="w-full bg-surface-container-high border border-transparent rounded-xl text-sm py-3 px-4 appearance-none focus:ring-1 focus:ring-secondary/40 focus:border-secondary/30 transition-all cursor-pointer text-on-surface outline-none"
                    value={targetLang} onChange={(e) => setTargetLang(e.target.value)} disabled={isBusy}
                  >
                    <optgroup label="Indian Languages">
                      {INDIAN_LANGUAGES.filter(l => !autoDetect ? l.code !== sourceLang : true).map(l => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="International Languages">
                      {INTERNATIONAL_LANGUAGES.filter(l => !autoDetect ? l.code !== sourceLang : true).map(l => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none transition-transform group-focus-within:rotate-180">expand_more</span>
                </div>
              </div>
            </div>
          </div>

          {(activeTab === 'audio' || result?.audio) && (
            <div className="space-y-4 pt-6 border-t border-outline-variant/10">
              <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] flex items-center gap-2">
                <span className="material-symbols-outlined text-xs">tune</span>
                Audio Behavior
              </h3>
              <div className="space-y-6 px-1">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-on-surface-variant font-medium">Playback Speed</label>
                    <span className="text-xs font-bold text-primary">{playbackSpeed.toFixed(2)}x</span>
                  </div>
                  <input 
                    className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary" 
                    type="range"
                    min={SPEED_MIN}
                    max={SPEED_MAX}
                    step={SPEED_STEP}
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-6 border-t border-outline-variant/10 mt-auto">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">dns</span>
              Session Control
            </h3>
            
            <div className="flex items-center justify-between px-1 mb-4">
              <span className="text-xs text-on-surface-variant font-medium">Auto-save to History</span>
              <button 
                className={`w-10 h-5 rounded-full relative p-0.5 transition-colors ${autoSaveHistory ? 'bg-primary/20' : 'bg-surface-container-high'}`}
                onClick={() => setAutoSaveHistory(!autoSaveHistory)}
              >
                <div className={`w-4 h-4 rounded-full shadow-[0_0_8px_rgba(173,198,255,0.5)] transform transition-transform ${autoSaveHistory ? 'bg-primary translate-x-5' : 'bg-outline-variant'}`}></div>
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <button 
                className={`w-full py-3 px-4 ${savedToHistory ? 'bg-surface-container-highest text-on-surface-variant shadow-none border border-outline-variant/10' : 'bg-gradient-to-r from-primary to-primary-container text-on-primary-container shadow-[0_4px_12px_rgba(173,198,255,0.15)] hover:shadow-[0_4px_20px_rgba(173,198,255,0.25)] hover:scale-[1.02] active:scale-95'} font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100 disabled:shadow-none`}
                onClick={saveToHistory}
                disabled={!result || savedToHistory}
              >
                <span className="material-symbols-outlined text-[16px]">{savedToHistory ? 'check' : 'save'}</span>
                {savedToHistory ? 'Saved to History' : 'Save to History'}
              </button>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button 
                  className="py-2.5 px-3 bg-surface-container-lowest border border-outline-variant/10 text-on-surface-variant font-bold text-[11px] rounded-lg hover:text-on-surface hover:bg-error/10 hover:border-error/30 hover:text-error transition-all flex items-center justify-center gap-1.5"
                  onClick={clearWorkspace}
                >
                  <span className="material-symbols-outlined text-[14px]">delete_sweep</span> Clear
                </button>
                <button 
                  className="py-2.5 px-3 bg-surface-container-lowest border border-outline-variant/10 text-on-surface-variant font-bold text-[11px] rounded-lg hover:text-on-surface hover:border-primary/30 transition-all flex items-center justify-center gap-1.5"
                  onClick={resetControls}
                >
                  <span className="material-symbols-outlined text-[14px]">restart_alt</span> Reset
                </button>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </>
  );
}
