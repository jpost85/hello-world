require('dotenv').config();

function bool(v, fallback = false) {
  if (v === undefined || v === '') return fallback;
  return String(v).toLowerCase() === 'true' || v === '1';
}

function int(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  port: int(process.env.PORT, 3000),
  pollIntervalSeconds: Math.max(5, int(process.env.POLL_INTERVAL_SECONDS, 30)),

  google: {
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM_NUMBER || '',
    to: process.env.NOTIFY_SMS_TO || '',
  },

  email: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
    to: process.env.NOTIFY_EMAIL_TO || '',
  },
};

config.smsEnabled = Boolean(
  config.twilio.accountSid &&
    config.twilio.authToken &&
    config.twilio.from &&
    config.twilio.to
);

config.emailEnabled = Boolean(
  config.email.host && config.email.to && config.email.from
);

module.exports = config;
