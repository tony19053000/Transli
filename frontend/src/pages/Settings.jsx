import React, { useState, useRef, useEffect } from 'react';

const CustomSelect = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        className={`w-full flex items-center justify-between bg-surface-container-high border ${isOpen ? 'border-primary/50 ring-1 ring-primary/30 shadow-[0_0_16px_rgba(173,198,255,0.1)]' : 'border-outline-variant/20 hover:border-outline-variant/40 hover:bg-surface-container-highest'} rounded-xl text-sm py-3 px-4 text-on-surface transition-all outline-none`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate pr-4 font-medium text-[13px]">{selectedOption?.label}</span>
        <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : ''}`}>
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-surface-container-high/95 backdrop-blur-xl border border-outline-variant/20 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col p-2 gap-1 relative z-10">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all flex items-center justify-between group ${value === opt.value ? 'bg-primary/20 text-primary font-bold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span className="truncate">{opt.label}</span>
                {value === opt.value && (
                  <span className="material-symbols-outlined text-[18px]">check</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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
      <main className="ml-64 h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
        
        <div className="w-full max-w-4xl mx-auto p-8 flex flex-col gap-6 pb-16">
          
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

          <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-8 relative shadow-sm">
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full -mr-32 -mt-32"></div>
            </div>
            
            <div className="flex flex-col relative z-10 divide-y divide-outline-variant/10">
              
              {/* STT Engine */}
              <div className="flex flex-col gap-2 pb-5 border-outline-variant/10">
                <div className="flex items-start justify-between">
                  <div>
                    <label className="text-sm font-black text-on-surface flex items-center gap-2">
                       <span className="material-symbols-outlined text-[18px] text-tertiary">mic</span> Speech-to-Text (STT) Engine
                    </label>
                    <p className="text-xs font-medium text-on-surface-variant/70 mt-1 mb-0">Determines how voice input is transcribed.</p>
                  </div>
                </div>
                <div className="w-full">
                  <CustomSelect 
                    value={sttProvider}
                    onChange={setSttProvider}
                    options={[
                      { value: 'elevenlabs', label: 'ElevenLabs (Cloud - High Accuracy)' },
                      { value: 'whisper', label: 'Whisper Base (Local GPU - Latency Optimized)' }
                    ]}
                  />
                </div>
              </div>

              {/* Translation Engine */}
              <div className="flex flex-col gap-2 py-5 border-outline-variant/10">
                <div className="flex items-start justify-between">
                  <div>
                    <label className="text-sm font-black text-on-surface flex items-center gap-2">
                       <span className="material-symbols-outlined text-[18px] text-primary">translate</span> Translation Engine
                    </label>
                    <p className="text-xs font-medium text-on-surface-variant/70 mt-1 mb-0">Handles the core translation between languages.</p>
                  </div>
                </div>
                <div className="w-full">
                  <CustomSelect 
                    value={translationProvider}
                    onChange={setTranslationProvider}
                    options={[
                      { value: 'gemini', label: 'Gemini (Cloud - Context Aware)' },
                      { value: 'nllb', label: 'Meta NLLB (Local - Offline Support)' }
                    ]}
                  />
                </div>
              </div>

              {/* TTS Engine */}
              <div className="flex flex-col gap-2 pt-5 border-outline-variant/10">
                <div className="flex items-start justify-between">
                  <div>
                    <label className="text-sm font-black text-on-surface flex items-center gap-2">
                       <span className="material-symbols-outlined text-[18px] text-secondary">volume_up</span> Text-to-Speech (TTS) Engine
                    </label>
                    <p className="text-xs font-medium text-on-surface-variant/70 mt-1 mb-0">Generates spoken audio from translated text.</p>
                  </div>
                </div>
                <div className="w-full">
                  <CustomSelect 
                    value={ttsProvider}
                    onChange={setTtsProvider}
                    options={[
                      { value: 'elevenlabs', label: 'ElevenLabs (Cloud - Ultra Realistic)' },
                      { value: 'piper', label: 'Piper (Local - Blazing Fast)' },
                      { value: 'gtts', label: 'Google TTS (Cloud - Standard)' }
                    ]}
                  />
                </div>
              </div>

            </div>
          </div>

          <div className="flex items-center justify-center w-full gap-3 p-4 bg-primary/10 border border-primary/20 rounded-2xl shadow-sm mt-3">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            <span className="text-sm font-bold text-on-surface">Your preferences are applied and saved automatically.</span>
          </div>

        </div>
      </main>
    </>
  );
}
