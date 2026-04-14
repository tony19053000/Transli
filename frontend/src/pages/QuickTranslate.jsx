import React, { useState, useRef, useEffect, useCallback } from 'react';
import API_BASE from '../config/api';
import { 
  Mic, Square, Loader2, Play, Pause, RotateCcw, AlertCircle, Copy, Download, 
  Check, Edit3, X, ArrowRightLeft, Type, Volume2, Save, Trash2, RefreshCw,
  ChevronDown
} from 'lucide-react';

import { SUPPORTED_LANGUAGES, INDIAN_LANGUAGES, INTERNATIONAL_LANGUAGES, getLanguageName } from '../config/languages';

const SPEED_MIN = 0.5;
const SPEED_MAX = 2.0;
const SPEED_STEP = 0.25;

const langName = (code) => getLanguageName(code);

const DRAFT_STORAGE_KEY = 'ai_translator_qt_draft_v1';

const VALID_LANG_CODES = new Set(SUPPORTED_LANGUAGES.map(l => l.code));

const loadDraft = () => {
  try {
    const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!draft) return {};
    const parsed = JSON.parse(draft);
    // Sanitize: drop any lang codes no longer in the supported list
    if (parsed.sourceLang && !VALID_LANG_CODES.has(parsed.sourceLang)) delete parsed.sourceLang;
    if (parsed.targetLang && !VALID_LANG_CODES.has(parsed.targetLang)) delete parsed.targetLang;
    if (parsed.selectedTargets) {
      parsed.selectedTargets = parsed.selectedTargets.filter(c => VALID_LANG_CODES.has(c));
      if (parsed.selectedTargets.length === 0) delete parsed.selectedTargets;
    }
    return parsed;
  } catch (e) {
    return {};
  }
};

