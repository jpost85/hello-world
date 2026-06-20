# 📊 Google Sheets Modification Notifier

A small web tool that watches one or more Google Sheets and sends you a
**text message** (or **email** as a fallback) whenever one of them is modified.

It works by polling the Google Drive API for each watched file's
`modifiedTime` on an interval — no public webhook URL required.

## Features

- Web dashboard to add/remove watched sheets (paste a URL or ID)
- Polls on a configurable interval and detects changes
- Notifies via **Twilio SMS** (primary) with **email/SMTP** fallback
- Shows last-modified time, last editor, change count, and per-sheet errors
- "Check now" and "Send test notification" buttons
- Local JSON persistence (no database needed)

## How it works

```
Browser dashboard  ──>  Express API  ──>  Google Drive API (files.get modifiedTime)
                                      │
                          poller (setInterval) detects change
                                      │
                                      └──>  Twilio SMS  /  SMTP email
```

## Setup

### 1. Install

```bash
cd sheets-notifier
npm install
cp .env.example .env
```

### 2. Create a Google service account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create (or pick) a project and **enable the Google Drive API**.
3. Create a **Service Account** and generate a **JSON key**.
4. Save the JSON key in this folder (e.g. `service-account.json`) and point
   `GOOGLE_APPLICATION_CREDENTIALS` at it in `.env`.
5. **Share each sheet** you want to watch with the service account's
   `client_email` (Viewer access is enough).

> The credentials files are git-ignored so they won't be committed.

### 3. Configure notifications

The **provider credentials** (secrets) live in `.env`; the **recipients**
(who gets notified) are managed in the web UI under **Notification
recipients** and can be changed without restarting.

**SMS (Twilio):** fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
`TWILIO_FROM_NUMBER`. Optionally set `NOTIFY_SMS_TO` to seed one recipient
on first run.

**Email fallback:** fill in the `SMTP_*` and `EMAIL_FROM` values.
Optionally set `NOTIFY_EMAIL_TO` to seed one recipient. For Gmail, use an
[App Password](https://support.google.com/accounts/answer/185833).

All phone numbers / emails added in the UI are notified. SMS is tried
first; email is used only if no SMS could be delivered. Numbers must be in
E.164 format (e.g. `+15551234567`).

### 4. Run

```bash
npm start
```

Open <http://localhost:3000>, paste a sheet URL, and click **Watch**.

## Notes

- Polling granularity is set by `POLL_INTERVAL_SECONDS` (default 30s, min 5s).
- Drive's `modifiedTime` updates on content edits; the baseline is captured
  when you add a sheet, so you won't get a notification for its current state.
- For true real-time delivery you'd use Drive push notifications or an
  Apps Script `onEdit` trigger — polling was chosen here for simplicity and
  because it needs no publicly reachable endpoint.

## API

| Method | Path                     | Description                         |
| ------ | ------------------------ | ----------------------------------- |
| GET    | `/api/status`            | Poller + channel status             |
| GET    | `/api/sheets`            | List watched sheets                 |
| POST   | `/api/sheets`            | Add a sheet `{ urlOrId, name }`     |
| DELETE | `/api/sheets/:id`        | Stop watching a sheet               |
| POST   | `/api/check`             | Poll all sheets immediately         |
| POST   | `/api/test-notification` | Send a test notification            |
| GET    | `/api/recipients`        | Get recipient phone/email lists     |
| PUT    | `/api/recipients`        | Replace recipients `{ phones, emails }` |
