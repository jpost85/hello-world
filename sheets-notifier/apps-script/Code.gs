/**
 * Google Sheets Modification Notifier — Apps Script edition.
 *
 * Runs on Google's servers (free), fires the instant the sheet changes, and
 * sends a notification. No server or web host required.
 *
 * Notification channels (configured in Project Settings → Script Properties):
 *   - Email (free, built in). Tip: send to a carrier email-to-SMS gateway to
 *     receive a real text for free, e.g. 5551234567@vtext.com (Verizon),
 *     @txt.att.net (AT&T), @tmomail.net (T-Mobile).
 *   - Twilio SMS (optional, small per-message cost).
 *
 * SETUP — see README.md in this folder. In short:
 *   1. Extensions → Apps Script from your sheet, paste this file in.
 *   2. Project Settings → Script Properties: add the keys listed below.
 *   3. Run createTriggers() once and approve the permissions.
 *   4. (Optional) Run sendTest() to confirm notifications arrive.
 *
 * Script Properties used:
 *   NOTIFY_EMAIL_TO      Comma-separated email addresses (free channel).
 *   TWILIO_SID           Twilio Account SID (optional).
 *   TWILIO_TOKEN         Twilio Auth Token (optional).
 *   TWILIO_FROM          Twilio from-number, E.164 e.g. +15551234567 (optional).
 *   NOTIFY_SMS_TO        Comma-separated phone numbers, E.164 (optional).
 *   MIN_INTERVAL_SECONDS Debounce window to avoid spam (default 60).
 */

/** Installable onChange handler — fires on any modification to the sheet. */
function onChangeHandler(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var changeType = e && e.changeType ? e.changeType : 'EDIT';

  if (isDebounced_()) return;

  var sheetName = '';
  try {
    sheetName = ss.getActiveSheet().getName();
  } catch (err) {
    // Active sheet may be unavailable for some change types; ignore.
  }

  var who = e && e.user && e.user.getEmail ? e.user.getEmail() : '';
  var byline = who ? ' by ' + who : '';
  var tab = sheetName ? ' (tab "' + sheetName + '")' : '';

  var subject = 'Sheet modified: ' + ss.getName();
  var body =
    '📝 Google Sheet "' +
    ss.getName() +
    '" was modified' +
    byline +
    tab +
    ' [' +
    changeType +
    '].\n' +
    ss.getUrl();

  notify_(subject, body);
}

/** Send via SMS first (if configured), falling back to email. */
function notify_(subject, body) {
  var smsOk = sendSmsAll_(body);
  if (!smsOk) {
    sendEmailAll_(subject, body);
  }
}

function props_() {
  return PropertiesService.getScriptProperties();
}

function list_(key) {
  return (props_().getProperty(key) || '')
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return s;
    });
}

/** Returns true if we notified too recently (debounce to avoid spam). */
function isDebounced_() {
  var minInterval = parseInt(props_().getProperty('MIN_INTERVAL_SECONDS'), 10);
  if (!isFinite(minInterval)) minInterval = 60;
  if (minInterval <= 0) return false;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (err) {
    return false; // Couldn't lock; better to notify than to drop.
  }
  try {
    var now = Date.now();
    var last = parseInt(props_().getProperty('_lastNotifiedAt'), 10) || 0;
    if (now - last < minInterval * 1000) return true;
    props_().setProperty('_lastNotifiedAt', String(now));
    return false;
  } finally {
    lock.releaseLock();
  }
}

/** Send an SMS to every NOTIFY_SMS_TO number via Twilio. Returns true if any sent. */
function sendSmsAll_(body) {
  var p = props_();
  var sid = p.getProperty('TWILIO_SID');
  var token = p.getProperty('TWILIO_TOKEN');
  var from = p.getProperty('TWILIO_FROM');
  var toList = list_('NOTIFY_SMS_TO');
  if (!sid || !token || !from || !toList.length) return false;

  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json';
  var anyOk = false;
  toList.forEach(function (to) {
    try {
      var resp = UrlFetchApp.fetch(url, {
        method: 'post',
        headers: {
          Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token),
        },
        payload: { To: to, From: from, Body: body },
        muteHttpExceptions: true,
      });
      var code = resp.getResponseCode();
      if (code >= 200 && code < 300) anyOk = true;
      else Logger.log('Twilio error %s: %s', code, resp.getContentText());
    } catch (err) {
      Logger.log('Twilio exception for %s: %s', to, err);
    }
  });
  return anyOk;
}

/** Email every NOTIFY_EMAIL_TO address. Returns true if attempted. */
function sendEmailAll_(subject, body) {
  var toList = list_('NOTIFY_EMAIL_TO');
  if (!toList.length) return false;
  MailApp.sendEmail({ to: toList.join(','), subject: subject, body: body });
  return true;
}

/** Run once to install the onChange trigger (replaces any existing one). */
function createTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onChangeHandler') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('onChangeHandler').forSpreadsheet(ss).onChange().create();
  Logger.log('Trigger installed. The sheet will now notify on every change.');
}

/** Run to verify your configuration sends a notification. */
function sendTest() {
  notify_(
    'Sheets Notifier test',
    '✅ Test notification from your Google Sheets Modification Notifier (Apps Script).'
  );
  Logger.log('Test sent. Check your phone/email.');
}
