const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '../dist-electron');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.copyFileSync(
  path.resolve(__dirname, '../electron/main.cjs'),
  path.resolve(outDir, 'main.cjs')
);

fs.copyFileSync(
  path.resolve(__dirname, '../electron/preload.cjs'),
  path.resolve(outDir, 'preload.cjs')
);

fs.copyFileSync(
  path.resolve(__dirname, '../electron/googleAuth.cjs'),
  path.resolve(outDir, 'googleAuth.cjs')
);

fs.copyFileSync(
  path.resolve(__dirname, '../electron/oauthConfig.cjs'),
  path.resolve(outDir, 'oauthConfig.cjs')
);

// Desktop OAuth credentials are public-client configuration. Keep the developer's
// source file out of Git, then copy validated values into the package staging dir.
// Environment variables are read at build time here so packaged users do not need
// to configure GOOGLE_OAUTH_* on their own machines.
const localOAuthPath = path.resolve(__dirname, '../electron/oauth.local.json');
const bundledOAuthPath = path.join(outDir, 'oauth.local.json');
const clientIdPattern = /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;
let oauthCredentials = null;

try {
  if (fs.existsSync(localOAuthPath)) {
    const parsed = JSON.parse(fs.readFileSync(localOAuthPath, 'utf8'));
    if (clientIdPattern.test(String(parsed.clientId || '').trim())) oauthCredentials = parsed;
  }
} catch (error) {
  throw new Error(`Invalid electron/oauth.local.json: ${error.message}`);
}

if (!oauthCredentials && clientIdPattern.test(String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim())) {
  oauthCredentials = {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID.trim(),
    clientSecret: String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim(),
  };
}

if (oauthCredentials) {
  fs.writeFileSync(bundledOAuthPath, JSON.stringify({
    clientId: String(oauthCredentials.clientId).trim(),
    clientSecret: typeof oauthCredentials.clientSecret === 'string' ? oauthCredentials.clientSecret.trim() : '',
  }, null, 2), { mode: 0o600 });
} else if (fs.existsSync(bundledOAuthPath)) {
  fs.unlinkSync(bundledOAuthPath);
}

console.log(`Electron scripts prepared successfully in dist-electron/ (Google OAuth app config: ${oauthCredentials ? 'included' : 'not configured'}).`);
