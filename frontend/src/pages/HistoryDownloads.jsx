import React, { useState, useEffect } from 'react';
import {
  formatType, getPreviewText, exportItemAsTxt, exportItemAsJson, triggerDownload
} from '../utils/historyStorage';
import { getLanguageName as langName } from '../config/languages';

// ── Constants ──────────────────────────────────────────────────────────
const TYPE_FILTERS = [
  { key: 'all',               label: 'All' },
  { key: 'quick_translate',   label: 'Quick Translate' },
  { key: 'live_conversation', label: 'Live Conversation' },
  { key: 'file_translation',  label: 'File & Visual' },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
];

const BROWSE_DRAFT_KEY = 'ai_translator_hist_browse_v1';

// ── Draft persistence for browse state ────────────────────────────────
const loadBrowseDraft = () => {
  try { return JSON.parse(localStorage.getItem(BROWSE_DRAFT_KEY) || '{}'); } catch (_) { return {}; }
};
const saveBrowseDraft = (data) => {
  try { localStorage.setItem(BROWSE_DRAFT_KEY, JSON.stringify(data)); } catch (_) {}
};

// ── Safe field access helpers ──────────────────────────────────────────
const safeLang = (code) => {
  try { return code ? langName(code) : '—'; } catch (_) { return code || '—'; }
};

const safeDate = (ts) => {
  try { return ts ? new Date(ts).toLocaleString() : 'Unknown date'; } catch (_) { return 'Unknown date'; }
};

const typeBadgeClass = (type) => ({
  quick_translate:   'badge-quick',
  live_conversation: 'badge-live',
  file_translation:  'badge-file',
}[type] || 'badge-quick');

