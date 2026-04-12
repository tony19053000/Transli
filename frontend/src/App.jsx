import { useState, useEffect } from 'react';
import './App.css';

// Components
import Sidebar from './components/Sidebar';

// Pages
import QuickTranslate from './pages/QuickTranslate';
import LiveConversation from './pages/LiveConversation';
import FileTranslation from './pages/FileTranslation';
import HistoryDownloads from './pages/HistoryDownloads';
import Settings from './pages/Settings';
import Documentation from './pages/Documentation';

// Persistence
import {
  loadHistory,
  saveHistoryItem,
  updateHistoryItem,
  deleteHistoryItem,
  clearAllHistory,
} from './utils/historyStorage';

export default function App() {
  // Global Navigation State
  const [activePage, setActivePage] = useState('quick');
  
  // Global Translation Settings State (Providers only)
  const [sttProvider, setSttProvider] = useState('elevenlabs');
  const [translationProvider, setTranslationProvider] = useState('gemini'); // Best default for intelligence features
  const [ttsProvider, setTtsProvider] = useState('elevenlabs');
  
  // Persistent History State — loaded from localStorage on mount
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);


  // ── History handlers ──────────────────────────────────────────────────────

  const handleSaveHistory = (entry) => {
    // Minimal data plumbing fix: capture TTS model with the entry
    const entryWithTts = { ...entry };
    if (!entryWithTts.ttsModel && ttsProvider) {
      entryWithTts.ttsModel = ttsProvider;
    }
    const updated = saveHistoryItem(entryWithTts);
    setHistory(updated);
    return updated[0]; // return the saved entry (with id)
  };

  const handleUpdateHistory = (id, updates) => {
    const updated = updateHistoryItem(id, updates);
    setHistory(updated);
  };

  const handleDeleteHistory = (id) => {
    const updated = deleteHistoryItem(id);
    setHistory(updated);
  };

  const handleClearHistory = () => {
    const updated = clearAllHistory();
    setHistory(updated);
  };

  // ── Routing ───────────────────────────────────────────────────────────────

  const renderPage = () => {
    switch (activePage) {
      case 'quick':
        return (
          <QuickTranslate 
            sttProvider={sttProvider} 
            translationProvider={translationProvider}
            ttsProvider={ttsProvider}
            onSaveHistory={handleSaveHistory}
          />
        );
      case 'live':
        return (
          <LiveConversation 
            sttProvider={sttProvider}
            translationProvider={translationProvider}
            ttsProvider={ttsProvider}
            onSaveHistory={handleSaveHistory}
            onUpdateHistory={handleUpdateHistory}
          />
        );
      case 'file':
        return (
          <FileTranslation
            sttProvider={sttProvider}
            translationProvider={translationProvider}
            ttsProvider={ttsProvider}
            onSaveHistory={handleSaveHistory}
          />
        );
      case 'history':
        return (
          <HistoryDownloads
            history={history}
            onDeleteItem={handleDeleteHistory}
            onClearAll={handleClearHistory}
          />
        );

      case 'settings':
        return (
          <Settings
            sttProvider={sttProvider} setSttProvider={setSttProvider}
            translationProvider={translationProvider} setTranslationProvider={setTranslationProvider}
            ttsProvider={ttsProvider} setTtsProvider={setTtsProvider}
          />
        );
      case 'documentation':
        return <Documentation />;
      default:
        return <QuickTranslate />;
    }
  };

  return (
    <div className="bg-background text-on-surface font-body selection:bg-primary/30 h-screen overflow-hidden">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      {renderPage()}
    </div>
  );
}
