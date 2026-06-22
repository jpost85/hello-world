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
| AT&T         | `5551234567@txt.att.net` (or `@mms.att.net`) |
| T-Mobile     | `5551234567@tmomail.net`  |
| Sprint       | `5551234567@messaging.sprintpcs.com` |

Use the **10-digit number only** — no `+1`, no dashes or spaces
(e.g. `5551234567@txt.att.net`, not `+1-555-123-4567@...`).

(If your carrier isn't listed, search "<carrier> email to SMS gateway".)

**No Twilio / paid SMS service needed.** The email-to-SMS gateway above is
free and is all this script uses.

## Troubleshooting

- **Upgraded from an older version?** This script no longer uses Twilio. If you
  previously added `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`, or
  `NOTIFY_SMS_TO` in Script Properties, you can delete them — they're ignored
  now. Keep only `NOTIFY_EMAIL_TO`.
- **AT&T text doesn't arrive.** Double-check the format (10 digits, no `+1` or
  dashes) and try `@mms.att.net` instead of `@txt.att.net`.

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

   > Settings live in Script Properties, which are private to this project —
   > they are never in the sheet's data and never leave Google.

4. **Install the trigger:** in the editor's function dropdown, select
   **`createTriggers`** and click **Run**. Approve the permission prompt
   (it needs to watch the sheet and send mail / make web requests).
5. **Test it:** select **`sendTest`** from the dropdown and click **Run** —
   you should get a text/email within a few seconds. Then edit a cell to see
   a real notification.

## How it works

An **installable `onChange` trigger** calls `onChangeHandler` whenever the
sheet is edited (cells, rows, structure). It emails everyone in
`NOTIFY_EMAIL_TO` (which can include free carrier email-to-SMS gateways for
texts). The `MIN_INTERVAL_SECONDS` debounce prevents a burst of messages when
you paste or edit many cells at once.

## Notes & limits

- `onChange` covers user edits and structural changes. Pure Google **Forms**
  submissions are better caught with a separate *On form submit* trigger; ask
  if you need that.
- Apps Script has generous free [quotas](https://developers.google.com/apps-script/guides/services/quotas)
  (e.g. email recipients/day, UrlFetch calls/day) — fine for personal use.
- To stop notifications: in the editor, **Triggers** (clock icon) → delete the
  `onChangeHandler` trigger.
- Repeat the setup in each sheet you want to watch.
