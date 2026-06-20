const express = require('express');
const config = require('./config');
const store = require('./store');
const poller = require('./poller');
const { extractFileId, getFileMeta } = require('./googleDrive');
const { notify } = require('./notifier');

const router = express.Router();

// Overall status: poller + which notification channels are configured.
router.get('/status', (req, res) => {
  res.json({
    poller: poller.status(),
    channels: {
      sms: config.smsEnabled,
      email: config.emailEnabled,
    },
    googleConfigured: Boolean(config.google.credentialsPath),
  });
});

// List watched sheets.
router.get('/sheets', (req, res) => {
  res.json({ sheets: store.getSheets() });
});

// Add a sheet by URL or raw ID.
router.post('/sheets', async (req, res) => {
  const { urlOrId, name } = req.body || {};
  const id = extractFileId(urlOrId);
  if (!id) {
    return res
      .status(400)
      .json({ error: 'Could not parse a Google file ID from that input.' });
  }
  if (store.findSheet(id)) {
    return res.status(409).json({ error: 'That sheet is already being watched.' });
  }

  // Verify access and capture a baseline modifiedTime so we don't fire
  // a notification for the pre-existing state.
  let meta;
  try {
    meta = await getFileMeta(id);
  } catch (err) {
    return res.status(400).json({
      error: `Could not access that sheet. Make sure it is shared with the service account. (${err.message})`,
    });
  }

  const sheet = {
    id,
    name: name || meta.name,
    webViewLink: meta.webViewLink,
    modifiedTime: meta.modifiedTime,
    addedAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    lastModifyingUser: meta.lastModifyingUser,
    changeCount: 0,
  };
  store.addSheet(sheet);
  res.status(201).json({ sheet });
});

// Remove a watched sheet.
router.delete('/sheets/:id', (req, res) => {
  const ok = store.removeSheet(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Sheet not found.' });
  res.json({ ok: true });
});

// Trigger an immediate poll of all sheets.
router.post('/check', async (req, res) => {
  try {
    const summary = await poller.runOnce();
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a test notification through the configured channels.
router.post('/test-notification', async (req, res) => {
  const results = await notify({
    subject: 'Sheets Notifier test',
    body: '✅ Test notification from your Google Sheets Modification Notifier.',
  });
  const ok = results.some((r) => r.ok);
  res.status(ok ? 200 : 500).json({ results });
});

module.exports = router;
