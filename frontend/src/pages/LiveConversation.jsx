import React, { useState, useRef, useEffect } from 'react';
import API_BASE from '../config/api';
import {
  Mic, Square, Loader2, Play, RotateCcw, AlertCircle,
  Copy, Download, Check, ArrowRightLeft, MessagesSquare,
  FileText, Volume2, Trash2, RefreshCw, Save
} from 'lucide-react';
import { INDIAN_LANGUAGES, INTERNATIONAL_LANGUAGES, getLanguageName } from '../config/languages';

// ── Constants ────────────────────────────────────────────────────────────
const SPEED_MIN  = 0.5;
const SPEED_MAX  = 2.0;
const SPEED_STEP = 0.25;
const DRAFT_KEY  = 'ai_translator_lc_draft_v1';

// ── Draft helpers ────────────────────────────────────────────────────────
const saveDraft = (data) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (_) {}
};

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
};

const clearDraftStorage = () => {
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
};

// ── Main component ───────────────────────────────────────────────────────
export default function LiveConversation({
  sttProvider, translationProvider, ttsProvider,
  onSaveHistory, onUpdateHistory,
  preferLocalMode
}) {
  // Load draft once on mount
  const [initialDraft] = useState(() => loadDraft());

  // ── Page-local settings (all persisted) ──────────────────────────────
  const [sp1Lang,           setSp1Lang]          = useState(initialDraft.sp1Lang           || 'en');
  const [sp2Lang,           setSp2Lang]          = useState(initialDraft.sp2Lang           || 'hi');
  const [localAutoSave,     setLocalAutoSave]    = useState(initialDraft.localAutoSave     ?? true);
  const [localSpeed,        setLocalSpeed]       = useState(initialDraft.localSpeed        || 1.0);

  // ── Session state (persisted, but audio blobs are not) ───────────────
  const [conversationTurns, setConversationTurns] = useState(initialDraft.conversationTurns || []);
  const [summary,            setSummary]          = useState(initialDraft.summary           || '');

  // ── Recording / UI state (never persisted) ───────────────────────────
  const [activeSpeaker,  setActiveSpeaker]  = useState(null); // 1 | 2 | null
  const [status,         setStatus]         = useState('Ready');
  const [errorMsg,       setErrorMsg]       = useState('');
  const [timer,          setTimer]          = useState(0);
  const [isSummarizing,  setIsSummarizing]  = useState(false);
  const [copiedId,       setCopiedId]       = useState(null);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const [playingTurnIdx, setPlayingTurnIdx] = useState(null);

  const mediaRecorder   = useRef(null);
  const audioChunks     = useRef([]);
  const timerInterval   = useRef(null);
  const sessionHistoryId= useRef(null);
  const turnAudioRefs   = useRef({});  // idx → Audio instance

  // ── Active Request Tracking ──────────────────────────────────────────
  const activeRequestId = useRef(0);
  const activeRequestController = useRef(null);

  // ── Recording timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeSpeaker !== null) {
      timerInterval.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerInterval.current);
      setTimer(0);
    }
    return () => clearInterval(timerInterval.current);
  }, [activeSpeaker]);

  // ── Draft persistence ────────────────────────────────────────────────
  useEffect(() => {
    saveDraft({
      sp1Lang, sp2Lang, localAutoSave, localSpeed,
      conversationTurns: conversationTurns.map(t => ({
        speaker:    t.speaker,
        sourceTag:  t.sourceTag,
        targetTag:  t.targetTag,
        transcript: t.transcript,
        translation:t.translation,
        timestamp:  t.timestamp,
        // audio not persisted — blobs are ephemeral
      })),
      summary,
    });
  }, [sp1Lang, sp2Lang, localAutoSave, localSpeed,
      conversationTurns, summary]);

  // ── Cleanup on unmount (stop microphone if navigating away) ─────────
  useEffect(() => {
    return () => {
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        // Detach the onstop handler so processAudio isn't called as a zombie
        mediaRecorder.current.onstop = null;
        mediaRecorder.current.stop();
        mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
      }
      clearInterval(timerInterval.current);
      Object.values(turnAudioRefs.current).forEach(a => { try { a.pause(); } catch (_) {} });
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────
  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  };

  const downloadTxt = (text, filename) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const statusClass = () => {
    if (activeSpeaker)           return `status-listening`;
    if (status === '⚙️ Interpreting...') return 'status-translating';
    if (status === 'Ready')      return 'status-ready';
    if (status === 'Error')      return 'status-error';
    if (status.startsWith('Playing')) return 'status-playing-audio';
    return 'status-ready';
  };

  const statusLabel = () => {
    if (activeSpeaker !== null) return `🎙 Listening to Speaker ${activeSpeaker}… (${formatTime(timer)})`;
    return status;
  };

  const isBusy = activeSpeaker !== null || status === '⚙️ Interpreting...';

  // ── Recording ────────────────────────────────────────────────────────
  const startRecording = async (speakerNum) => {
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
      mediaRecorder.current.onstop = () => processAudio(speakerNum);
      audioChunks.current = [];
      mediaRecorder.current.start();
      setActiveSpeaker(speakerNum);
      setErrorMsg('');
      setStatus(`🎙️ Listening to Speaker ${speakerNum}...`);
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
      setActiveSpeaker(null);
      setStatus('⚙️ Interpreting...');
    }
  };

  // ── Audio playback for a turn ─────────────────────────────────────────
  const playTurnAudio = (idx, url) => {
    // Stop any currently playing turn audio
    Object.entries(turnAudioRefs.current).forEach(([k, a]) => {
      if (parseInt(k) !== idx) { try { a.pause(); a.currentTime = 0; } catch (_) {} }
    });

    if (!url) return;

    let audio = turnAudioRefs.current[idx];
    if (!audio || audio.src !== url) {
      audio = new Audio(url);
      turnAudioRefs.current[idx] = audio;
    }
    audio.playbackRate = localSpeed;
    audio.currentTime  = 0;
    const finish = () => { setPlayingTurnIdx(null); setStatus('Ready'); };
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(finish);
    setPlayingTurnIdx(idx);
    setStatus('Playing translation...');
  };

  const restartTurnAudio = (idx, url) => playTurnAudio(idx, url);

  // When speed changes, update any live audio
  useEffect(() => {
    Object.values(turnAudioRefs.current).forEach(a => { a.playbackRate = localSpeed; });
  }, [localSpeed]);

  // ── Process audio after stop ──────────────────────────────────────────
  const processAudio = async (speakerNum) => {
    if (audioChunks.current.length === 0) { setStatus('Ready'); return; }

    if (activeRequestController.current) {
      activeRequestController.current.abort();
    }
    const controller = new AbortController();
    activeRequestController.current = controller;
    
    activeRequestId.current++;
    const reqId = activeRequestId.current;

    const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
    const formData  = new FormData();
    formData.append('audio', audioBlob, `speaker${speakerNum}.webm`);

    // Speaker 1 speaks sp1Lang → translates to sp2Lang
    // Speaker 2 speaks sp2Lang → translates back to sp1Lang
    let sLang = speakerNum === 1 ? sp1Lang : sp2Lang;
    const tLang = speakerNum === 1 ? sp2Lang : sp1Lang;

    formData.append('source_lang',          sLang);
    formData.append('target_lang',          tLang);
    formData.append('stt_provider',         sttProvider);
    formData.append('translation_provider', translationProvider);
    formData.append('tts_provider',         ttsProvider || 'elevenlabs');
    if (preferLocalMode) formData.append('prefer_local', 'true');
    if (conversationTurns.length > 0) {
      const ctxText = conversationTurns.slice(-3)
        .map(t => `Speaker ${t.speaker}: ${t.transcript}`)
        .join('\n');
      formData.append('context_text', ctxText);
    }

    try {
      const response = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (activeRequestId.current !== reqId) return;
        throw new Error(errData.detail || `Server error (${response.status})`);
      }

      const data = await response.json();
      if (activeRequestId.current !== reqId) return;

      if (data.error) { setErrorMsg(data.error); setStatus('Error'); return; }

      let actualTranslation = data.translated_text;
      let actualSourceTag   = sLang;
      if (sLang === 'auto' && translationProvider === 'gemini') {
        try {
          const cleaned = actualTranslation.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed  = JSON.parse(cleaned);
          if (parsed.detected_language) {
            actualSourceTag   = parsed.detected_language;
            actualTranslation = parsed.translation || actualTranslation;
          }
        } catch (_) {}
      }

      let audioUrl = null;
      if (data.audio_base64) {
        audioUrl = `data:audio/mpeg;base64,${data.audio_base64}`;
      }

      const turnRecord = {
        speaker:     speakerNum,
        sourceTag:   actualSourceTag,
        targetTag:   tLang,
        transcript:  data.transcript,
        translation: actualTranslation,
        audio:       audioUrl,
        timestamp:   new Date().toLocaleTimeString(),
      };

      setConversationTurns(prev => {
        const updated       = [...prev, turnRecord];
        const persistTurns  = updated.map(t => ({
          speaker: t.speaker, sourceTag: t.sourceTag, targetTag: t.targetTag,
          transcript: t.transcript, translation: t.translation, timestamp: t.timestamp,
        }));

        if (!sessionHistoryId.current) {
          if (localAutoSave && onSaveHistory) {
            const saved = onSaveHistory({
              type: 'live_conversation', sourceLang: sp1Lang, targetLang: sp2Lang,
              sttModel: sttProvider, translationModel: translationProvider,
              originalText: data.transcript, translatedText: actualTranslation,
              turns: persistTurns,
            });
            if (saved?.id) { sessionHistoryId.current = saved.id; setSavedToHistory(true); }
          }
        } else {
          onUpdateHistory(sessionHistoryId.current, {
            turns: persistTurns,
            originalText: `${persistTurns.length} conversation turns`,
            translatedText: persistTurns[persistTurns.length - 1]?.translation || '',
          });
        }

        return updated;
      });

      setStatus('Ready');
      setErrorMsg('');

      if (audioUrl) {
        // Give React a tick to attach the index before playing
        setTimeout(() => {
          const newIdx = conversationTurns.length; // index of the just-added turn
          playTurnAudio(newIdx, audioUrl);
        }, 150);
      }

    } catch (err) {
      if (err.name === 'AbortError') return;
      if (activeRequestId.current !== reqId) return;

      console.error(err);
      setErrorMsg(err.message || 'Connection failed.');
      setStatus('Error');
    }
  };

  // ── Summary ───────────────────────────────────────────────────────────
  const generateSummary = async () => {
    if (conversationTurns.length === 0) return;

    if (activeRequestController.current) {
      activeRequestController.current.abort();
    }
    const controller = new AbortController();
    activeRequestController.current = controller;
    
    activeRequestId.current++;
    const reqId = activeRequestId.current;

    setIsSummarizing(true);
    setSummary('');
    const fullTranscript = conversationTurns
      .map(t => `Speaker ${t.speaker}: ${t.transcript}`)
      .join('\n');
    const formData = new FormData();
    formData.append('text', fullTranscript);
    formData.append('translation_provider', translationProvider);
    try {
      const res  = await fetch(`${API_BASE}/api/summarize`, {
        method: 'POST', body: formData, signal: controller.signal 
      });
      if (!res.ok) {
        if (activeRequestId.current !== reqId) return;
        throw new Error('Failed to summarize');
      }
      const data = await res.json();
      if (activeRequestId.current !== reqId) return;

      setSummary(data.summary);
      if (sessionHistoryId.current) {
        onUpdateHistory(sessionHistoryId.current, { summary: data.summary });
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (activeRequestId.current !== reqId) return;

      console.error(err);
      setErrorMsg('Failed to generate summary.');
    } finally {
      if (activeRequestId.current === reqId) setIsSummarizing(false);
    }
  };

  // ── Session actions ───────────────────────────────────────────────────
  const buildScript = () => {
    const lines = ['=== TRANSLI LIVE CONVERSATION SCRIPT ===', ''];
    lines.push(`Speaker 1: ${getLanguageName(sp1Lang)}`);
    lines.push(`Speaker 2: ${getLanguageName(sp2Lang)}`);
    lines.push(`STT: ${sttProvider}  |  Translation: ${translationProvider}`);
    lines.push('');
    conversationTurns.forEach(t => {
      lines.push(`[${t.timestamp}] SPEAKER ${t.speaker}`);
      lines.push(`  ${t.sourceTag === 'auto' ? 'Auto-Detected' : getLanguageName(t.sourceTag)}: ${t.transcript}`);
      lines.push(`  ${getLanguageName(t.targetTag)}: ${t.translation}`);
      lines.push('');
    });
    if (summary) { lines.push('=== SESSION SUMMARY ==='); lines.push(summary); }
    return lines.join('\n');
  };

  const copyFullScript   = () => handleCopy(buildScript(), 'full-script');
  const downloadScript   = () => downloadTxt(buildScript(), `conversation_${Date.now()}.txt`);

  const saveToHistoryManual = () => {
    if (savedToHistory || conversationTurns.length === 0) return;
    const persistTurns = conversationTurns.map(t => ({
      speaker: t.speaker, sourceTag: t.sourceTag, targetTag: t.targetTag,
      transcript: t.transcript, translation: t.translation, timestamp: t.timestamp,
    }));
    if (onSaveHistory) {
      const saved = onSaveHistory({
        type: 'live_conversation', sourceLang: sp1Lang, targetLang: sp2Lang,
        sttModel: sttProvider, translationModel: translationProvider,
        originalText: `${persistTurns.length} conversation turns`,
        translatedText: persistTurns[persistTurns.length - 1]?.translation || '',
        turns: persistTurns, summary,
      });
      if (saved?.id) { sessionHistoryId.current = saved.id; }
    }
    setSavedToHistory(true);
  };

  const clearSession = () => {
    if (activeRequestController.current) {
      activeRequestController.current.abort();
      activeRequestController.current = null;
    }
    activeRequestId.current++;

    setConversationTurns([]);
    setSummary('');
    setErrorMsg('');
    setStatus('Ready');
    setSavedToHistory(false);
    setPlayingTurnIdx(null);
    sessionHistoryId.current = null;
    Object.values(turnAudioRefs.current).forEach(a => { try { a.pause(); } catch (_) {} });
    turnAudioRefs.current = {};
    clearDraftStorage();
  };

  const resetControls = () => {
    setSp1Lang('en');
    setSp2Lang('hi');
    setLocalAutoSave(true);
    setLocalSpeed(1.0);
  };

  // ── Download a single turn ────────────────────────────────────────────
  const downloadTurn = (turn, idx) => {
    const text = [
      `Turn ${idx + 1} — Speaker ${turn.speaker} [${turn.timestamp}]`,
      `${turn.sourceTag === 'auto' ? 'Detected' : getLanguageName(turn.sourceTag)}: ${turn.transcript}`,
      `${getLanguageName(turn.targetTag)}: ${turn.translation}`,
    ].join('\n');
    downloadTxt(text, `turn_${idx + 1}_speaker_${turn.speaker}.txt`);
  };

  // ─────────────────────────────────────────────────────────────────────
  // ── RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* TopAppBar Shell */}
      <header className="flex justify-between items-center w-full h-16 px-8 sticky top-0 z-40 ml-64 bg-[#111318]/80 backdrop-blur-xl shadow-[0_0_32px_rgba(173,198,255,0.08)]">
        <div className="flex items-center gap-4">
          <span className="text-lg font-black text-[#E2E2E8] font-manrope">Live Conversation</span>
          <div className="h-4 w-[1px] bg-outline-variant/30"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-tertiary-container/10 rounded-full">
            <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#D0BCFF]"></span>
            <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest">{statusLabel()}</span>
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
        {/* Center Workspace Area */}
        <div className="flex-1 flex flex-col p-8 gap-8">
          
          {errorMsg && (
            <div className="bg-error-container/20 border border-error/50 p-4 rounded-xl flex items-center gap-3">
               <AlertCircle size={18} className="text-error" />
               <p className="text-error font-medium flex-1">{errorMsg}</p>
            </div>
          )}

          {/* Session Summary Card */}
          <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -mr-32 -mt-32 transition-opacity group-hover:opacity-100 opacity-50"></div>
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-1">
                <h2 className="text-on-surface font-headline font-bold text-xl">Current Session</h2>
                <p className="text-on-surface-variant text-sm">Turns: <span className="text-primary font-mono">{conversationTurns.length}</span></p>
                {summary && <p className="text-on-surface text-sm mt-3 border-l-2 border-primary/50 pl-3 italic">{summary}</p>}
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Status</p>
                  <p className="text-lg font-bold font-headline">{isBusy ? "Active" : "Ready"}</p>
                </div>
                {activeSpeaker && (
                  <div className="text-right">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Duration</p>
                    <p className="text-lg font-bold font-headline text-tertiary">{formatTime(timer)}</p>
                  </div>
                )}
              </div>
            </div>
            {conversationTurns.length > 0 && (
              <div className="mt-4 pt-4 border-t border-outline-variant/10 flex gap-4">
                <button onClick={copyFullScript} className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">content_copy</span> Copy Transcript
                </button>
                <button onClick={downloadScript} className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">download</span> Download TXT
                </button>
                <button onClick={generateSummary} disabled={isBusy || isSummarizing} className="text-xs font-bold text-tertiary hover:text-tertiary-container transition-colors flex items-center gap-2 ml-auto">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span> 
                  {isSummarizing ? "Summarizing..." : "Generate AI Summary"}
                </button>
              </div>
            )}
          </section>

          {/* Conversation List */}
          <section className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-4">
            {conversationTurns.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center bg-surface-container-low/30 rounded-2xl border border-dashed border-outline-variant/20">
                 <MessagesSquare size={40} className="text-on-surface-variant/30 mb-4" />
                 <p className="text-on-surface font-medium mb-1">Start your active session</p>
                 <p className="text-sm text-on-surface-variant/60">Press and hold standard microphone options beneath.</p>
               </div>
            ) : (
              conversationTurns.map((turn, idx) => {
                const isPlaying = playingTurnIdx === idx;
                const isSp1 = turn.speaker === 1;
                return (
                  <div key={idx} className={`flex gap-4 ${isSp1 ? 'self-start flex-row' : 'self-end flex-row-reverse'} max-w-[80%] shrink-0`}>
                    <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant/20 shadow-lg">
                      <span className={`material-symbols-outlined ${isSp1 ? 'text-primary' : 'text-secondary'}`}>{isSp1 ? 'person' : 'person_4'}</span>
                    </div>
                    <div className={`space-y-2 ${!isSp1 ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-3 ${!isSp1 ? 'justify-end' : ''}`}>
                        {isSp1 ? (
                          <>
                            <span className="text-xs font-bold text-primary uppercase tracking-widest">Speaker 1</span>
                            <span className="text-[10px] text-on-surface-variant/60">{turn.timestamp}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-on-surface-variant/60">{turn.timestamp}</span>
                            <span className="text-xs font-bold text-secondary uppercase tracking-widest">Speaker 2</span>
                          </>
                        )}
                      </div>
                      <div className={`bg-surface-container-${isSp1 ? 'high' : 'lowest'} p-4 rounded-2xl ${isSp1 ? 'rounded-tl-none' : 'rounded-tr-none'} border border-${isSp1 ? 'primary' : 'secondary'}/10 shadow-[4px_4px_20px_rgba(0,0,0,0.2)] ${!isSp1 ? 'text-left' : ''}`}>
                        <div className="flex justify-between items-start gap-4 mb-1">
                          <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">
                            {turn.sourceTag === 'auto' ? 'Detected' : getLanguageName(turn.sourceTag)}
                          </span>
                        </div>
                        <p className="text-on-surface leading-relaxed text-[15px]">{turn.transcript}</p>
                        
                        <div className="mt-3 pt-3 border-t border-outline-variant/10">
                          <div className="flex justify-between items-start gap-4 mb-1">
                            <span className={`text-[10px] uppercase tracking-widest font-bold ${isSp1 ? 'text-primary/80' : 'text-secondary/80'}`}>
                              Translated to {getLanguageName(turn.targetTag)}
                            </span>
                            {turn.audio && (
                              <button onClick={() => playTurnAudio(idx, turn.audio)} className={`hover:scale-110 transition-transform ${isPlaying ? 'text-primary' : 'text-on-surface-variant'}`}>
                                <span className="material-symbols-outlined text-[16px]">{isPlaying ? 'volume_up' : 'play_circle'}</span>
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-on-surface-variant font-medium leading-relaxed">{turn.translation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Active Recording State */}
            {activeSpeaker && (
              <div className={`flex gap-4 ${activeSpeaker === 1 ? 'self-start flex-row' : 'self-end flex-row-reverse'} max-w-[80%] animate-pulse shrink-0`}>
                <div className={`w-10 h-10 rounded-xl ${activeSpeaker === 1 ? 'bg-primary/20 border-primary/30' : 'bg-secondary/20 border-secondary/30'} flex items-center justify-center shrink-0 border`}>
                  <span className={`material-symbols-outlined ${activeSpeaker === 1 ? 'text-primary' : 'text-secondary'}`}>mic</span>
                </div>
                <div className={`space-y-2 ${activeSpeaker === 2 ? 'flex justify-end' : ''}`}>
                  <div className={`bg-surface-container-high/40 p-4 rounded-2xl ${activeSpeaker === 1 ? 'rounded-tl-none' : 'rounded-tr-none'} border border-dashed ${activeSpeaker === 1 ? 'border-primary/40' : 'border-secondary/40'} min-w-[60px]`}>
                    <div className="flex gap-1 items-center h-4">
                      <span className={`w-1 h-2 ${activeSpeaker === 1 ? 'bg-primary/40' : 'bg-secondary/40'} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></span>
                      <span className={`w-1 h-4 ${activeSpeaker === 1 ? 'bg-primary/60' : 'bg-secondary/60'} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></span>
                      <span className={`w-1 h-3 ${activeSpeaker === 1 ? 'bg-primary/40' : 'bg-secondary/40'} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></span>
                      <span className={`w-1 h-2 ${activeSpeaker === 1 ? 'bg-primary/70' : 'bg-secondary/70'} rounded-full animate-bounce`} style={{ animationDelay: '450ms' }}></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Bottom Speak Controls */}
          <section className="grid grid-cols-2 gap-6 pt-4">
            <button 
              className={`group relative flex items-center justify-between p-6 bg-gradient-to-br from-surface-container-high to-surface-container-lowest rounded-2xl border ${activeSpeaker === 1 ? 'border-primary shadow-[0_0_30px_rgba(173,198,255,0.15)]' : 'border-outline-variant/20 hover:border-primary/40'} transition-all duration-500 overflow-hidden ${(activeSpeaker === 2 || status === '⚙️ Interpreting...') ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => activeSpeaker === 1 ? stopRecording() : startRecording(1)}
              disabled={activeSpeaker === 2 || status === '⚙️ Interpreting...'}
            >
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Speaker 1 Control</span>
                <span className="text-lg font-headline font-extrabold text-on-surface">{activeSpeaker === 1 ? 'Tap to Stop' : 'Tap to Speak'}</span>
              </div>
              <div className="w-14 h-14 rounded-full bg-surface-container-highest border-4 border-surface shadow-[0_0_20px_rgba(0,0,0,0.4)] flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-all duration-300">
                <span className={`material-symbols-outlined ${activeSpeaker === 1 ? 'text-primary drop-shadow-[0_0_8px_#ADC6FF]' : 'text-on-surface-variant'} text-3xl group-hover:text-primary transition-colors`}>{activeSpeaker === 1 ? 'stop' : 'mic'}</span>
              </div>
            </button>
            <button 
              className={`group relative flex items-center justify-between p-6 bg-gradient-to-br from-surface-container-high to-surface-container-lowest rounded-2xl border ${activeSpeaker === 2 ? 'border-secondary shadow-[0_0_30px_rgba(192,193,255,0.15)]' : 'border-outline-variant/20 hover:border-secondary/40'} transition-all duration-500 overflow-hidden ${(activeSpeaker === 1 || status === '⚙️ Interpreting...') ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => activeSpeaker === 2 ? stopRecording() : startRecording(2)}
              disabled={activeSpeaker === 1 || status === '⚙️ Interpreting...'}
            >
              <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Speaker 2 Control</span>
                <span className="text-lg font-headline font-extrabold text-on-surface">{activeSpeaker === 2 ? 'Tap to Stop' : 'Tap to Speak'}</span>
              </div>
              <div className="w-14 h-14 rounded-full bg-surface-container-highest border-4 border-surface shadow-[0_0_20px_rgba(0,0,0,0.4)] flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-all duration-300">
                <span className={`material-symbols-outlined ${activeSpeaker === 2 ? 'text-secondary drop-shadow-[0_0_8px_#C0C1FF]' : 'text-on-surface-variant'} text-3xl group-hover:text-secondary transition-colors`}>{activeSpeaker === 2 ? 'stop' : 'mic_external_on'}</span>
              </div>
            </button>
          </section>
        </div>

        {/* Right Control Panel */}
        <aside className="w-80 border-l border-outline-variant/15 bg-surface-container-lowest p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar shadow-[-10px_0_30px_rgba(0,0,0,0.2)] z-10">
          
          {/* Speaker Languages */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">language</span>
              Speaker Languages
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant/70 font-semibold ml-1">Speaker 1 Input</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-surface-container-high border-none rounded-xl text-sm py-3 px-4 appearance-none focus:ring-1 focus:ring-primary/40 transition-all cursor-pointer text-on-surface outline-none"
                    value={sp1Lang} onChange={e => setSp1Lang(e.target.value)} disabled={isBusy}
                  >
                    <optgroup label="Indian Languages">
                      {INDIAN_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </optgroup>
                    <optgroup label="International">
                      {INTERNATIONAL_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </optgroup>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none group-focus-within:rotate-180 transition-transform">expand_more</span>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant/70 font-semibold ml-1">Speaker 2 Input</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-surface-container-high border-none rounded-xl text-sm py-3 px-4 appearance-none focus:ring-1 focus:ring-secondary/40 transition-all cursor-pointer text-on-surface outline-none"
                    value={sp2Lang} onChange={e => setSp2Lang(e.target.value)} disabled={isBusy}
                  >
                    <optgroup label="Indian Languages">
                      {INDIAN_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </optgroup>
                    <optgroup label="International">
                      {INTERNATIONAL_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </optgroup>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none group-focus-within:rotate-180 transition-transform">expand_more</span>
                </div>
              </div>
            </div>
          </div>

          {/* Behavior Configuration */}
          <div className="space-y-4 pt-4 border-t border-outline-variant/10">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">tune</span>
              Behavior
            </h3>
            <div className="space-y-6 px-1">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-on-surface-variant font-medium">Playback Speed</label>
                  <span className="text-xs font-bold text-primary">{localSpeed.toFixed(2)}x</span>
                </div>
                <input 
                  className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary" 
                  type="range"
                  min={SPEED_MIN}
                  max={SPEED_MAX}
                  step={SPEED_STEP}
                  value={localSpeed}
                  onChange={e => setLocalSpeed(parseFloat(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant font-medium">Auto-save</span>
                <button 
                  className={`w-10 h-5 rounded-full relative p-0.5 transition-colors ${localAutoSave ? 'bg-primary/20' : 'bg-surface-container-high'}`}
                  onClick={() => setLocalAutoSave(!localAutoSave)}
                >
                  <div className={`w-4 h-4 rounded-full shadow-[0_0_8px_rgba(173,198,255,0.5)] transform transition-transform ${localAutoSave ? 'bg-primary translate-x-5' : 'bg-outline-variant'}`}></div>
                </button>
              </div>
            </div>
          </div>

          {/* Session Actions */}
          <div className="space-y-4 pt-4 border-t border-outline-variant/10 mt-auto">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">dns</span>
              Session Control
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={saveToHistoryManual}
                disabled={conversationTurns.length === 0 || savedToHistory}
                className="w-full py-3 px-4 bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-bold text-xs rounded-xl shadow-[0_4px_12px_rgba(173,198,255,0.15)] hover:shadow-[0_4px_20px_rgba(173,198,255,0.25)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="material-symbols-outlined text-sm">{savedToHistory ? 'check' : 'save'}</span>
                {savedToHistory ? 'Saved' : 'Save to History'}
              </button>
              <button 
                onClick={clearSession} disabled={isBusy}
                className="w-full py-3 px-4 bg-surface-container-high border border-outline-variant/10 text-on-surface-variant font-bold text-xs rounded-xl hover:text-on-surface hover:bg-error/20 hover:text-error transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                Clear Session
              </button>
              <button 
                onClick={resetControls} disabled={isBusy}
                className="w-full py-3 px-4 text-on-surface-variant font-bold text-[10px] uppercase tracking-widest hover:text-primary transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">restart_alt</span>
                Reset All Controls
              </button>
            </div>
          </div>

        </aside>
      </main>
    </>
  );
}
