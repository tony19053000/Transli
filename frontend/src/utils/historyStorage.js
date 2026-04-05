/**
 * History Storage Utility — Phase 8
 * 
 * Unified data model & localStorage persistence for all translation modes.
 * 
 * Entry schema:
 *   id:               string (unique, e.g. crypto.randomUUID or Date.now fallback)
 *   type:             'quick_translate' | 'live_conversation' | 'file_translation'
 *   timestamp:        string (ISO 8601)
 *   sourceLang:       string
 *   targetLang:       string
 *   sttModel:         string
 *   translationModel: string
 *   originalText:     string
 *   translatedText:   string
 *
 *   // Live Conversation only
 *   turns:            Array<{ speaker, sourceTag, targetTag, transcript, translation, timestamp }>
 *
 *   // File Translation only
 *   fileName:         string
 *   fileType:         string   ('audio' | 'text')
 */

const STORAGE_KEY = 'ai_translator_history';
const MAX_ITEMS = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isValidEntry(entry) {
  return (
    entry &&
    typeof entry === 'object' &&
    typeof entry.id === 'string' &&
    typeof entry.type === 'string' &&
    ['quick_translate', 'live_conversation', 'file_translation'].includes(entry.type)
  );
}

// ── Core CRUD ────────────────────────────────────────────────────────────────

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out any malformed entries
    return parsed.filter(isValidEntry);
  } catch (err) {
    console.warn('[HistoryStorage] Failed to load history, resetting.', err);
    return [];
  }
}

function persist(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch (err) {
    console.error('[HistoryStorage] Failed to persist history.', err);
  }
}

export function saveHistoryItem(item) {
  const entry = {
    ...item,
    id: item.id || generateId(),
    timestamp: item.timestamp || new Date().toISOString(),
  };
  const current = loadHistory();
  // Prepend new entry (newest first)
  const updated = [entry, ...current].slice(0, MAX_ITEMS);
  persist(updated);
  return updated;
}

export function updateHistoryItem(id, updates) {
  const current = loadHistory();
  const idx = current.findIndex((e) => e.id === id);
  if (idx === -1) return current;
  current[idx] = { ...current[idx], ...updates, id }; // id must never change
  persist(current);
  return [...current]; // new array ref for React
}

export function deleteHistoryItem(id) {
  const current = loadHistory();
  const updated = current.filter((e) => e.id !== id);
  persist(updated);
  return updated;
}

export function clearAllHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[HistoryStorage] Failed to clear history.', err);
  }
  return [];
}

// ── Export Generators ────────────────────────────────────────────────────────

import { getLanguageName as langName } from '../config/languages';

export function exportItemAsTxt(item) {
  const lines = [];
  const divider = '─'.repeat(50);

  lines.push('═══ AI INTERPRETER — Translation Export ═══');
  lines.push(`Type: ${formatType(item.type)}`);
  lines.push(`Date: ${new Date(item.timestamp).toLocaleString()}`);
  lines.push(`Direction: ${langName(item.sourceLang)} → ${langName(item.targetLang)}`);
  const ttsStr = item.ttsModel ? `  |  TTS Model: ${item.ttsModel}` : '';
  lines.push(`STT Model: ${item.sttModel || 'N/A'}  |  Translation Model: ${item.translationModel || 'N/A'}${ttsStr}`);
  lines.push(divider);

    if (item.type === 'live_conversation' && Array.isArray(item.turns)) {
    if (item.summary) {
      lines.push('');
      lines.push('=== SESSION SUMMARY ===');
      lines.push(item.summary);
      lines.push(divider);
    }
    
    lines.push('');
    lines.push('CONVERSATION TRANSCRIPT');
    lines.push(divider);
    item.turns.forEach((turn, i) => {
      lines.push(`[${turn.timestamp || i + 1}] Speaker ${turn.speaker}`);
      lines.push(`  Original (${langName(turn.sourceTag)}): ${turn.transcript}`);
      lines.push(`  Translated (${langName(turn.targetTag)}): ${turn.translation}`);
      lines.push('');
    });
  } else if (item.type === 'file_translation') {
    lines.push(`File: ${item.fileName || 'Unknown'} (${item.fileType || 'unknown'})`);
    lines.push('');
    lines.push(`── Original (${langName(item.sourceLang)}) ──`);
    lines.push(item.originalText || '');
    lines.push('');
    lines.push(`── Translated (${langName(item.targetLang)}) ──`);
    lines.push(item.translatedText || '');
  } else {
    // quick_translate
    lines.push('');
    lines.push(`── Original (${langName(item.sourceLang)}) ──`);
    lines.push(item.originalText || '');
    lines.push('');
    lines.push(`── Translated (${langName(item.targetLang)}) ──`);
    lines.push(item.translatedText || '');
  }

  return lines.join('\n');
}

export function exportItemAsJson(item) {
  // Return a clean copy without internal noise
  const clean = { ...item };
  return JSON.stringify(clean, null, 2);
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function formatType(type) {
  const map = {
    quick_translate: 'Quick Translate',
    live_conversation: 'Live Conversation',
    file_translation: 'File & Visual Translation',
  };
  return map[type] || type;
}

export function getPreviewText(item, maxLen = 80) {
  let text = '';
  if (item.type === 'live_conversation' && Array.isArray(item.turns) && item.turns.length > 0) {
    text = `${item.turns.length} turn(s) — "${item.turns[0].transcript}"`;
  } else if (item.type === 'file_translation') {
    text = `File: ${item.fileName || 'Unknown'}`;
  } else {
    text = item.originalText || '';
  }
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

export function triggerDownload(content, filename, mimeType = 'text/plain') {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[HistoryStorage] Download failed.', err);
  }
}
