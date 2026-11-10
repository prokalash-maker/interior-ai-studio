const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const MAX_RESPONSE_BYTES = 1024 * 1024;

function googleRequest(url, options = {}, body = '') {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 15000,
    }, (response) => {
      let size = 0;
      const chunks = [];
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error('Ответ Google слишком велик.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        let data;
        try {
          data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch (_) {
          reject(new Error('Google вернул некорректный ответ.'));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const reason = typeof data.error === 'string' ? data.error : `HTTP ${response.statusCode}`;
          const description = typeof data.error_description === 'string' ? data.error_description : '';
          reject(new Error(`Google отклонил запрос: ${reason}${description ? ` — ${description}` : ''}.`));
          return;
        }
        resolve(data);
      });
    });
    request.on('timeout', () => request.destroy(new Error('Google не ответил вовремя. Проверьте подключение к интернету.')));
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

function postToken(params) {
  const body = new URLSearchParams(params).toString();
  return googleRequest(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
}

async function getGoogleUser(accessToken) {
  const data = await googleRequest(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!data.sub || !data.email || data.email_verified === false) {
    throw new Error('Google не подтвердил адрес электронной почты пользователя.');
  }
  return {
    id: data.sub,
    name: data.name || data.email,
    email: data.email,
    picture: data.picture || '',
  };
}

function callbackPage(success) {
  const title = success ? 'Вход в AI Designer завершён' : 'Не удалось войти в AI Designer';
  const message = success ? 'Вернитесь в приложение. Эту вкладку можно закрыть.' : 'Вернитесь в приложение и посмотрите сообщение об ошибке.';
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;background:#111827;color:#f9fafb;padding:40px"><h1>${title}</h1><p>${message}</p></body></html>`;
}

function startGoogleOAuth(clientId, clientSecret, openExternal, onAuthorized = async () => {}) {
  return new Promise((resolve) => {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto.randomBytes(24).toString('base64url');
    const server = http.createServer();
    let completed = false;
    let callbackStarted = false;
    let timer;

    const finish = (result) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      if (server.listening) server.close();
      resolve(result);
    };

    server.on('request', async (req, res) => {
      const address = server.address();
      const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${address.port}`);
      if (req.method !== 'GET' || requestUrl.pathname !== '/') {
        res.writeHead(404).end();
        return;
      }
      const returnedState = requestUrl.searchParams.get('state');
      const code = requestUrl.searchParams.get('code');
      if (returnedState !== state || !code || requestUrl.searchParams.has('error')) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(callbackPage(false));
        finish({ success: false, error: returnedState !== state ? 'Проверка состояния входа не прошла. Повторите вход.' : 'Вход в Google отменён или не завершён.' });
        return;
      }
      if (callbackStarted) {
        res.writeHead(409).end();
        return;
      }
      callbackStarted = true;

      try {
        const redirectUri = `http://127.0.0.1:${address.port}`;
        const tokenParams = {
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        };
        if (clientSecret) tokenParams.client_secret = clientSecret;
        const token = await postToken(tokenParams);
        if (!token.access_token || !Number.isFinite(Number(token.expires_in))) {
          throw new Error('Google не выдал действительный токен доступа.');
        }
        const user = await getGoogleUser(token.access_token);
        const result = {
          success: true,
          user,
          accessToken: token.access_token,
          refreshToken: token.refresh_token || null,
          expiresAt: Date.now() + Number(token.expires_in) * 1000,
        };
        await onAuthorized(result);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(callbackPage(true));
        finish(result);
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(callbackPage(false));
        finish({ success: false, error: error.message || 'Не удалось завершить вход Google.' });
      }
    });

    server.once('error', (error) => finish({ success: false, error: `Не удалось открыть локальный порт входа: ${error.message}` }));
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: `http://127.0.0.1:${port}`,
        scope: 'openid email profile',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
      }).toString();
      try {
        await openExternal(url.toString());
        if (!completed) timer = setTimeout(() => finish({ success: false, error: 'Время ожидания входа истекло. Повторите вход через браузер.' }), 180000);
      } catch (error) {
        finish({ success: false, error: `Не удалось открыть браузер: ${error.message}` });
      }
    });
  });
}

async function refreshGoogleSession(saved) {
  if (!saved || !saved.clientId || !saved.user || !saved.refreshToken) return null;
  const tokenParams = {
    client_id: saved.clientId,
    refresh_token: saved.refreshToken,
    grant_type: 'refresh_token',
  };
  if (saved.clientSecret) tokenParams.client_secret = saved.clientSecret;
  const token = await postToken(tokenParams);
  if (!token.access_token || !Number.isFinite(Number(token.expires_in))) {
    throw new Error('Google не обновил токен доступа. Повторите вход.');
  }
  const user = await getGoogleUser(token.access_token);
  if (user.id !== saved.user.id) throw new Error('Google вернул другой аккаунт. Повторите вход.');
  return {
    ...saved,
    user,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || saved.refreshToken,
    expiresAt: Date.now() + Number(token.expires_in) * 1000,
  };
}

module.exports = { startGoogleOAuth, refreshGoogleSession };
