const fs = require('node:fs');
const path = require('node:path');

// Bundled application credentials (set for production releases)
// Normal users NEVER enter these; they belong to the AI Designer application.
const BUNDLED_CLIENT_ID = '';
const BUNDLED_CLIENT_SECRET = '';

function isValidClientId(id) {
  return typeof id === 'string' && /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(id.trim());
}

/**
 * Resolves the OAuth Desktop Client ID and optional Client Secret.
 * Priority order:
 * 1. Explicit developer override passed at runtime (from developer diagnostic UI).
 * 2. Local config file: electron/oauth.local.json or project root oauth.local.json (excluded from Git).
 * 3. Environment variables: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET.
 * 4. Stored credentials in secure database (safeStorage / DPAPI migration fallback).
 * 5. Bundled default credentials in this module (BUNDLED_CLIENT_ID).
 *
 * @param {object} options
 * @param {string} [options.explicitClientId]
 * @param {string} [options.explicitClientSecret]
 * @param {Function} [options.readStoredRecord]
 * @returns {{ clientId: string; clientSecret: string; source: string }}
 */
function resolveOAuthConfig(options = {}) {
  const { explicitClientId, explicitClientSecret, readStoredRecord } = options;

  // 1. Explicit developer override
  if (explicitClientId && isValidClientId(explicitClientId)) {
    return {
      clientId: explicitClientId.trim(),
      clientSecret: typeof explicitClientSecret === 'string' ? explicitClientSecret.trim() : '',
      source: 'developer_override',
    };
  }

  // 2. Local developer configuration file (excluded from Git)
  const candidatePaths = [
    path.join(__dirname, 'oauth.local.json'),
    path.join(__dirname, '..', 'oauth.local.json'),
    path.join(process.cwd(), 'oauth.local.json'),
  ];
  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && isValidClientId(parsed.clientId)) {
          return {
            clientId: parsed.clientId.trim(),
            clientSecret: typeof parsed.clientSecret === 'string' ? parsed.clientSecret.trim() : '',
            source: 'local_file',
          };
        }
      }
    } catch (_) {}
  }

  // 3. Environment variables
  const envId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const envSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  if (isValidClientId(envId)) {
    return {
      clientId: envId.trim(),
      clientSecret: envSecret.trim(),
      source: 'env',
    };
  }

  // 4. Stored credentials in secure_kv (DPAPI database migration fallback)
  if (typeof readStoredRecord === 'function') {
    try {
      const storedId = readStoredRecord('google_oauth_client_id');
      const storedSecret = readStoredRecord('google_oauth_client_secret') || '';
      if (isValidClientId(storedId)) {
        return {
          clientId: storedId.trim(),
          clientSecret: typeof storedSecret === 'string' ? storedSecret.trim() : '',
          source: 'stored_database',
        };
      }
    } catch (_) {}
  }

  // 5. Bundled fallback
  if (isValidClientId(BUNDLED_CLIENT_ID)) {
    return {
      clientId: BUNDLED_CLIENT_ID.trim(),
      clientSecret: BUNDLED_CLIENT_SECRET.trim(),
      source: 'bundled',
    };
  }

  return {
    clientId: '',
    clientSecret: '',
    source: 'none',
  };
}

module.exports = {
  isValidClientId,
  resolveOAuthConfig,
};
