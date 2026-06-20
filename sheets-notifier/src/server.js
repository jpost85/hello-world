const path = require('path');
const express = require('express');
const config = require('./config');
const routes = require('./routes');
const poller = require('./poller');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', routes);

app.get('/healthz', (req, res) => res.json({ ok: true }));

const server = app.listen(config.port, () => {
  console.log(`Sheets Notifier running at http://localhost:${config.port}`);
  if (!config.google.credentialsPath) {
    console.warn(
      'WARNING: GOOGLE_APPLICATION_CREDENTIALS is not set — the app cannot read sheets until you configure it.'
    );
  }
  if (!config.smsEnabled && !config.emailEnabled) {
    console.warn(
      'WARNING: No notification channel configured (Twilio SMS or SMTP email).'
    );
  }
  poller.start();
});

function shutdown() {
  console.log('Shutting down…');
  poller.stop();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
