const nodemailer = require('nodemailer');
const config = require('./config');
const store = require('./store');

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

async function sendSms(body, to) {
  const client = getTwilio();
  if (!client) throw new Error('SMS not configured');
  await client.messages.create({ body, from: config.twilio.from, to });
}

async function sendEmail(subject, body, to) {
  const transport = getMailTransport();
  if (!transport) throw new Error('Email not configured');
  await transport.sendMail({ from: config.email.from, to, subject, text: body });
}

/**
 * Send a notification to every configured recipient. Tries SMS first
 * (primary) to all phone numbers, then uses email as a fallback if no SMS
 * was delivered. Returns an array describing each send attempt.
 */
async function notify({ subject, body }) {
  const results = [];
  const { phones, emails } = store.getRecipients();

  if (config.smsEnabled && phones.length) {
    for (const to of phones) {
      try {
        await sendSms(body, to);
        results.push({ channel: 'sms', to, ok: true });
      } catch (err) {
        results.push({ channel: 'sms', to, ok: false, error: err.message });
      }
    }
  }

  const smsSucceeded = results.some((r) => r.channel === 'sms' && r.ok);

  // Use email as a fallback if no SMS was delivered (not configured, no
  // phone recipients, or every SMS send failed).
  if (config.emailEnabled && emails.length && !smsSucceeded) {
    for (const to of emails) {
      try {
        await sendEmail(subject, body, to);
        results.push({ channel: 'email', to, ok: true });
      } catch (err) {
        results.push({ channel: 'email', to, ok: false, error: err.message });
      }
    }
  }

  if (results.length === 0) {
    const reason = !config.smsEnabled && !config.emailEnabled
      ? 'No provider credentials configured (Twilio/SMTP)'
      : 'No recipients configured';
    results.push({ channel: 'none', ok: false, error: reason });
  }

  const anyOk = results.some((r) => r.ok);
  if (!anyOk) {
    console.error('All notification channels failed:', results);
  }
  return results;
}

module.exports = { notify };
