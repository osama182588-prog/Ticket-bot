import fs from 'fs';
import path from 'path';
import { defaultSettings } from './constants.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_PATH = path.join(DATA_DIR, 'state.json');

const defaultState = {
  dashboards: [],
  typeRoles: {},
  tickets: {},
  settings: { ...defaultSettings },
  bannedUsers: {},
  spamTracker: {},
  settingsLog: []
};

function ensureStateFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STATE_PATH)) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(defaultState, null, 2));
  }
}

ensureStateFile();

let state = defaultState;
try {
  const raw = fs.readFileSync(STATE_PATH, 'utf8');
  state = { ...defaultState, ...JSON.parse(raw) };
  state.settings = { ...defaultState.settings, ...(state.settings || {}) };
  state.typeRoles = state.typeRoles || {};
  state.tickets = state.tickets || {};
  state.bannedUsers = state.bannedUsers || {};
  state.spamTracker = state.spamTracker || {};
} catch (error) {
  state = defaultState;
}

export function saveState(next = state) {
  state = next;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function updateState(mutator) {
  const clone = structuredClone(state);
  mutator(clone);
  saveState(clone);
}

export function getState() {
  return state;
}
