/**
 * UNCOVER - Local Storage Service
 * Manages research history, user preferences, and active research state.
 */

import { APP_CONFIG } from './config.js';

const STORAGE_KEYS = APP_CONFIG.storageKeys;

/**
 * Safe LocalStorage getter with JSON parsing
 */
function getItem(key, defaultValue = null) {
  try {
    if (typeof localStorage === "undefined") return defaultValue;
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[UNCOVER Storage] Error reading key "${key}":`, err);
    return defaultValue;
  }
}

/**
 * Safe LocalStorage setter with JSON serialization
 */
function setItem(key, value) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[UNCOVER Storage] Error saving key "${key}":`, err);
    return false;
  }
}

export const StorageService = {
  /**
   * Retrieve all research history items (sorted newest first)
   */
  getHistory() {
    const list = getItem(STORAGE_KEYS.history, []);
    return Array.isArray(list) ? list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
  },

  /**
   * Save or prepend a new research record to history
   */
  saveResearch(record) {
    if (!record || !record.id) {
      record = {
        id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        createdAt: new Date().toISOString(),
        ...record
      };
    }

    const history = this.getHistory();
    // Check if item already exists (update it)
    const existingIndex = history.findIndex(item => item.id === record.id);
    if (existingIndex >= 0) {
      history[existingIndex] = { ...history[existingIndex], ...record, updatedAt: new Date().toISOString() };
    } else {
      history.unshift(record);
    }

    // Limit history to last 50 items for performance
    const trimmed = history.slice(0, 50);
    setItem(STORAGE_KEYS.history, trimmed);
    return record;
  },

  /**
   * Get single research record by ID
   */
  getResearchById(id) {
    const history = this.getHistory();
    return history.find(item => item.id === id) || null;
  },

  /**
   * Delete single research record by ID
   */
  deleteResearch(id) {
    const history = this.getHistory();
    const filtered = history.filter(item => item.id !== id);
    setItem(STORAGE_KEYS.history, filtered);
    return filtered;
  },

  /**
   * Clear all research history
   */
  clearAllHistory() {
    setItem(STORAGE_KEYS.history, []);
    return [];
  },

  /**
   * Active Research State (currently investigated query or displayed dossier)
   */
  getActiveResearch() {
    return getItem(STORAGE_KEYS.activeResearch, null);
  },

  setActiveResearch(data) {
    return setItem(STORAGE_KEYS.activeResearch, data);
  },

  clearActiveResearch() {
    try {
      localStorage.removeItem(STORAGE_KEYS.activeResearch);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * User Settings & Preferences
   */
  getSettings() {
    return getItem(STORAGE_KEYS.settings, {
      demoModeDefault: true,
      depthLevel: "standard",
      autoSaveHistory: true
    });
  },

  saveSettings(newSettings) {
    const current = this.getSettings();
    const merged = { ...current, ...newSettings };
    setItem(STORAGE_KEYS.settings, merged);
    return merged;
  }
};