export default function QuickTranslate({ 
  sttProvider, translationProvider, ttsProvider,
  onSaveHistory, preferLocalMode
}) {
  // Load draft exactly once on mount, inside component scope
  const [initialDraft] = useState(() => loadDraft());

  // ── Page-local state (initialized from draft OR global defaults) ──
  const [sourceLang, setSourceLang] = useState(initialDraft.sourceLang || 'en');
  const [targetLang, setTargetLang] = useState(initialDraft.targetLang || 'hi');
  const [multiTargetOn, setMultiTargetOn] = useState(initialDraft.multiTargetOn ?? false);
  const [selectedTargets, setSelectedTargets] = useState(initialDraft.selectedTargets || ['hi']);
  const [autoDetect, setAutoDetect] = useState(initialDraft.autoDetect ?? true);
  const [playbackSpeed, setPlaybackSpeed] = useState(initialDraft.playbackSpeed || 1.0);
  const [autoPlay, setAutoPlay] = useState(initialDraft.autoPlay ?? true);
  const [autoSaveHistory, setAutoSaveHistory] = useState(initialDraft.autoSaveHistory ?? true);

  // ── Input mode ──
  const [inputMode, setInputMode] = useState(initialDraft.inputMode || 'speak'); // 'speak' | 'type'
  const [typedText, setTypedText] = useState(initialDraft.typedText || '');

  // ── Recording state (Never persisted) ──
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const timerInterval = useRef(null);

  // ── Active Request Tracking ──
  const activeRequestId = useRef(0);
  const activeRequestController = useRef(null);

  // ── Translation state ──
  const [status, setStatus] = useState(initialDraft.status === 'Recording…' ? 'Ready' : (initialDraft.status || 'Ready'));
  const [transcript, setTranscript] = useState(initialDraft.transcript || '');
  const [editedTranscript, setEditedTranscript] = useState(initialDraft.editedTranscript || '');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [detectedLang, setDetectedLang] = useState(initialDraft.detectedLang || null);
  const [results, setResults] = useState(initialDraft.results || []);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [savedToHistory, setSavedToHistory] = useState(initialDraft.savedToHistory || false);
  const [timing, setTiming] = useState(null);

  // ── Audio refs (per-result) ──
  const audioRefs = useRef({});
  const [playingIdx, setPlayingIdx] = useState(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const isPlayingAllRef = useRef(false);

  // ── Input Audio Playback ──
  const [inputAudioUrl, setInputAudioUrl] = useState(null);
  const inputAudioRef = useRef(null);
  const [isInputPlaying, setIsInputPlaying] = useState(false);

  // ── Timer for recording ──
  useEffect(() => {
    if (isRecording) {
      timerInterval.current = setInterval(() => setTimer(p => p + 1), 1000);
    } else {
      clearInterval(timerInterval.current);
      setTimer(0);
    }
    return () => clearInterval(timerInterval.current);
  }, [isRecording]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(a => { try { a.pause(); } catch(e) {} });
      if (inputAudioRef.current) { try { inputAudioRef.current.pause(); } catch(e) {} }
    };
  }, []);

  useEffect(() => {
    return () => { if (inputAudioUrl) URL.revokeObjectURL(inputAudioUrl); };
  }, [inputAudioUrl]);

  // ── Draft Persistence ──
  useEffect(() => {
    const draft = {
      sourceLang, targetLang, multiTargetOn, selectedTargets,
      autoDetect, playbackSpeed, autoPlay, autoSaveHistory,
      inputMode, typedText, status, transcript, 
      editedTranscript, detectedLang, results, savedToHistory
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    sourceLang, targetLang, multiTargetOn, selectedTargets,
    autoDetect, playbackSpeed, autoPlay, autoSaveHistory,
    inputMode, typedText, status, transcript, 
    editedTranscript, detectedLang, results, savedToHistory
  ]);

  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  // ── Recording controls ──
  const startRecording = async () => {
    if (activeRequestController.current) {
      activeRequestController.current.abort();
      activeRequestController.current = null;
    }
    activeRequestId.current++;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (e) => { 
        if (e.data.size > 0) audioChunks.current.push(e.data); 
      };
      mediaRecorder.current.onstop = processAudio;
      audioChunks.current = [];
      mediaRecorder.current.start();
      setIsRecording(true);
      if (inputAudioUrl) {
        URL.revokeObjectURL(inputAudioUrl);
        setInputAudioUrl(null);
      }
      setStatus('Listening…');
      setErrorMsg('');
      setTranscript('');
      setEditedTranscript('');
      setDetectedLang(null);
      setResults([]);
      setTiming(null);
      setSavedToHistory(false);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone access denied. Please enable mic permissions in your browser settings.');
      } else {
        setErrorMsg('Could not access microphone. Ensure it is connected and recognized.');
      }
      setStatus('Error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      setStatus('Transcribing…');
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
    }
    audioChunks.current = [];
    setIsRecording(false);
    setStatus('Ready');
  };

  // ── Get effective target languages ──
  const getTargets = useCallback(() => {
    if (multiTargetOn && selectedTargets.length > 0) return selectedTargets;
    return [targetLang];
  }, [multiTargetOn, selectedTargets, targetLang]);

  // ── Process audio blob ──
  const processAudio = async () => {
    if (audioChunks.current.length === 0) {
      setErrorMsg('No speech detected. Please try again.');
      setStatus('Error');
      return;
    }
    const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
    const newUrl = URL.createObjectURL(audioBlob);
    setInputAudioUrl(newUrl);
    await runTranslation(audioBlob, null);
  };

  // ── Type mode translate ──
  const handleTypeTranslate = async () => {
    const text = typedText.trim();
    if (!text) {
      setErrorMsg('Please enter some text to translate.');
      setStatus('Error');
      return;
    }
    if (inputAudioUrl) {
      URL.revokeObjectURL(inputAudioUrl);
      setInputAudioUrl(null);
    }
    setErrorMsg('');
    setTranscript('');
    setEditedTranscript('');
    setDetectedLang(null);
    setResults([]);
    setTiming(null);
    setSavedToHistory(false);
    setStatus('Translating…');
    await runTranslation(null, text);
  };

  // ── Re-translate with edited transcript ──
  const handleRetranslate = async () => {
    const text = isEditingTranscript ? editedTranscript.trim() : transcript.trim();
    if (!text) return;
    setTranscript(text);
    setEditedTranscript(text);
    setIsEditingTranscript(false);
    setResults([]);
    setSavedToHistory(false);
    setStatus('Translating…');
    await runTranslation(null, text);
  };

  // ── Core translation pipeline ──
  const runTranslation = async (audioBlob, textInput) => {
    if (activeRequestController.current) {
      activeRequestController.current.abort();
    }
    const controller = new AbortController();
    activeRequestController.current = controller;
    
    activeRequestId.current++;
    const reqId = activeRequestId.current;

    const targets = getTargets();
    try {
      setStatus(audioBlob ? 'Transcribing…' : 'Translating…');

      const formData = new FormData();
      if (audioBlob) {
        formData.append('audio', audioBlob, 'recording.webm');
      } else {
        formData.append('text', textInput);
      }
      formData.append('source_lang', autoDetect ? 'auto' : sourceLang);
      formData.append('target_langs', targets.join(','));
      formData.append('stt_provider', sttProvider);
      formData.append('translation_provider', translationProvider);
      formData.append('tts_provider', ttsProvider || 'elevenlabs');
      if (preferLocalMode) formData.append('prefer_local', 'true');

      const response = await fetch(`${API_BASE}/api/translate-multi`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (activeRequestId.current !== reqId) return;

        const detail = errorData.detail;
        const msg = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join('; ')
          : detail ? JSON.stringify(detail)
          : `Server error (${response.status})`;
        throw new Error(msg);
      }

      const data = await response.json();
      if (activeRequestId.current !== reqId) return;
      if (data.error) {
        setErrorMsg(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        setStatus('Error');
        return;
      }

      let finalTranscript = data.transcript || textInput || '';
      let parsedDetectedLang = null;

      const fetchedResults = data.translations.map(t_obj => {
        let actualTranslation = t_obj.translated_text;
        
        if (autoDetect && translationProvider === 'gemini') {
          try {
            let cleaned = actualTranslation.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (parsed.detected_language) {
              parsedDetectedLang = parsed.detected_language;
              actualTranslation = parsed.translation || actualTranslation;
            }
          } catch(e) { /* not JSON, use raw */ }
        }

        return {
          lang: t_obj.lang,
          translation: actualTranslation,
          audioUrl: t_obj.audio_base64 ? `data:audio/mpeg;base64,${t_obj.audio_base64}` : null
        };
      });

      setTranscript(finalTranscript);
      setEditedTranscript(finalTranscript);
      if (parsedDetectedLang) setDetectedLang(parsedDetectedLang);
      setResults(fetchedResults);
      setTiming(data.timing || null);
      setStatus('Completed');
      setErrorMsg('');

      // Auto-play first result unconditionally
      if (fetchedResults[0]?.audioUrl) {
        setTimeout(() => playAudio(0, fetchedResults[0].audioUrl), 300);
      }

      // Auto-save to history (only when toggle is ON)
      if (autoSaveHistory && onSaveHistory) {
        onSaveHistory({
          type: 'quick_translate',
          sourceLang: autoDetect ? (parsedDetectedLang || 'auto') : sourceLang,
          targetLang: targets.join(', '),
          sttModel: sttProvider,
          translationModel: translationProvider,
          originalText: finalTranscript,
          translatedText: fetchedResults.map(r => `[${r.lang.toUpperCase()}] ${r.translation}`).join('\n'),
        });
        setSavedToHistory(true);
      }

    } catch (err) {
      if (err.name === 'AbortError') return;
      if (activeRequestId.current !== reqId) return;

      console.error(err);
      setErrorMsg(err.message || 'Connection failed. Check if backend is running.');
      setStatus('Error');
    }
  };

  // ── Audio playback ──
  const playAudio = (idx, url, onDone = null) => {
    // If we're playing all and this wasn't called by the sequence, stop the sequence
    if (isPlayingAllRef.current && !onDone) {
      stopAllAudio();
    }

    // Stop any currently playing
    Object.entries(audioRefs.current).forEach(([k, a]) => {
      if (parseInt(k) !== idx) { try { a.pause(); a.currentTime = 0; } catch(e) {} }
    });
    if (inputAudioRef.current && isInputPlaying) { try { inputAudioRef.current.pause(); inputAudioRef.current.currentTime = 0; } catch(e) {} }
    setIsInputPlaying(false);

    if (!url) {
      if (onDone) onDone();
      return;
    }

    let audio = audioRefs.current[idx];
    if (!audio || audio.src !== url) {
      audio = new Audio(url);
      audioRefs.current[idx] = audio;
    }
    audio.playbackRate = playbackSpeed;
    audio.currentTime = 0;
    
    const finish = () => {
      setPlayingIdx(null);
      if (!isPlayingAllRef.current) setStatus('Completed');
      if (onDone) onDone();
    };

    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(() => finish());
    
    setPlayingIdx(idx);
    setStatus(isPlayingAllRef.current 
      ? `Playing all... (${langName(results[idx].lang)})` 
      : 'Playing audio…'
    );
  };

  const pauseAudio = (idx) => {
    const audio = audioRefs.current[idx];
    if (audio) { 
      audio.pause(); 
      setPlayingIdx(null); 
      if (isPlayingAllRef.current) {
        stopAllAudio();
      } else {
        setStatus('Completed'); 
      }
    }
  };

  const stopAllAudio = () => {
    setIsPlayingAll(false);
    isPlayingAllRef.current = false;
    Object.values(audioRefs.current).forEach(a => { try { a.pause(); a.currentTime = 0; } catch(e) {} });
    setPlayingIdx(null);
    if (inputAudioRef.current) { try { inputAudioRef.current.pause(); inputAudioRef.current.currentTime = 0; } catch(e) {} }
    setIsInputPlaying(false);
    setStatus('Completed');
  };

  const handlePlayAll = () => {
    if (isPlayingAll) {
      stopAllAudio();
      return;
    }

    const queue = results
      .map((r, i) => ({ idx: i, url: r.audioUrl }))
      .filter(item => item.url);

    if (queue.length === 0) return;

    setIsPlayingAll(true);
    isPlayingAllRef.current = true;

    const playNext = (qIdx) => {
      if (!isPlayingAllRef.current || qIdx >= queue.length) {
        setIsPlayingAll(false);
        isPlayingAllRef.current = false;
        setPlayingIdx(null);
        setStatus('Completed');
        return;
      }
      const { idx, url } = queue[qIdx];
      playAudio(idx, url, () => playNext(qIdx + 1));
    };

    playNext(0);
  };

  const restartAudio = (idx, url) => {
    playAudio(idx, url);
  };

  const playInputAudio = () => {
    if (!inputAudioUrl) return;
    stopAllAudio();
    if (!inputAudioRef.current || inputAudioRef.current.src !== inputAudioUrl) {
      inputAudioRef.current = new Audio(inputAudioUrl);
    }
    inputAudioRef.current.playbackRate = playbackSpeed;
    inputAudioRef.current.currentTime = 0;
    
    const finish = () => setIsInputPlaying(false);
    inputAudioRef.current.onended = finish;
    inputAudioRef.current.onerror = finish;
    inputAudioRef.current.play().catch(() => finish());
    setIsInputPlaying(true);
  };

  const pauseInputAudio = () => {
    if (inputAudioRef.current) {
      inputAudioRef.current.pause();
      setIsInputPlaying(false);
    }
  };

  const restartInputAudio = () => {
    playInputAudio();
  };

  // Update playback rate when speed changes
  useEffect(() => {
    Object.values(audioRefs.current).forEach(a => { a.playbackRate = playbackSpeed; });
  }, [playbackSpeed]);

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
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = filename;
    a.click();
  };

  // ── Bulk actions for multi-language output ──
  const buildBulkText = () => {
    const lines = ['Quick Translate — Multi-language Output', ''];
    lines.push('Source:');
    lines.push(transcript || '(no transcript)');
    lines.push('');
    lines.push('Translations:');
    results.forEach(r => {
      lines.push(`[${langName(r.lang)}]`);
      lines.push(r.translation);
      lines.push('');
    });
    return lines.join('\n');
  };

  const handleCopyAll = () => {
    handleCopy(buildBulkText(), 'bulk-copy');
  };

  const handleDownloadAll = () => {
    downloadTxt(buildBulkText(), 'translations_all.txt');
  };

  const handleDownloadAllAudio = () => {
    results.forEach(r => {
      if (r.audioUrl) downloadMp3(r.audioUrl, `translation_${r.lang}.mp3`);
    });
  };

  const hasAnyAudio = results.some(r => r.audioUrl);

  // ── Multi-target add/remove ──
  const addTarget = (code) => {
    if (!selectedTargets.includes(code)) {
      setSelectedTargets([...selectedTargets, code]);
    }
  };

  const removeTarget = (code) => {
    if (selectedTargets.length > 1) {
      setSelectedTargets(selectedTargets.filter(c => c !== code));
    }
  };

  // ── Swap languages ──
  const swapLanguages = () => {
    if (autoDetect) return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
  };

  // ── Session actions ──
  const clearSession = () => {
    if (activeRequestController.current) {
      activeRequestController.current.abort();
      activeRequestController.current = null;
    }
    activeRequestId.current++;

    setTranscript(''); setEditedTranscript(''); setResults([]);
    setErrorMsg(''); setDetectedLang(null); setTiming(null); setStatus('Ready');
    setTypedText(''); setIsEditingTranscript(false); setSavedToHistory(false);
    Object.values(audioRefs.current).forEach(a => { try { a.pause(); } catch(e) {} });
    audioRefs.current = {};
    if (inputAudioRef.current) { try { inputAudioRef.current.pause(); } catch(e) {} }
    if (inputAudioUrl) { URL.revokeObjectURL(inputAudioUrl); setInputAudioUrl(null); }
    setIsInputPlaying(false);
    setPlayingIdx(null);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  const resetControls = () => {
    setSourceLang('en');
    setTargetLang('hi');
    setSelectedTargets(['hi']);
    setMultiTargetOn(false);
    setAutoDetect(true);
    setPlaybackSpeed(1.0);
    setAutoPlay(true);
    setAutoSaveHistory(true);
    setInputMode('speak');
  };

  const saveToHistory = () => {
    if (!transcript || savedToHistory) return;
    const targets = getTargets();
    if (onSaveHistory) {
      onSaveHistory({
        type: 'quick_translate',
        sourceLang: autoDetect ? (detectedLang || 'auto') : sourceLang,
        targetLang: targets.join(', '),
        sttModel: sttProvider,
        translationModel: translationProvider,
        originalText: transcript,
        translatedText: results.map(r => `[${r.lang.toUpperCase()}] ${r.translation}`).join('\n'),
      });
      setSavedToHistory(true);
    }
  };

  // ── Status badge class ──
  const statusClass = status.toLowerCase().replace(/[…\.]/g, '').replace(/\s+/g, '-').replace(/-$/, '');

  const isBusy = status === 'Transcribing…' || status === 'Translating…' || status === 'Listening…';

  // ── Available targets for multi-select (exclude current source if not auto-detect) ──
  const availableTargets = SUPPORTED_LANGUAGES.filter(
    l => !autoDetect ? l.code !== sourceLang : true
  );

  return (
    <>
      {/* TopAppBar Shell */}
      <header className="flex justify-between items-center w-full h-16 px-8 sticky top-0 z-40 ml-64 bg-[#111318]/80 backdrop-blur-xl shadow-[0_0_32px_rgba(173,198,255,0.08)]">
        <div className="flex items-center gap-4">
          <span className="text-lg font-black text-[#E2E2E8] font-manrope">Quick Translate</span>
          <div className="h-4 w-[1px] bg-outline-variant/30"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full">
            <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#ADC6FF]"></span>
            <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest">{status}</span>
          </div>
          {isRecording && <span className="text-sm font-mono text-error font-bold ml-2">{formatTime(timer)}</span>}
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
        {/* Center Workspace Area */}
        <div className="flex-1 flex flex-col p-8 gap-6">
          
          {errorMsg && (
            <div className="bg-error-container/20 border border-error/50 p-4 rounded-xl flex items-center gap-3">
               <AlertCircle size={18} className="text-error" />
               <p className="text-error font-medium flex-1">{errorMsg}</p>
            </div>
          )}

          {/* Top Panel: Source Input */}
          <section className="bg-surface-container-low rounded-2xl border border-outline-variant/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden relative group min-h-[280px]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -mr-32 -mt-32 transition-opacity group-hover:opacity-100 opacity-50 pointer-events-none"></div>
            
            <div className="flex items-center justify-between border-b border-outline-variant/10 px-6 py-4 bg-surface-container-lowest/50 relative z-10">
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-primary uppercase tracking-widest">Source Input</span>
                {detectedLang && (
                  <span className="text-[10px] font-bold text-tertiary bg-tertiary-container/10 px-2 py-0.5 rounded-sm uppercase tracking-widest">DETECTED: {detectedLang}</span>
                )}
                {!detectedLang && autoDetect && transcript && (
                  <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-sm uppercase tracking-widest">Auto-detect</span>
                )}
                {!autoDetect && transcript && (
                  <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-sm uppercase tracking-widest">{langName(sourceLang)}</span>
                )}
              </div>
              
              <div className="flex bg-surface-container-highest rounded-lg p-1">
                <button 
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${inputMode === 'speak' ? 'bg-[#282A2E] text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => setInputMode('speak')}
                  disabled={isBusy}
                >
                  <span className="material-symbols-outlined text-sm">mic</span> Speak
                </button>
                <button 
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${inputMode === 'type' ? 'bg-[#282A2E] text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => setInputMode('type')}
                  disabled={isBusy}
                >
                  <span className="material-symbols-outlined text-sm">keyboard</span> Type
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col relative z-10">
              {inputMode === 'speak' ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                  {!isRecording ? (
                    <>
                      <button 
                        className={`w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-primary-container/10 border-2 border-primary/20 flex items-center justify-center hover:scale-105 hover:border-primary/40 hover:shadow-[0_0_30px_rgba(173,198,255,0.15)] transition-all duration-300 group ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={startRecording}
                        disabled={isBusy}
                      >
                        <span className="material-symbols-outlined text-5xl text-primary group-hover:drop-shadow-[0_0_12px_#ADC6FF] transition-all">mic</span>
                      </button>
                      <p className="text-sm font-medium text-on-surface-variant">Tap to start speaking</p>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 bg-error/20 rounded-full animate-ping"></div>
                        <div className="w-24 h-24 rounded-full bg-error/10 border-2 border-error/50 flex items-center justify-center relative">
                          <span className="material-symbols-outlined text-5xl text-error drop-shadow-[0_0_12px_#FFB4AB] animate-pulse">mic</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest text-error font-bold rounded-xl hover:bg-error/20 transition-all shadow-lg" onClick={stopRecording}>
                          <span className="material-symbols-outlined text-sm">stop_circle</span> Stop & Translate
                        </button>
                        <button className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest text-on-surface-variant font-bold rounded-xl hover:text-on-surface transition-all shadow-lg" onClick={cancelRecording}>
                          <span className="material-symbols-outlined text-sm">close</span> Cancel
                        </button>
                      </div>
                    </>
                  )}
                  {transcript && !isRecording && (
                    <div className="w-full mt-4 p-4 bg-surface-container-lowest/50 rounded-xl border border-outline-variant/10">
                      {isEditingTranscript ? (
                        <textarea
                          className="w-full bg-surface-container-high border-none rounded-lg text-sm p-4 text-on-surface focus:ring-1 focus:ring-primary/40 outline-none resize-none"
                          value={editedTranscript}
                          onChange={(e) => setEditedTranscript(e.target.value)}
                          rows={3}
                        />
                      ) : (
                        <p className="text-on-surface leading-relaxed text-[15px]">{transcript}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col relative h-full">
                  <textarea
                    className="flex-1 w-full bg-transparent border-none text-on-surface text-lg resize-none placeholder-on-surface-variant/30 focus:ring-0 p-0 outline-none h-full"
                    placeholder="Enter text to translate..."
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    disabled={isBusy}
                  ></textarea>
                  <div className="absolute bottom-0 right-0 flex gap-3 pt-4">
                    <button className="px-5 py-2.5 rounded-xl font-bold text-xs text-on-surface-variant hover:text-on-surface transition-all bg-surface-container-highest" onClick={() => setTypedText('')} disabled={isBusy}>
                      Clear
                    </button>
                    <button className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-primary to-primary-container text-on-primary-container shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50" onClick={handleTypeTranslate} disabled={isBusy || !typedText.trim()}>
                      <span className="material-symbols-outlined text-[16px]">translate</span> Translate
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Source Audio & Actions */}
            {transcript && (
              <div className="bg-surface-container-lowest/80 border-t border-outline-variant/10 px-6 py-3 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  {inputAudioUrl && (
                    <>
                      <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isInputPlaying ? 'bg-primary/20 text-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`} onClick={isInputPlaying ? pauseInputAudio : playInputAudio}>
                        <span className="material-symbols-outlined text-[16px]">{isInputPlaying ? 'pause' : 'play_arrow'}</span>
                      </button>
                      <button className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-all" onClick={restartInputAudio}>
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                      </button>
                      <div className="w-px h-4 bg-outline-variant/20"></div>
                    </>
                  )}
                  <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5" onClick={() => handleCopy(transcript, 'transcript')}>
                    <span className="material-symbols-outlined text-[14px]">{copiedId === 'transcript' ? 'check' : 'content_copy'}</span> {copiedId === 'transcript' ? 'Copied' : 'Copy'}
                  </button>
                  {inputMode === 'speak' && (
                    <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5" onClick={() => {
                        if (isEditingTranscript) {
                          setTranscript(editedTranscript);
                          setIsEditingTranscript(false);
                        } else {
                          setEditedTranscript(transcript);
                          setIsEditingTranscript(true);
                        }
                      }}>
                      <span className="material-symbols-outlined text-[14px]">{isEditingTranscript ? 'check' : 'edit'}</span> {isEditingTranscript ? 'Done' : 'Edit'}
                    </button>
                  )}
                  <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5" onClick={() => downloadTxt(transcript, 'transcript.txt')}>
                    <span className="material-symbols-outlined text-[14px]">download</span> TXT
                  </button>
                </div>
                {inputMode === 'speak' && transcript && (
                  <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5" onClick={handleRetranslate} disabled={isBusy}>
                    <span className="material-symbols-outlined text-[14px]">refresh</span> Re-translate
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Bulk Actions Bar */}
          {multiTargetOn && results.length > 1 && (
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{results.length} Translations</span>
              <div className="flex gap-4">
                {hasAnyAudio && (
                  <button className={`text-[10px] font-bold uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5 ${isPlayingAll ? 'text-primary' : 'text-on-surface-variant'}`} onClick={handlePlayAll}>
                    <span className="material-symbols-outlined text-[14px]">{isPlayingAll ? 'stop_circle' : 'volume_up'}</span> {isPlayingAll ? 'Stop All' : 'Play All'}
                  </button>
                )}
                <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5" onClick={handleCopyAll}>
                  <span className="material-symbols-outlined text-[14px]">{copiedId === 'bulk-copy' ? 'check' : 'content_copy'}</span> Copy All
                </button>
                <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5" onClick={handleDownloadAll}>
                  <span className="material-symbols-outlined text-[14px]">download</span> Download TXT
                </button>
                {hasAnyAudio && (
                  <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5" onClick={handleDownloadAllAudio}>
                    <span className="material-symbols-outlined text-[14px]">download</span> Download Audio
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bottom Panel: Translation Results */}
          <section className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
            {/* Timing Bar */}
            {timing && (
              <div className="flex items-center gap-4 px-4 py-2 bg-surface-container-lowest/60 border border-outline-variant/10 rounded-xl text-[11px] font-mono text-on-surface-variant flex-wrap">
                <span className="text-on-surface-variant/50 font-bold uppercase tracking-widest">Timing</span>
                {timing.stt_time > 0 && <span>STT <span className="text-primary font-bold">{timing.stt_time.toFixed(2)}s</span></span>}
                {timing.translation_time != null && <span>Translate <span className="text-secondary font-bold">{timing.translation_time.toFixed(2)}s{timing.lang_count > 1 ? ` ×${timing.lang_count}` : ''}</span></span>}
                {timing.tts_time != null && <span>TTS <span className="text-tertiary font-bold">{timing.tts_time.toFixed(2)}s{timing.lang_count > 1 ? ` ×${timing.lang_count}` : ''}</span></span>}
                <span className="ml-auto">Total <span className="text-on-surface font-bold">{timing.total_time?.toFixed(2)}s</span></span>
              </div>
            )}
            {results.length > 0 ? results.map((result, idx) => (
              <div key={idx} className="bg-surface-container-low rounded-2xl border border-outline-variant/10 shadow-lg flex flex-col overflow-hidden shrink-0">
                <div className="flex items-center justify-between border-b border-outline-variant/10 px-6 py-3 bg-gradient-to-r from-surface-container-lowest/50 to-transparent">
                  <span className="text-[11px] font-black text-secondary tracking-widest uppercase">{langName(result.lang)}</span>
                </div>
                <div className="p-6">
                  <p className="text-on-surface text-lg leading-relaxed font-medium">{result.translation}</p>
                </div>
                <div className="bg-surface-container-lowest/80 border-t border-outline-variant/10 px-6 py-3 flex items-center gap-6">
                  {result.audioUrl ? (
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${playingIdx === idx ? 'bg-secondary/20 text-secondary' : 'hover:bg-surface-container-high hover:text-on-surface'}`} onClick={() => playingIdx === idx ? pauseAudio(idx) : playAudio(idx, result.audioUrl)}>
                        <span className="material-symbols-outlined text-[16px]">{playingIdx === idx ? 'pause' : 'play_arrow'}</span>
                      </button>
                      <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-high hover:text-on-surface transition-all" onClick={() => restartAudio(idx, result.audioUrl)}>
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">No Audio</span>
                  )}
                  <div className="w-px h-4 bg-outline-variant/20"></div>
                  <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-secondary transition-colors flex items-center gap-1.5" onClick={() => handleCopy(result.translation, `result-${idx}`)}>
                    <span className="material-symbols-outlined text-[14px]">{copiedId === `result-${idx}` ? 'check' : 'content_copy'}</span> {copiedId === `result-${idx}` ? 'Copied' : 'Copy'}
                  </button>
                  {result.audioUrl && (
                    <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-secondary transition-colors flex items-center gap-1.5" onClick={() => downloadMp3(result.audioUrl, `translation_${result.lang}.mp3`)}>
                      <span className="material-symbols-outlined text-[14px]">download</span> MP3
                    </button>
                  )}
                  <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-secondary transition-colors flex items-center gap-1.5" onClick={() => downloadTxt(result.translation, `translation_${result.lang}.txt`)}>
                    <span className="material-symbols-outlined text-[14px]">download</span> TXT
                  </button>
                </div>
              </div>
            )) : (
              <div className="bg-surface-container-lowest/30 rounded-2xl border border-dashed border-outline-variant/20 flex-1 flex flex-col items-center justify-center p-8 opacity-50 min-h-[200px]">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">translate</span>
                <p className="text-sm font-medium text-on-surface-variant/60">Your translation will appear here</p>
              </div>
            )}
          </section>
        </div>

        {/* Right Control Panel */}
        <aside className="w-80 border-l border-outline-variant/15 bg-surface-container-lowest p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar shadow-[-10px_0_30px_rgba(0,0,0,0.2)] z-10">
          
          {/* Languages Configuration */}
          <div className="space-y-6">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">translate</span>
              Languages
            </h3>
            
            <div className="space-y-4">
              {/* Source Setting */}
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
                    {detectedLang && <span className="ml-auto text-[10px] font-extrabold text-tertiary bg-tertiary/20 px-2.5 py-1 rounded-lg border border-tertiary/30 shadow-[0_0_8px_rgba(79,220,162,0.15)] uppercase tracking-wider">{detectedLang}</span>}
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

              {/* Swap Button */}
              <div className="flex justify-center -my-2 relative z-10 w-full">
                <button 
                  className={`w-8 h-8 bg-surface-container-highest border border-outline-variant/20 rounded-full flex items-center justify-center ${autoDetect || isBusy ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110 hover:border-primary/40 hover:text-primary'} transition-all`}
                  onClick={swapLanguages} disabled={autoDetect || isBusy}
                  title={autoDetect ? 'Disable auto-detect to swap' : 'Swap languages'}
                >
                  <span className="material-symbols-outlined text-[16px]">swap_vert</span>
                </button>
              </div>

              {/* Target Setting */}
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-on-surface-variant/70 font-semibold ml-1">Target Language(s)</label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="sr-only peer" checked={multiTargetOn} onChange={(e) => {
                      setMultiTargetOn(e.target.checked);
                      if (e.target.checked && selectedTargets.length === 0) setSelectedTargets([targetLang]);
                    }} />
                    <div className="relative w-7 h-4 bg-surface-container border border-outline-variant/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-on-surface-variant peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-secondary/80 peer-checked:border-secondary"></div>
                    <span className="text-[10px] font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">Multiple</span>
                  </label>
                </div>
                {!multiTargetOn ? (
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
                ) : (
                  <div className="w-full bg-surface-container-high border border-transparent rounded-xl p-3 flex flex-wrap gap-2 transition-all">
                    {selectedTargets.map(code => (
                      <span className="text-xs font-bold bg-secondary/10 text-secondary px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-secondary/20" key={code}>
                        {langName(code)}
                        <button className="hover:text-on-surface transition-colors flex items-center" onClick={() => removeTarget(code)} title="Remove">
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </span>
                    ))}
                    <select 
                      className="text-xs font-bold text-on-surface-variant bg-transparent border-none appearance-none outline-none focus:ring-0 cursor-pointer max-w-[120px]"
                      value="" 
                      onChange={(e) => { if (e.target.value) addTarget(e.target.value); }}
                      disabled={isBusy}
                    >
                      <option value="">+ Add language</option>
                      {availableTargets
                        .filter(l => !selectedTargets.includes(l.code))
                        .map(l => <option key={l.code} value={l.code}>{l.name}</option>)
                      }
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Audio Behavior */}
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

          {/* Session Control */}
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
                disabled={!transcript || savedToHistory}
              >
                <span className="material-symbols-outlined text-[16px]">{savedToHistory ? 'check' : 'save'}</span>
                {savedToHistory ? 'Saved to History' : 'Save to History'}
              </button>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button 
                  className="py-2.5 px-3 bg-surface-container-lowest border border-outline-variant/10 text-on-surface-variant font-bold text-[11px] rounded-lg hover:text-on-surface hover:bg-error/10 hover:border-error/30 hover:text-error transition-all flex items-center justify-center gap-1.5"
                  onClick={clearSession}
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
