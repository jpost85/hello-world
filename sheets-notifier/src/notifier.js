const nodemailer = require('nodemailer');
const config = require('./config');

let twilioClient = null;
let mailTransport = null;

function getTwilio() {
  if (!config.smsEnabled) return null;
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
}

function getMailTransport() {
  if (!config.emailEnabled) return null;
  if (!mailTransport) {
    mailTransport = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth:
        config.email.user && config.email.pass
          ? { user: config.email.user, pass: config.email.pass }
          : undefined,
    });
  }
  return mailTransport;
}

async function sendSms(body) {
  const client = getTwilio();
  if (!client) throw new Error('SMS not configured');
  await client.messages.create({
    body,
    from: config.twilio.from,
    to: config.twilio.to,
  });
}

async function sendEmail(subject, body) {
  const transport = getMailTransport();
  if (!transport) throw new Error('Email not configured');
  await transport.sendMail({
    from: config.email.from,
    to: config.email.to,
    subject,
    text: body,
  });
}

/**
 * Send a notification. Tries SMS first (primary), falls back to email.
 * Returns an array describing which channels succeeded/failed.
 */
async function notify({ subject, body }) {
  const results = [];

  if (config.smsEnabled) {
    try {
      await sendSms(body);
      results.push({ channel: 'sms', ok: true });
    } catch (err) {
      results.push({ channel: 'sms', ok: false, error: err.message });
    }
  }

  const smsSucceeded = results.some((r) => r.channel === 'sms' && r.ok);

  // Use email as a fallback if SMS isn't available or failed.
  if (config.emailEnabled && !smsSucceeded) {
    try {
      await sendEmail(subject, body);
      results.push({ channel: 'email', ok: true });
    } catch (err) {
      results.push({ channel: 'email', ok: false, error: err.message });
    }
  }

  if (results.length === 0) {
    results.push({
      channel: 'none',
      ok: false,
      error: 'No notification channel configured',
    });
  }

  const anyOk = results.some((r) => r.ok);
  if (!anyOk) {
    console.error('All notification channels failed:', results);
  }
  return results;
}

module.exports = { notify };
