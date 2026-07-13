const $ = (sel) => document.querySelector(sel);

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function fmt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString();
}

function badge(on, label) {
  return `<span class="badge ${on ? 'on' : 'off'}">${label}: ${
    on ? 'on' : 'off'
  }</span>`;
}

async function loadStatus() {
  try {
    const { poller, channels, googleConfigured, recipients: rc } = await api('/status');
    $('#status').innerHTML = `
      <div class="status-item">
        <div class="label">Poller</div>
        <div class="value">${poller.running ? '🟢 running' : '🔴 stopped'}</div>
      </div>
      <div class="status-item">
        <div class="label">Interval</div>
        <div class="value">${poller.intervalSeconds}s</div>
      </div>
      <div class="status-item">
        <div class="label">Last check</div>
        <div class="value">${fmt(poller.lastRunAt)}</div>
      </div>
      <div class="status-item">
        <div class="label">Channels</div>
        <div class="value">${badge(channels.sms, 'SMS')} ${badge(
      channels.email,
      'Email'
    )}</div>
      </div>
      <div class="status-item">
        <div class="label">Recipients</div>
        <div class="value">${rc.phones} 📱 · ${rc.emails} ✉️</div>
      </div>
      <div class="status-item">
        <div class="label">Google access</div>
        <div class="value">${googleConfigured ? '✅ configured' : '⚠️ not set'}</div>
      </div>
    `;
  } catch (err) {
    $('#status').textContent = `Error: ${err.message}`;
  }
}

async function loadSheets() {
  try {
    const { sheets } = await api('/sheets');
    if (!sheets.length) {
      $('#sheets').innerHTML =
        '<p class="empty">No sheets watched yet. Add one above.</p>';
      return;
    }
    $('#sheets').innerHTML = sheets
      .map((s) => {
        const nameHtml = s.webViewLink
          ? `<a href="${s.webViewLink}" target="_blank" rel="noopener">${s.name}</a>`
          : s.name;
        return `
        <div class="sheet">
          <div class="sheet-head">
            <div class="sheet-name">${nameHtml}</div>
            <button class="remove" data-id="${s.id}">Remove</button>
          </div>
          <div class="sheet-meta">
            <span>Last modified: ${fmt(s.modifiedTime)}</span>
            <span>Last checked: ${fmt(s.lastCheckedAt)}</span>
            <span>Changes seen: ${s.changeCount || 0}</span>
            <span>Last editor: ${s.lastModifyingUser || '—'}</span>
            <span>Last notified: ${fmt(s.lastNotifiedAt)}</span>
          </div>
          ${
            s.lastError
              ? `<div class="sheet-error">⚠️ ${s.lastError}</div>`
              : ''
          }
        </div>`;
      })
      .join('');

    document.querySelectorAll('.remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Stop watching this sheet?')) return;
        await api(`/sheets/${btn.dataset.id}`, { method: 'DELETE' });
        refresh();
      });
    });
  } catch (err) {
    $('#sheets').textContent = `Error: ${err.message}`;
  }
}

let recipients = { phones: [], emails: [] };

function renderChips(listEl, items, kind) {
  if (!items.length) {
    listEl.innerHTML = '<li class="empty">None yet.</li>';
    return;
  }
  listEl.innerHTML = items
    .map(
      (item, i) =>
        `<li class="chip">${item}<button data-kind="${kind}" data-index="${i}" title="Remove">×</button></li>`
    )
    .join('');
  listEl.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => removeRecipient(btn.dataset.kind, +btn.dataset.index));
  });
}

async function loadRecipients() {
  try {
    recipients = await api('/recipients');
    renderChips($('#phone-list'), recipients.phones, 'phones');
    renderChips($('#email-list'), recipients.emails, 'emails');
  } catch (err) {
    $('#recipients-msg').textContent = err.message;
    $('#recipients-msg').className = 'msg err';
  }
}

async function saveRecipients(next) {
  const msg = $('#recipients-msg');
  try {
    recipients = await api('/recipients', {
      method: 'PUT',
      body: JSON.stringify(next),
    });
    renderChips($('#phone-list'), recipients.phones, 'phones');
    renderChips($('#email-list'), recipients.emails, 'emails');
    msg.textContent = 'Recipients saved.';
    msg.className = 'msg ok';
    loadStatus();
    return true;
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'msg err';
    return false;
  }
}

function removeRecipient(kind, index) {
  const next = {
    phones: [...recipients.phones],
    emails: [...recipients.emails],
  };
  next[kind].splice(index, 1);
  saveRecipients(next);
}

$('#add-phone-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#phone-input');
  const value = input.value.trim();
  if (!value) return;
  const ok = await saveRecipients({
    phones: [...recipients.phones, value],
    emails: recipients.emails,
  });
  if (ok) input.value = '';
});

$('#add-email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#email-input');
  const value = input.value.trim();
  if (!value) return;
  const ok = await saveRecipients({
    phones: recipients.phones,
    emails: [...recipients.emails, value],
  });
  if (ok) input.value = '';
});

function refresh() {
  loadStatus();
  loadSheets();
  loadRecipients();
}

$('#add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#add-msg');
  msg.textContent = 'Adding…';
  msg.className = 'msg';
  try {
    await api('/sheets', {
      method: 'POST',
      body: JSON.stringify({
        urlOrId: $('#urlOrId').value,
        name: $('#name').value,
      }),
    });
    msg.textContent = 'Sheet added — now watching for changes.';
    msg.className = 'msg ok';
    $('#urlOrId').value = '';
    $('#name').value = '';
    refresh();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'msg err';
  }
});

$('#check-now').addEventListener('click', async () => {
  const btn = $('#check-now');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  try {
    const { summary } = await api('/check', { method: 'POST' });
    alert(
      `Checked ${summary.checked} sheet(s). ${summary.changed} change(s) detected.`
    );
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Check now';
    refresh();
  }
});

$('#test-notify').addEventListener('click', async () => {
  try {
    const { results } = await api('/test-notification', { method: 'POST' });
    alert('Test result:\n' + JSON.stringify(results, null, 2));
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
});

refresh();
setInterval(refresh, 15000);
