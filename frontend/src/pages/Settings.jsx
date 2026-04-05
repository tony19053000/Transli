import React from 'react';

export default function Settings({ 
  sttProvider, setSttProvider,
  translationProvider, setTranslationProvider,
  ttsProvider, setTtsProvider
}) {
  return (
    <>
      {/* TopAppBar Shell */}
      <header className="flex justify-between items-center w-full h-16 px-8 sticky top-0 z-40 ml-64 bg-[#111318]/80 backdrop-blur-xl shadow-[0_0_32px_rgba(173,198,255,0.08)]">
        <div className="flex items-center gap-4">
          <span className="text-lg font-black text-[#E2E2E8] font-manrope">App Settings</span>
          <div className="h-4 w-[1px] bg-outline-variant/30"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
            <span className="w-2 h-2 rounded-full shadow-[0_0_8px_#ADC6FF] bg-primary"></span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Configuration</span>
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
      <main className="ml-64 flex h-[calc(100vh-64px)] justify-center overflow-y-auto custom-scrollbar">
        
        <div className="w-full max-w-4xl p-8 flex flex-col gap-8 pb-16">
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-on-surface mb-2 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[28px]">tune</span> 
                Engine Configuration
              </h2>
              <p className="text-sm font-medium text-on-surface-variant max-w-xl m-0 leading-relaxed">
                Configure Transli's speech, text, and translation engines. Select the primary engines powered by Cloud or Local intelligence.
              </p>
            </div>
          </div>

          <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-8 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full pointer-events-none -mr-32 -mt-32"></div>
            
            <div className="space-y-8 relative z-10">
              
              {/* STT Engine */}
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <label className="text-sm font-black text-on-surface flex items-center gap-2">
                       <span className="material-symbols-outlined text-[18px] text-tertiary">mic</span> Speech-to-Text (STT) Engine
                    </label>
                    <p className="text-xs font-medium text-on-surface-variant/70 mt-1 mb-0">Determines how voice input is transcribed.</p>
                  </div>
                </div>
                <div className="relative group w-full md:w-2/3">
                  <select 
                    className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl text-sm py-3.5 px-4 appearance-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all cursor-pointer text-on-surface outline-none"
                    value={sttProvider} onChange={(e) => setSttProvider(e.target.value)}
                  >
                    <option value="elevenlabs">ElevenLabs (Cloud - High Accuracy)</option>
                    <option value="whisper">Whisper Base (Local GPU - Latency Optimized)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none transition-transform group-focus-within:rotate-180">expand_more</span>
                </div>
              </div>

              <div className="h-px w-full bg-outline-variant/10"></div>

              {/* Translation Engine */}
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <label className="text-sm font-black text-on-surface flex items-center gap-2">
                       <span className="material-symbols-outlined text-[18px] text-primary">translate</span> Translation Engine
                    </label>
                    <p className="text-xs font-medium text-on-surface-variant/70 mt-1 mb-0">Handles the core translation between languages.</p>
                  </div>
                </div>
                <div className="relative group w-full md:w-2/3">
                  <select 
                    className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl text-sm py-3.5 px-4 appearance-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all cursor-pointer text-on-surface outline-none"
                    value={translationProvider} onChange={(e) => setTranslationProvider(e.target.value)}
                  >
                    <option value="gemini">Gemini (Cloud - Context Aware)</option>
                    <option value="nllb">Meta NLLB (Local - Offline Support)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none transition-transform group-focus-within:rotate-180">expand_more</span>
                </div>
              </div>

              <div className="h-px w-full bg-outline-variant/10"></div>

              {/* TTS Engine */}
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <label className="text-sm font-black text-on-surface flex items-center gap-2">
                       <span className="material-symbols-outlined text-[18px] text-secondary">volume_up</span> Text-to-Speech (TTS) Engine
                    </label>
                    <p className="text-xs font-medium text-on-surface-variant/70 mt-1 mb-0">Generates spoken audio from translated text.</p>
                  </div>
                </div>
                <div className="relative group w-full md:w-2/3">
                  <select 
                    className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl text-sm py-3.5 px-4 appearance-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all cursor-pointer text-on-surface outline-none"
                    value={ttsProvider} onChange={(e) => setTtsProvider(e.target.value)}
                  >
                    <option value="elevenlabs">ElevenLabs (Cloud - Ultra Realistic)</option>
                    <option value="piper">Piper (Local - Blazing Fast)</option>
                    <option value="gtts">Google TTS (Cloud - Standard)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none transition-transform group-focus-within:rotate-180">expand_more</span>
                </div>
              </div>

            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-2xl shadow-sm md:w-max self-start mt-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            <span className="text-sm font-bold text-on-surface pr-4">Your preferences are applied and saved automatically.</span>
          </div>

        </div>
      </main>
    </>
  );
}
