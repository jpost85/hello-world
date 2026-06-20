const { google } = require('googleapis');
const config = require('./config');

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];

let drivePromise = null;

function getDrive() {
  if (!drivePromise) {
    if (!config.google.credentialsPath) {
      return Promise.reject(
        new Error(
          'No Google credentials configured. Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON key path.'
        )
      );
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: config.google.credentialsPath,
      scopes: SCOPES,
    });
    drivePromise = auth
      .getClient()
      .then((authClient) => google.drive({ version: 'v3', auth: authClient }));
  }
  return drivePromise;
}

/**
 * Extract a Google file ID from a full sheet URL or a raw ID.
 */
function extractFileId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  // Assume the input is already a bare ID.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Fetch metadata used to detect modifications.
 * Returns { id, name, modifiedTime, lastModifyingUser, webViewLink }.
 */
async function getFileMeta(fileId) {
  const drive = await getDrive();
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, modifiedTime, webViewLink, lastModifyingUser(displayName, emailAddress)',
    supportsAllDrives: true,
  });
  const data = res.data;
  return {
    id: data.id,
    name: data.name,
    modifiedTime: data.modifiedTime,
    webViewLink: data.webViewLink,
    lastModifyingUser: data.lastModifyingUser
      ? data.lastModifyingUser.displayName || data.lastModifyingUser.emailAddress
      : null,
  };
}

module.exports = { extractFileId, getFileMeta };
