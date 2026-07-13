/**
 * Google Sheets Modification Notifier — Apps Script edition.
 *
 * Runs on Google's servers (free), fires the instant the sheet changes, and
 * sends an email notification. No server or web host required, and no Twilio /
 * paid SMS service needed.
 *
 * Want a text message? Email your carrier's free email-to-SMS gateway by
 * putting that address in NOTIFY_EMAIL_TO, e.g. (10-digit number, no +1):
 *   AT&T:     5551234567@txt.att.net   (or @mms.att.net)
 *   Verizon:  5551234567@vtext.com
 *   T-Mobile: 5551234567@tmomail.net
 *
 * SETUP — see README.md in this folder. In short:
 *   1. Extensions → Apps Script from your sheet, paste this file in.
 *   2. Project Settings → Script Properties: add the keys listed below.
 *   3. Run createTriggers() once and approve the permissions.
 *   4. (Optional) Run sendTest() to confirm notifications arrive.
 *
 * Script Properties used:
 *   NOTIFY_EMAIL_TO      Comma-separated email addresses and/or carrier
 *                        email-to-SMS gateway addresses.
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

/** Send the notification by email (free; supports carrier SMS gateways). */
function notify_(subject, body) {
  sendEmailAll_(subject, body);
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

/** Email every NOTIFY_EMAIL_TO address. Returns true if attempted. */
function sendEmailAll_(subject, body) {
  var toList = list_('NOTIFY_EMAIL_TO');
  if (!toList.length) {
    Logger.log('No NOTIFY_EMAIL_TO configured — nothing sent.');
    return false;
  }
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
