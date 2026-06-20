const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

let state = { sheets: [] };

function load() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      state = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      if (!Array.isArray(state.sheets)) state.sheets = [];
    }
  } catch (err) {
    console.error('Failed to read store, starting empty:', err.message);
    state = { sheets: [] };
  }
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
}

function getSheets() {
  return state.sheets;
}

function findSheet(id) {
  return state.sheets.find((s) => s.id === id);
}

function addSheet(sheet) {
  if (findSheet(sheet.id)) return false;
  state.sheets.push(sheet);
  persist();
  return true;
}

function removeSheet(id) {
  const before = state.sheets.length;
  state.sheets = state.sheets.filter((s) => s.id !== id);
  if (state.sheets.length !== before) {
    persist();
    return true;
  }
  return false;
}

function updateSheet(id, patch) {
  const sheet = findSheet(id);
  if (!sheet) return null;
  Object.assign(sheet, patch);
  persist();
  return sheet;
}

load();

module.exports = {
  getSheets,
  findSheet,
  addSheet,
  removeSheet,
  updateSheet,
};
