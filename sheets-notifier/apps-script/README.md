# Free, no-server notifier — Google Apps Script

This is the **zero-cost, no-hosting** way to get notified the instant a Google
Sheet is modified. The script lives inside the sheet itself and runs on
Google's servers — no web host, no domain, nothing to keep running.

- ✅ **Free** (email channel is completely free)
- ✅ **Real-time** (fires the moment the sheet changes)
- ✅ **No server / no domain**
- ⚠️ Set up **per sheet** (repeat these steps for each sheet you want to watch)
- ⚠️ No central web dashboard (that's the Node app in the parent folder)

## Get a text message for free 📱

Apps Script email is free. To receive an actual **text**, email your carrier's
**email-to-SMS gateway** instead of (or in addition to) your inbox — put the
gateway address in `NOTIFY_EMAIL_TO`:

| Carrier (US) | Address format            |
| ------------ | ------------------------- |
| Verizon      | `5551234567@vtext.com`    |
| AT&T         | `5551234567@txt.att.net`  |
| T-Mobile     | `5551234567@tmomail.net`  |
| Sprint       | `5551234567@messaging.sprintpcs.com` |

(If your carrier isn't listed, search "<carrier> email to SMS gateway".)

Prefer a guaranteed-delivery real SMS? Configure the optional Twilio keys
below (small per-message cost).

## Setup (about 5 minutes)

1. **Open the script editor:** in your Google Sheet, go to
   **Extensions → Apps Script**.
2. **Paste the code:** delete any starter code in `Code.gs`, then paste the
   contents of [`Code.gs`](./Code.gs) from this folder. Click **Save**.
3. **Add your settings:** go to **Project Settings** (the ⚙️ gear on the left)
   → scroll to **Script Properties** → **Add script property** for each:

   | Property               | Value                                            |
   | ---------------------- | ------------------------------------------------ |
   | `NOTIFY_EMAIL_TO`      | Your email and/or carrier SMS gateway (comma-separated) |
   | `MIN_INTERVAL_SECONDS` | `60` (debounce; avoids a flood on bulk edits)    |

   Optional, only for Twilio SMS:

   | Property        | Value                                  |
   | --------------- | -------------------------------------- |
   | `TWILIO_SID`    | Your Twilio Account SID                 |
   | `TWILIO_TOKEN`  | Your Twilio Auth Token                  |
   | `TWILIO_FROM`   | Twilio number, E.164 e.g. `+15551234567`|
   | `NOTIFY_SMS_TO` | Recipient number(s), E.164, comma-separated |

   > Secrets live in Script Properties, which are private to this project —
   > they are never in the sheet's data and never leave Google.

4. **Install the trigger:** in the editor's function dropdown, select
   **`createTriggers`** and click **Run**. Approve the permission prompt
   (it needs to watch the sheet and send mail / make web requests).
5. **Test it:** select **`sendTest`** from the dropdown and click **Run** —
   you should get a text/email within a few seconds. Then edit a cell to see
   a real notification.

## How it works

An **installable `onChange` trigger** calls `onChangeHandler` whenever the
sheet is edited (cells, rows, structure). It sends an SMS via Twilio if those
keys are set, otherwise emails everyone in `NOTIFY_EMAIL_TO`. The
`MIN_INTERVAL_SECONDS` debounce prevents a burst of messages when you paste or
edit many cells at once.

## Notes & limits

- `onChange` covers user edits and structural changes. Pure Google **Forms**
  submissions are better caught with a separate *On form submit* trigger; ask
  if you need that.
- Apps Script has generous free [quotas](https://developers.google.com/apps-script/guides/services/quotas)
  (e.g. email recipients/day, UrlFetch calls/day) — fine for personal use.
- To stop notifications: in the editor, **Triggers** (clock icon) → delete the
  `onChangeHandler` trigger.
- Repeat the setup in each sheet you want to watch.
