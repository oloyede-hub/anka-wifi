// Development only: expose the OPay webhook, not the rest of the API.
const http = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '../../..');
const binary = path.join(os.tmpdir(), 'anka-opay-tunnel', 'cloudflared.exe');
const gateway = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{"status":"ok"}');
    return;
  }
  if (request.method !== 'POST' || request.url !== '/payments/opay/webhook') {
    response.writeHead(404);
    response.end();
    return;
  }
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: request.url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000,
    },
    (result) => {
      response.writeHead(result.statusCode ?? 502, {
        'Content-Type': 'application/json',
      });
      result.pipe(response);
    },
  );
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(503);
    response.end();
  });
  request.on('error', () => upstream.destroy());
  request.pipe(upstream);
});
gateway.listen(0, '127.0.0.1', () => {
  const tunnel = spawn(
    binary,
    [
      'tunnel',
      '--no-autoupdate',
      '--url',
      `http://127.0.0.1:${gateway.address().port}`,
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let configured = false;
  tunnel.stderr.on('data', (chunk) => {
    const match = chunk
      .toString()
      .match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!match || configured) return;
    configured = true;
    const envPath = path.join(root, '.env');
    const contents = fs.readFileSync(envPath, 'utf8');
    const setting = `API_URL=${match[0]}`;
    fs.writeFileSync(
      envPath,
      /^API_URL\s*=/m.test(contents)
        ? contents.replace(/^API_URL\s*=.*$/m, setting)
        : `${contents.trimEnd()}\n${setting}\n`,
    );
    console.log(`OPay callback origin configured: ${match[0]}`);
    console.log(`OPay callback: ${match[0]}/payments/opay/webhook`);
    console.log(
      'Keep this process running. Restart the API to load the updated root .env.',
    );
  });
  tunnel.on('error', () => {
    console.error(
      'Unable to start cloudflared. Install the verified portable binary first.',
    );
    gateway.close();
    process.exitCode = 1;
  });
  tunnel.on('exit', (code) => {
    gateway.close();
    process.exitCode = code ?? 1;
  });
  function stop() {
    tunnel.kill();
    gateway.close();
  }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
});
