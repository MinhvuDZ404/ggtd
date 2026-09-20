// ============================================================
// GTDM save system — IndexedDB primary, localStorage backup
// ============================================================
const DB_NAME = 'gtdm_db';
const DB_VER = 1;
const STORE = 'saves';
const LS_KEY = 'gtdm_save_v1';

let db = null;
let idbOK = false;

function openDB() {
  return new Promise(res => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = () => { db = req.result; idbOK = true; res(true); };
      req.onerror = () => { idbOK = false; res(false); };
      setTimeout(() => res(idbOK), 2500);
    } catch (e) { idbOK = false; res(false); }
  });
}

function idbPut(key, val) {
  return new Promise(res => {
    if (!db) return res(false);
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    } catch (e) { res(false); }
  });
}
function idbGet(key) {
  return new Promise(res => {
    if (!db) return res(null);
    try {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result ?? null);
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}

let saveTimer = null;
let pending = null;

export async function initSave() { await openDB(); }

export async function loadGame() {
  let data = null;
  if (idbOK) data = await idbGet('main');
  if (!data) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) { }
  }
  // If IDB was broken but LS had data, restore IDB copy
  if (data && idbOK) idbPut('main', data);
  return data;
}

export function saveGame(state) {
  pending = state;
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    const s = pending; if (!s) return;
    const snapshot = { v: 1, ts: Date.now(), data: s };
    try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot)); } catch (e) { }
    if (idbOK) await idbPut('main', snapshot);
  }, 350);
}

export function saveImmediate(state) {
  const snapshot = { v: 1, ts: Date.now(), data: state };
  try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot)); } catch (e) { }
  if (idbOK) idbPut('main', snapshot);
}

export async function wipeSave() {
  try { localStorage.removeItem(LS_KEY); } catch (e) { }
  if (db) {
    try { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete('main'); } catch (e) { }
  }
}