// ─────────────────────────────────────────────────────────────────────
export default function HistoryDownloads({ history, onDeleteItem, onClearAll }) {
  // ── Load browse state from draft ─────────────────────────────────
  const [initialDraft] = useState(() => loadBrowseDraft());

  const [activeFilter,      setActiveFilter]      = useState(initialDraft.activeFilter      || 'all');
  const [searchQuery,       setSearchQuery]        = useState(initialDraft.searchQuery       || '');
  const [sortMode,          setSortMode]           = useState(initialDraft.sortMode          || 'newest');
  const [expandedId,        setExpandedId]         = useState(initialDraft.expandedId        || null);
  const [showClearConfirm,  setShowClearConfirm]   = useState(false);
  const [deleteConfirmId,   setDeleteConfirmId]    = useState(null);
  const [copiedId,          setCopiedId]           = useState(null);

  // ── Persist browse state ──────────────────────────────────────────
  useEffect(() => {
    saveBrowseDraft({ activeFilter, searchQuery, sortMode, expandedId });
  }, [activeFilter, searchQuery, sortMode, expandedId]);

  // ── Filter + Search + Sort ────────────────────────────────────────
  const filtered = history
    .filter((item) => {
      if (activeFilter !== 'all' && item.type !== activeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const haystack = [
          item.originalText, item.translatedText, item.fileName,
          ...(Array.isArray(item.turns)
            ? item.turns.map(t => `${t.transcript || ''} ${t.translation || ''}`)
            : []),
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return sortMode === 'newest' ? tB - tA : tA - tB;
    });

  // ── Actions ───────────────────────────────────────────────────────
  const handleExportTxt = (item) => {
    const content = exportItemAsTxt(item);
    const slug = (item.type === 'file_translation' ? (item.fileName || 'file') : item.type)
      .replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
    triggerDownload(content, `${slug}_${Date.now()}.txt`, 'text/plain');
  };

  const handleExportJson = (item) => {
    const content = exportItemAsJson(item);
    const slug = (item.type === 'file_translation' ? (item.fileName || 'file') : item.type)
      .replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
    triggerDownload(content, `${slug}_${Date.now()}.json`, 'application/json');
  };

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  };

  const confirmDelete = (id) => {
    onDeleteItem(id);
    setDeleteConfirmId(null);
    if (expandedId === id) setExpandedId(null);
  };

  const confirmClearAll = () => {
    onClearAll();
    setShowClearConfirm(false);
    setExpandedId(null);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
    setDeleteConfirmId(null);
  };

  const resetFilters = () => {
    setActiveFilter('all');
    setSearchQuery('');
    setSortMode('newest');
  };

  const filtersActive = activeFilter !== 'all' || searchQuery.trim() || sortMode !== 'newest';

  // ─────────────────────────────────────────────────────────────────
  // ── RENDER
  return (
    <>
      {/* TopAppBar Shell */}
      <header className="flex justify-between items-center w-full h-16 px-8 sticky top-0 z-40 ml-64 bg-[#111318]/80 backdrop-blur-xl shadow-[0_0_32px_rgba(173,198,255,0.08)]">
        <div className="flex items-center gap-4">
          <span className="text-lg font-black text-[#E2E2E8] font-manrope">History & Downloads</span>
          <div className="h-4 w-[1px] bg-outline-variant/30"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full">
            <span className="w-2 h-2 rounded-full shadow-[0_0_8px_#ADC6FF] bg-secondary"></span>
            <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest">{history.length} Saved</span>
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
          
          <div className="flex items-center justify-between bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] rounded-full -mr-16 -mt-16 pointer-events-none"></div>
            <div>
              <h2 className="text-xl font-black text-on-surface mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span> Memory & Archives
              </h2>
              <p className="text-sm font-medium text-on-surface-variant text-balance m-0">
                {filtered.length === history.length
                  ? `You have ${history.length} total saved items`
                  : `Showing ${filtered.length} of ${history.length} items`}
              </p>
            </div>
            
            <div className="relative group w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
              <input
                type="text"
                className="w-full bg-surface-container-high border border-outline-variant/20 rounded-full text-sm py-2.5 pl-10 pr-10 focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all text-on-surface outline-none placeholder:text-on-surface-variant/50"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                  onClick={() => setSearchQuery('')}
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>

          {showClearConfirm && (
            <div className="bg-error-container/20 border border-error/50 p-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-error">warning</span>
                <p className="text-error font-medium flex-1 m-0 text-sm">Delete all {history.length} history items? This cannot be undone.</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-4 py-1.5 rounded-lg text-xs font-bold bg-error text-error-container hover:bg-error/90 transition-colors shadow-sm" onClick={confirmClearAll}>Confirm Delete All</button>
                <button className="px-4 py-1.5 rounded-lg text-xs font-bold bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${activeFilter === f.key ? 'bg-primary/10 border-primary/30 text-primary shadow-sm' : 'bg-surface-container border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                onClick={() => setActiveFilter(f.key)}
              >
                {activeFilter === f.key && <span className="w-1.5 h-1.5 rounded-full bg-primary drop-shadow-[0_0_4px_#ADC6FF]"></span>}
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-4 border border-outline-variant/10 shadow-inner">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">history</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface m-0 mb-1">
                  {history.length === 0 ? 'No History Yet' : 'No Results Found'}
                </h3>
                <p className="text-sm text-on-surface-variant m-0 max-w-sm">
                  {history.length === 0
                    ? 'Translations from all interfaces will appear here automatically.'
                    : 'Try adjusting your search query or removing filters to see more results.'}
                </p>
                {filtersActive && (
                  <button className="mt-6 px-6 py-2 rounded-full border border-outline-variant/20 text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2" onClick={resetFilters}>
                    <span className="material-symbols-outlined text-[14px]">refresh</span> Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className={`bg-surface-container-low border border-outline-variant/10 rounded-2xl overflow-hidden transition-all duration-300 shrink-0 ${expandedId === item.id ? 'shadow-[0_8px_32px_rgba(0,0,0,0.15)] border-primary/20 bg-surface-container/80' : 'hover:border-outline-variant/30 hover:bg-surface-container-high/50'}`}>
                  
                  <div 
                    className="p-5 flex items-center justify-between cursor-pointer group" 
                    onClick={() => toggleExpand(item.id)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${item.type === 'live_conversation' ? 'bg-secondary/10 text-secondary border-secondary/20 group-hover:bg-secondary/20' : item.type === 'file_translation' ? 'bg-tertiary/10 text-tertiary border-tertiary/20 group-hover:bg-tertiary/20' : 'bg-primary/10 text-primary border-primary/20 group-hover:bg-primary/20'} transition-colors`}>
                        <span className="material-symbols-outlined">
                          {item.type === 'live_conversation' ? 'forum' : item.type === 'file_translation' ? 'description' : 'bolt'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1 bg-surface-container-high px-2 py-0.5 rounded-sm">
                            {formatType(item.type)}
                          </span>
                          <span className="text-[10px] font-medium text-on-surface-variant/70 whitespace-nowrap">
                            {safeDate(item.timestamp)}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-on-surface truncate flex items-center gap-2">
                          <span className="opacity-80">{safeLang(item.sourceLang)}</span>
                          <span className="material-symbols-outlined text-[14px] text-primary/50">arrow_forward</span>
                          <span>{safeLang(item.targetLang)}</span>
                          
                          {item.type === 'file_translation' && item.fileName && (
                            <span className="ml-2 font-medium text-on-surface-variant/80 truncate px-2 py-0.5 bg-surface-container-highest rounded border border-outline-variant/10 text-xs flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">attachment</span> {item.fileName}
                            </span>
                          )}
                          {item.type === 'live_conversation' && Array.isArray(item.turns) && (
                            <span className="ml-2 font-medium text-on-surface-variant/80 px-2 py-0.5 bg-surface-container-highest rounded border border-outline-variant/10 text-xs flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">chat</span> {item.turns.length} turns
                            </span>
                          )}
                        </div>
                        {expandedId !== item.id && (
                          <p className="text-xs text-on-surface-variant truncate m-0">
                            {getPreviewText(item, 100)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors" onClick={() => handleExportTxt(item)} title="Export TXT">
                          <span className="material-symbols-outlined text-[16px]">text_snippet</span>
                        </button>
                        <button className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors" onClick={() => handleExportJson(item)} title="Export JSON">
                          <span className="material-symbols-outlined text-[16px]">data_object</span>
                        </button>
                        
                        {deleteConfirmId === item.id ? (
                          <div className="flex items-center bg-error-container/20 border border-error/50 rounded-full h-8 px-2 ml-1 animate-in fade-in zoom-in-95">
                            <span className="text-[10px] font-bold text-error mr-1">Delete?</span>
                            <button className="w-6 h-6 rounded-full flex items-center justify-center text-error hover:bg-error/20 transition-colors" onClick={() => confirmDelete(item.id)}>
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            </button>
                            <button className="w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors" onClick={() => setDeleteConfirmId(null)}>
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          </div>
                        ) : (
                          <button className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors" onClick={() => setDeleteConfirmId(item.id)} title="Delete item">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </div>
                      <div className="w-8 h-8 flex items-center justify-center text-on-surface-variant/50 group-hover:text-primary transition-colors ml-2">
                        <span className={`material-symbols-outlined transform transition-transform duration-300 ${expandedId === item.id ? 'rotate-180' : ''}`}>expand_more</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedId === item.id ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-5 pt-0 border-t border-outline-variant/10 bg-surface-container-lowest/30">
                      
                      <div className="flex flex-wrap items-center gap-3 py-3 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">
                         {item.sttModel && <span className="bg-surface-container px-2 py-0.5 rounded border border-outline-variant/10">STT: {item.sttModel}</span>}
                         {item.translationModel && <span className="bg-surface-container px-2 py-0.5 rounded border border-outline-variant/10">Engine: {item.translationModel}</span>}
                         {item.ttsModel && <span className="bg-surface-container px-2 py-0.5 rounded border border-outline-variant/10">TTS: {item.ttsModel}</span>}
                      </div>

                      {/* Content Layout Based on Type */}
                      {item.type === 'live_conversation' && Array.isArray(item.turns) ? (
                        <div className="space-y-4 mt-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                           {item.summary && (
                             <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 relative overflow-hidden">
                               <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-[30px] rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                               <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">summarize</span> Session Summary</h4>
                               <p className="text-sm text-on-surface m-0 leading-relaxed font-medium relative z-10">{item.summary}</p>
                             </div>
                           )}
                           {item.turns.map((turn, i) => (
                             <div key={i} className={`flex flex-col gap-2 p-4 rounded-xl border ${turn.speaker === 1 ? 'bg-primary/5 border-primary/10 relative ml-8' : 'bg-surface-container border-outline-variant/10 relative mr-8'}`}>
                               <div className="flex items-center justify-between opacity-60 mb-1">
                                 <span className="text-[10px] font-black uppercase tracking-widest">{turn.speaker === 1 ? 'Speaker 1' : 'Speaker 2'}</span>
                                 <span className="text-[10px]">{turn.timestamp || ''}</span>
                               </div>
                               <div className="space-y-1.5">
                                  <p className="text-sm m-0"><strong className="text-on-surface-variant/70 text-xs mr-2">{safeLang(turn.sourceTag)}:</strong> <span className="text-on-surface font-medium">{turn.transcript}</span></p>
                                  <p className="text-sm m-0"><strong className="text-on-surface-variant/70 text-xs mr-2">{safeLang(turn.targetTag)}:</strong> <span className="text-primary font-medium">{turn.translation}</span></p>
                               </div>
                             </div>
                           ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="bg-surface-container rounded-xl border border-outline-variant/10 flex flex-col">
                            <div className="flex items-center justify-between border-b border-outline-variant/10 px-4 py-2 bg-gradient-to-r from-surface-container-highest/50 to-transparent">
                              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Original ({safeLang(item.sourceLang)})</span>
                              <button className="text-[10px] font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" onClick={() => handleCopy(item.originalText, `orig-${item.id}`)}>
                                <span className="material-symbols-outlined text-[12px]">{copiedId === `orig-${item.id}` ? 'check' : 'content_copy'}</span> {copiedId === `orig-${item.id}` ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <div className="p-4 text-sm font-medium text-on-surface leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                              {item.originalText}
                            </div>
                          </div>
                          
                          <div className="bg-surface-container rounded-xl border border-outline-variant/10 flex flex-col">
                            <div className="flex items-center justify-between border-b border-outline-variant/10 px-4 py-2 bg-gradient-to-r from-surface-container-highest/50 to-transparent">
                              <span className="text-[10px] font-black uppercase tracking-widest text-[#ADC6FF]">Translated ({safeLang(item.targetLang)})</span>
                              <button className="text-[10px] font-bold text-on-surface-variant hover:text-[#ADC6FF] transition-colors flex items-center gap-1" onClick={() => handleCopy(item.translatedText, `trans-${item.id}`)}>
                                <span className="material-symbols-outlined text-[12px]">{copiedId === `trans-${item.id}` ? 'check' : 'content_copy'}</span> {copiedId === `trans-${item.id}` ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <div className="p-4 text-sm font-medium text-on-surface leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                              {item.translatedText}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="w-80 border-l border-outline-variant/15 bg-surface-container-lowest p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar shadow-[-10px_0_30px_rgba(0,0,0,0.2)] z-10">
          
          <div className="space-y-6">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">tune</span>
              Browse Controls
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2 relative">
                <label className="text-[10px] text-on-surface-variant/70 font-semibold ml-1">Sort Order</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-surface-container-high border border-transparent rounded-xl text-sm py-3 px-4 appearance-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all cursor-pointer text-on-surface outline-none"
                    value={sortMode} onChange={e => setSortMode(e.target.value)}
                  >
                    {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none transition-transform group-focus-within:rotate-180">expand_more</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-outline-variant/10">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">filter_list</span>
              Quick Filters
            </h3>
            
            <div className="flex flex-col gap-2">
              {TYPE_FILTERS.map(f => {
                const count = f.key === 'all' ? history.length : history.filter(h => h.type === f.key).length;
                return (
                  <button
                    key={f.key}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${activeFilter === f.key ? 'bg-primary/10 border-primary/30 text-primary shadow-sm' : 'bg-surface-container-highest border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface hover:border-outline-variant/20'}`}
                    onClick={() => setActiveFilter(f.key)}
                  >
                    <div className="flex items-center gap-2">
                      {f.key === 'all' ? <span className="material-symbols-outlined text-[16px]">apps</span> : 
                       f.key === 'quick_translate' ? <span className="material-symbols-outlined text-[16px] text-primary">bolt</span> :
                       f.key === 'live_conversation' ? <span className="material-symbols-outlined text-[16px] text-secondary">forum</span> :
                       <span className="material-symbols-outlined text-[16px] text-tertiary">description</span>}
                      {f.label}
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] ${activeFilter === f.key ? 'bg-primary/20 text-on-primary-container' : 'bg-surface-container-low text-on-surface-variant'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-outline-variant/10 mt-auto">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">analytics</span>
              Summary
            </h3>
            
            <div className="bg-surface-container rounded-xl p-4 border border-outline-variant/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-on-surface-variant">Total Records</span>
                <span className="text-sm font-black text-on-surface">{history.length}</span>
              </div>
              
              <div className="h-px w-full bg-outline-variant/10"></div>
              
              <div className="grid grid-cols-2 gap-2">
                 {(['quick_translate', 'live_conversation', 'file_translation']).map(t => {
                   const count = history.filter(h => h.type === t).length;
                   if (count === 0) return null;
                   return (
                     <div key={t} className="flex flex-col bg-surface-container-highest p-2 rounded-lg">
                       <span className="text-[9px] font-bold uppercase text-on-surface-variant truncate">{formatType(t)}</span>
                       <span className="text-xs font-black text-primary">{count}</span>
                     </div>
                   );
                 })}
              </div>
            </div>
            
            <button 
              className={`w-full py-3 px-4 ${!filtersActive ? 'opacity-50 cursor-not-allowed bg-surface-container border border-outline-variant/10' : 'bg-surface-container-highest border border-outline-variant/20 hover:border-primary/40 hover:text-primary'} text-on-surface-variant font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-2`}
              onClick={resetFilters} disabled={!filtersActive}
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span> Reset All Filters
            </button>
            
            {history.length > 0 && (
              <button 
                className="w-full py-3 px-4 bg-error-container/20 text-error border border-error/20 hover:bg-error/10 hover:border-error/40 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                onClick={() => setShowClearConfirm(true)}
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span> Delete All History
              </button>
            )}
          </div>
        </aside>
      </main>
    </>
  );
}
