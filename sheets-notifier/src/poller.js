const config = require('./config');
const store = require('./store');
const { getFileMeta } = require('./googleDrive');
const { notify } = require('./notifier');

let timer = null;
let lastRunAt = null;
let lastError = null;
let running = false;

async function checkSheet(sheet) {
  const meta = await getFileMeta(sheet.id);
  const previous = sheet.modifiedTime;
  const changed = previous && meta.modifiedTime && meta.modifiedTime !== previous;

  const patch = {
    name: meta.name || sheet.name,
    modifiedTime: meta.modifiedTime,
    webViewLink: meta.webViewLink || sheet.webViewLink,
    lastCheckedAt: new Date().toISOString(),
    lastModifyingUser: meta.lastModifyingUser,
    lastError: null,
  };

  if (changed) {
    patch.lastChangeDetectedAt = new Date().toISOString();
    patch.changeCount = (sheet.changeCount || 0) + 1;
  }

  store.updateSheet(sheet.id, patch);

  if (changed) {
    const by = meta.lastModifyingUser ? ` by ${meta.lastModifyingUser}` : '';
    const link = meta.webViewLink ? `\n${meta.webViewLink}` : '';
    const body = `📝 Google Sheet "${meta.name}" was modified${by}.${link}`;
    const channels = await notify({
      subject: `Sheet modified: ${meta.name}`,
      body,
    });
    store.updateSheet(sheet.id, { lastNotifiedAt: new Date().toISOString() });
    console.log(`Change detected for "${meta.name}" — notified:`, channels);
  }

  return changed;
}

async function runOnce() {
  const sheets = store.getSheets();
  const summary = { checked: 0, changed: 0, errors: [] };

  for (const sheet of sheets) {
    summary.checked += 1;
    try {
      const changed = await checkSheet(sheet);
      if (changed) summary.changed += 1;
    } catch (err) {
      summary.errors.push({ id: sheet.id, error: err.message });
      store.updateSheet(sheet.id, {
        lastCheckedAt: new Date().toISOString(),
        lastError: err.message,
      });
      console.error(`Error checking sheet ${sheet.id}:`, err.message);
    }
  }

  lastRunAt = new Date().toISOString();
  lastError = summary.errors.length ? summary.errors : null;
  return summary;
}

function start() {
  if (running) return;
  running = true;
  const intervalMs = config.pollIntervalSeconds * 1000;
  const tick = () => {
    runOnce().catch((err) => {
      lastError = err.message;
      console.error('Poller run failed:', err.message);
    });
  };
  timer = setInterval(tick, intervalMs);
  console.log(`Poller started: every ${config.pollIntervalSeconds}s`);
  tick();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  running = false;
}

function status() {
  return {
    running,
    intervalSeconds: config.pollIntervalSeconds,
    lastRunAt,
    lastError,
  };
}

module.exports = { start, stop, runOnce, status };
