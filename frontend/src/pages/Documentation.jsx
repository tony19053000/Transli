import React, { useState } from 'react';

const Section = ({ title, children, defaultOpen = true, icon_name = "menu_book" }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-surface-container-low border border-outline-variant/10 rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ${open ? 'border-primary/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)]' : 'hover:border-outline-variant/30 hover:bg-surface-container-low/80'}`}>
      <button 
        className="w-full flex items-center justify-between p-6 bg-transparent outline-none cursor-pointer" 
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">{icon_name}</span>
          <span className="text-lg font-black text-on-surface cursor-pointer">{title}</span>
        </div>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${open ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-[2500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-6 pt-0 border-t border-outline-variant/10 bg-surface-container-lowest/30">
          <div className="pt-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProviderCard = ({ name, tag, tagColor, strengths, weaknesses }) => {
  const colorMap = {
    cloud: 'bg-primary/10 text-primary border-primary/20',
    local: 'bg-secondary/10 text-secondary border-secondary/20',
    neutral: 'bg-surface-container border-outline-variant/20 text-on-surface-variant'
  };
  
  return (
    <div className="flex flex-col bg-surface-container rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden h-full">
      <div className="flex items-center justify-between p-4 border-b border-outline-variant/10 bg-gradient-to-r from-surface-container-highest/50 to-transparent">
        <span className="font-bold text-on-surface text-sm">{name}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider border ${colorMap[tagColor] || colorMap.neutral}`}>
          {tag}
        </span>
      </div>
      <div className="p-4 flex flex-col gap-4 flex-1">
        <div>
          <span className="text-[10px] font-black text-tertiary uppercase tracking-widest flex items-center gap-1.5 mb-2"><span className="material-symbols-outlined text-[14px]">check_circle</span> Strengths</span>
          <ul className="space-y-1.5 m-0 pl-1">
            {strengths.map((s, i) => <li key={i} className="text-xs text-on-surface-variant flex items-start gap-2 leading-relaxed"><span className="w-1 h-1 rounded-full bg-tertiary/50 mt-1.5 shrink-0"></span> {s}</li>)}
          </ul>
        </div>
        <div className="h-px w-full bg-outline-variant/10"></div>
        <div>
          <span className="text-[10px] font-black text-error uppercase tracking-widest flex items-center gap-1.5 mb-2"><span className="material-symbols-outlined text-[14px]">cancel</span> Limitations</span>
          <ul className="space-y-1.5 m-0 pl-1">
            {weaknesses.map((w, i) => <li key={i} className="text-xs text-on-surface-variant flex items-start gap-2 leading-relaxed"><span className="w-1 h-1 rounded-full bg-error/50 mt-1.5 shrink-0"></span> {w}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
};

const PageCard = ({ icon_name, title, description, color_class = "text-primary bg-primary/10 border-primary/20" }) => (
  <div className="flex flex-col gap-4 p-6 rounded-2xl border border-outline-variant/10 bg-surface-container-low hover:bg-surface-container-high transition-colors shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border ${color_class}`}>
        <span className="material-symbols-outlined text-[20px]">{icon_name}</span>
      </div>
      <h4 className="font-black text-on-surface text-base m-0">{title}</h4>
    </div>
    <p className="text-sm font-medium text-on-surface-variant leading-relaxed m-0">{description}</p>
  </div>
);

export default function Documentation() {
  return (
    <>
      {/* TopAppBar Shell */}
      <header className="flex justify-between items-center w-full h-16 px-8 sticky top-0 z-40 ml-64 bg-[#111318]/80 backdrop-blur-xl shadow-[0_0_32px_rgba(173,198,255,0.08)]">
        <div className="flex items-center gap-4">
          <span className="text-lg font-black text-[#E2E2E8] font-manrope">Documentation</span>
          <div className="h-4 w-[1px] bg-outline-variant/30"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full border border-outline-variant/10">
            <span className="w-2 h-2 rounded-full shadow-[0_0_8px_#ADC6FF] bg-secondary"></span>
            <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest">Guide</span>
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
        
        <div className="w-full max-w-5xl mx-auto p-8 flex flex-col gap-6 pb-24">
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-on-surface mb-2 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[28px]">book_2</span> 
                Product Guide
              </h2>
              <p className="text-sm font-medium text-on-surface-variant max-w-2xl m-0 leading-relaxed">
                How Transli works, what each page does, and how to pick the right model combination for your use case.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            
            {/* ── 1. Product Overview ───────────────────────────────────────────────── */}
            <Section title="Product Overview" icon_name="info">
              <p className="text-sm font-medium text-on-surface leading-relaxed m-0 mb-4">
                Transli is a real-time voice, text, and file translation tool. You speak in one language and hear the translation spoken back in another. It also handles written text, uploaded files, images, and audio recordings.
              </p>
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed m-0 mb-8">
                The product is built for travelers, interpreters, researchers, and anyone who needs to communicate across language barriers quickly — without copying and pasting between tools.
              </p>

              <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-6 flex flex-wrap items-center justify-center gap-2 md:gap-4 shadow-sm relative overflow-hidden mb-6">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[40px] rounded-full pointer-events-none -mr-16 -mt-16"></div>
                
                <div className="flex flex-col items-center gap-2 relative z-10 w-24">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center text-on-surface-variant shadow-sm"><span className="material-symbols-outlined">mic</span></div>
                  <span className="text-xs font-bold text-on-surface text-center">Input</span>
                  <span className="text-[10px] text-on-surface-variant/70 text-center uppercase tracking-widest font-bold">Voice/Text</span>
                </div>
                <div className="text-on-surface-variant/30 hidden md:block"><span className="material-symbols-outlined">arrow_forward</span></div>
                
                <div className="flex flex-col items-center gap-2 relative z-10 w-24">
                  <div className="w-12 h-12 rounded-full bg-tertiary/10 border border-tertiary/20 flex items-center justify-center text-tertiary shadow-sm"><span className="material-symbols-outlined">graphic_eq</span></div>
                  <span className="text-xs font-bold text-on-surface text-center">STT Engine</span>
                  <span className="text-[10px] text-on-surface-variant/70 text-center uppercase tracking-widest font-bold">Transcription</span>
                </div>
                <div className="text-on-surface-variant/30 hidden md:block"><span className="material-symbols-outlined">arrow_forward</span></div>
                
                <div className="flex flex-col items-center gap-2 relative z-10 w-24">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm"><span className="material-symbols-outlined">translate</span></div>
                  <span className="text-xs font-bold text-on-surface text-center">Translation</span>
                  <span className="text-[10px] text-on-surface-variant/70 text-center uppercase tracking-widest font-bold">Core Engine</span>
                </div>
                <div className="text-on-surface-variant/30 hidden md:block"><span className="material-symbols-outlined">arrow_forward</span></div>
                
                <div className="flex flex-col items-center gap-2 relative z-10 w-24">
                  <div className="w-12 h-12 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary shadow-sm"><span className="material-symbols-outlined">record_voice_over</span></div>
                  <span className="text-xs font-bold text-on-surface text-center">TTS Engine</span>
                  <span className="text-[10px] text-on-surface-variant/70 text-center uppercase tracking-widest font-bold">Speech Gen</span>
                </div>
                <div className="text-on-surface-variant/30 hidden md:block"><span className="material-symbols-outlined">arrow_forward</span></div>
                
                <div className="flex flex-col items-center gap-2 relative z-10 w-24">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center text-on-surface-variant shadow-sm"><span className="material-symbols-outlined">volume_up</span></div>
                  <span className="text-xs font-bold text-on-surface text-center">Output</span>
                  <span className="text-[10px] text-on-surface-variant/70 text-center uppercase tracking-widest font-bold">Audio/Text</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-surface-container border border-outline-variant/10 rounded-xl p-4 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-[20px]">lightbulb</span>
                <p className="m-0 leading-relaxed font-medium">Each stage uses its own configurable engine. You can mix and match cloud and local models to suit your needs. See Settings to change your active engines.</p>
              </div>
            </Section>

            {/* ── 2. Pages Guide ───────────────────────────────────────────────────── */}
            <Section title="Pages at a Glance" icon_name="grid_view" defaultOpen={false}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PageCard
                  icon_name="bolt"
                  title="Quick Translate"
                  description="Translate a single voice recording or typed text into one or more target languages. Results are shown inline and can be played back as audio. Good for quick lookups, one-off translations, and testing your model setup."
                  color_class="text-primary bg-primary/10 border-primary/20"
                />
                <PageCard
                  icon_name="forum"
                  title="Live Conversation"
                  description="Real-time two-way interpreted conversation between two speakers. Each person speaks in their own language and hears the translation in the other's. Designed for face-to-face exchanges."
                  color_class="text-secondary bg-secondary/10 border-secondary/20"
                />
                <PageCard
                  icon_name="description"
                  title="File & Visual Translation"
                  description="Upload documents, images, or audio files. Text documents are translated directly. Images go through OCR. Audio files are transcribed and then translated. Results can be downloaded."
                  color_class="text-tertiary bg-tertiary/10 border-tertiary/20"
                />
                <PageCard
                  icon_name="history"
                  title="History & Downloads"
                  description="Browse, search, and filter all saved translations. You can re-read previous results, download translated text or audio, and clear entries you no longer need."
                  color_class="text-on-surface-variant bg-surface-container-highest border-outline-variant/20"
                />
              </div>
            </Section>

            {/* ── 3. Model & Provider Guide ─────────────────────────────────────────── */}
            <Section title="Models & Providers" icon_name="model_training" defaultOpen={false}>
              
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-tertiary text-[20px]">mic</span>
                    <h3 className="text-sm font-black text-on-surface m-0 uppercase tracking-widest">Speech-to-Text (STT)</h3>
                  </div>
                  <p className="text-sm font-medium text-on-surface-variant leading-relaxed mb-4 mt-0">
                    The STT engine converts spoken audio into text. It runs first in the pipeline. Its accuracy directly affects every downstream result — if transcription is wrong, translation will be too.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ProviderCard
                      name="ElevenLabs STT"
                      tag="Cloud"
                      tagColor="cloud"
                      strengths={[
                        'Strong accuracy on clear speech',
                        'Good performance across major languages',
                        'Handles natural punctuation and sentence breaks',
                        'Works well with standard microphone input',
                      ]}
                      weaknesses={[
                        'Requires API key and internet connection',
                        'May struggle with heavy accents or fast speech',
                        'Background noise reduces accuracy',
                      ]}
                    />
                    <ProviderCard
                      name="Whisper Base"
                      tag="Local"
                      tagColor="local"
                      strengths={[
                        'Runs entirely on your local GPU',
                        'No internet required after setup',
                        'Good for privacy-sensitive workflows',
                        'Optimized for low latency',
                      ]}
                      weaknesses={[
                        'Base model trades accuracy for speed',
                        'Less reliable on accented or noisy audio',
                        'Transcription quality depends on local hardware',
                      ]}
                    />
                  </div>
                </div>

                <div className="h-px w-full bg-outline-variant/10"></div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">translate</span>
                    <h3 className="text-sm font-black text-on-surface m-0 uppercase tracking-widest">Translation Engine</h3>
                  </div>
                  <p className="text-sm font-medium text-on-surface-variant leading-relaxed mb-4 mt-0">
                    The translation engine takes the transcribed (or typed) text and produces the equivalent in the target language. Quality varies significantly between providers, especially for complex or idiomatic sentences.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ProviderCard
                      name="Gemini"
                      tag="Cloud"
                      tagColor="cloud"
                      strengths={[
                        'Context-aware, natural-sounding output',
                        'Handles idioms, slang, and long sentences well',
                        'Best overall quality for everyday translation',
                        'Better at preserving meaning across complex text',
                      ]}
                      weaknesses={[
                        'Requires Gemini API key and internet',
                        'Not suitable for fully offline use',
                        'Output fluency varies by language pair',
                      ]}
                    />
                    <ProviderCard
                      name="Meta NLLB"
                      tag="Local"
                      tagColor="local"
                      strengths={[
                        'Supports 200+ languages including less common ones',
                        'Runs fully offline after setup',
                        'Open source model, no API key needed',
                        'Consistent performance across supported languages',
                      ]}
                      weaknesses={[
                        'Less fluent output on complex or idiomatic sentences',
                        'Sentence-level model — loses document context',
                        'Quality gap vs. cloud on nuanced text',
                      ]}
                    />
                  </div>
                </div>

                <div className="h-px w-full bg-outline-variant/10"></div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">volume_up</span>
                    <h3 className="text-sm font-black text-on-surface m-0 uppercase tracking-widest">Text-to-Speech (TTS)</h3>
                  </div>
                  <p className="text-sm font-medium text-on-surface-variant leading-relaxed mb-4 mt-0">
                    The TTS engine converts translated text into spoken audio. TTS quality is considered acceptable across all options — the larger quality differences come from STT and translation. ElevenLabs is the default and strongest option.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ProviderCard
                      name="ElevenLabs TTS"
                      tag="Cloud"
                      tagColor="cloud"
                      strengths={[
                        'High-quality, realistic voice output',
                        'Natural prosody and intonation',
                        'Best listening experience',
                      ]}
                      weaknesses={[
                        'Requires API key and internet',
                        'Slightly slower to start on first call',
                      ]}
                    />
                    <ProviderCard
                      name="Piper"
                      tag="Local"
                      tagColor="local"
                      strengths={[
                        'Very fast — minimal latency',
                        'Fully offline after setup',
                        'Good for low-friction local use',
                      ]}
                      weaknesses={[
                        'Less natural sounding than cloud alternatives',
                        'Limited voice expressiveness',
                      ]}
                    />
                    <ProviderCard
                      name="Google TTS"
                      tag="Cloud"
                      tagColor="cloud"
                      strengths={[
                        'Standard quality, wide language coverage',
                        'Reliable across most languages',
                        'No premium API key required',
                      ]}
                      weaknesses={[
                        'Less expressive than ElevenLabs',
                        'Requires internet connection',
                      ]}
                    />
                  </div>
                </div>

              </div>
            </Section>

            {/* ── 4. Best Combination Guide ─────────────────────────────────────────── */}
            <Section title="Combination Guide" icon_name="tune" defaultOpen={false}>
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed mb-6 mt-0">
                The right setup depends on what you prioritize. Below are honest recommendations based on how the engines actually perform — no invented benchmarks.
              </p>
              <div className="overflow-x-auto rounded-xl border border-outline-variant/10 shadow-sm custom-scrollbar">
                <table className="w-full text-left border-collapse text-sm min-w-[800px]">
                  <thead className="bg-surface-container-highest/50">
                    <tr>
                      <th className="py-3 px-4 font-black uppercase tracking-widest text-[10px] text-on-surface-variant border-b border-outline-variant/10">Goal</th>
                      <th className="py-3 px-4 font-black uppercase tracking-widest text-[10px] text-on-surface-variant border-b border-outline-variant/10">STT</th>
                      <th className="py-3 px-4 font-black uppercase tracking-widest text-[10px] text-on-surface-variant border-b border-outline-variant/10">Translation</th>
                      <th className="py-3 px-4 font-black uppercase tracking-widest text-[10px] text-on-surface-variant border-b border-outline-variant/10">TTS</th>
                      <th className="py-3 px-4 font-black uppercase tracking-widest text-[10px] text-on-surface-variant border-b border-outline-variant/10 w-1/3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface-container-low divide-y divide-outline-variant/10">
                    <tr className="hover:bg-surface-container-highest/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-on-surface">Best overall quality</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20">ElevenLabs</span></td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20">Gemini</span></td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20">ElevenLabs</span></td>
                      <td className="py-3 px-4 text-on-surface-variant/80 text-xs font-medium">All cloud. Best results for most everyday use. Requires API keys.</td>
                    </tr>
                    <tr className="hover:bg-surface-container-highest/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-on-surface">Fastest (all-local)</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-secondary bg-secondary/10 border border-secondary/20">Whisper</span></td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-secondary bg-secondary/10 border border-secondary/20">NLLB</span></td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-secondary bg-secondary/10 border border-secondary/20">Piper</span></td>
                      <td className="py-3 px-4 text-on-surface-variant/80 text-xs font-medium">All local. Lowest latency. Quality trade-off on complex speech.</td>
                    </tr>
                    <tr className="hover:bg-surface-container-highest/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-on-surface">Wide multilingual</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20">ElevenLabs</span></td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-secondary bg-secondary/10 border border-secondary/20">NLLB</span></td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20">ElevenLabs</span></td>
                      <td className="py-3 px-4 text-on-surface-variant/80 text-xs font-medium">NLLB supports 200+ languages. Use when Gemini doesn't cover your pair.</td>
                    </tr>
                    <tr className="hover:bg-surface-container-highest/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-on-surface">File translation</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-on-surface-variant bg-surface-container border border-outline-variant/20">Any</span></td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20">Gemini</span></td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20">ElevenLabs</span></td>
                      <td className="py-3 px-4 text-on-surface-variant/80 text-xs font-medium">Gemini handles longer text and document context better than NLLB.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* ── 5. Limitations ───────────────────────────────────────────────────── */}
            <Section title="Current Limitations" icon_name="warning" defaultOpen={false}>
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed mb-6 mt-0">
                These are honest, practical limitations based on how the product and underlying models actually work.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: 'STT accuracy depends on audio quality',
                    body: 'Both Whisper and ElevenLabs perform best on clear, quiet audio. Heavy accents, fast speech, or background noise will reduce transcription quality — and errors carry forward.',
                  },
                  {
                    title: 'Whisper Base trades accuracy for speed',
                    body: 'The Base variant of Whisper is deliberately smaller to reduce latency. It is not as accurate as larger models or cloud alternatives.',
                  },
                  {
                    title: 'NLLB focuses on sentence-level translation',
                    body: 'NLLB works well for straightforward content but can produce awkward output on idioms or long technical text without broader document context.',
                  },
                  {
                    title: 'Cloud engines require reliable internet',
                    body: 'ElevenLabs STT, Gemini, and Google TTS require valid API keys and an active internet connection to function.',
                  },
                  {
                    title: 'OCR depends on image clarity',
                    body: 'File & Visual Translation uses OCR to extract text from images. Blurry images or unusual fonts will reduce extraction quality.',
                  },
                  {
                    title: 'Transli works best in quiet environments',
                    body: 'The two-speaker live interpretation mode relies on clean turn-based audio input. Overlapping speech will reduce accuracy.',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-4 rounded-xl border border-warning/20 bg-warning/5">
                    <span className="material-symbols-outlined text-warning mt-0.5 text-[20px]">priority_high</span>
                    <div>
                      <div className="text-sm font-bold text-on-surface mb-1">{item.title}</div>
                      <div className="text-xs text-on-surface-variant/90 leading-relaxed font-medium">{item.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── 6. Quick Decision Guide ──────────────────────────────────────────── */}
            <Section title="Quick Decision Guide" icon_name="check_circle" defaultOpen={false}>
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed mb-6 mt-0">
                Answer one question and go to Settings to apply the matching configuration.
              </p>
              <div className="space-y-3">
                {[
                  {
                    q: 'I want the best results for everyday use',
                    a: 'ElevenLabs STT + Gemini + ElevenLabs TTS',
                    type: 'bg-primary/5 border-primary/20 text-primary',
                  },
                  {
                    q: 'I need to work completely offline',
                    a: 'Whisper STT + NLLB + Piper TTS',
                    type: 'bg-secondary/5 border-secondary/20 text-secondary',
                  },
                  {
                    q: 'I need to translate between unusual language pairs',
                    a: 'ElevenLabs STT + NLLB + ElevenLabs TTS',
                    type: 'bg-primary/5 border-primary/20 text-primary',
                  },
                  {
                    q: 'I want a reliable, balanced setup without tuning anything',
                    a: 'ElevenLabs STT + Gemini + Google TTS',
                    type: 'bg-primary/5 border-primary/20 text-primary',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-outline-variant/10 bg-surface-container hover:bg-surface-container-high transition-colors">
                    <div className="text-sm font-bold text-on-surface">{item.q}</div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${item.type} text-xs font-black uppercase tracking-widest`}>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      <span>{item.a}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-start gap-3 bg-surface-container-high rounded-xl p-4 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">info</span>
                <p className="m-0 leading-relaxed font-medium">Open <strong>Settings</strong> to change your active engines. Preferences apply immediately to all pages.</p>
              </div>
            </Section>

          </div>

        </div>
      </main>
    </>
  );
}
