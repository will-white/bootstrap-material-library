// Headless Chromium for the test suite. playwright-core is a devDependency;
// the browser itself comes from CHROME_PATH, playwright's own download
// (npx playwright-core install chromium), or a browsers directory
// (PLAYWRIGHT_BROWSERS_PATH / ~/.cache/ms-playwright), in that order.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

function executablePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    const p = chromium.executablePath();
    if (fs.existsSync(p)) return p;
  } catch {}
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  const rels = ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe'];
  for (const root of roots) {
    let dirs = [];
    try { dirs = fs.readdirSync(root).filter((d) => d.startsWith('chromium')).sort().reverse(); } catch { continue; }
    for (const d of dirs) for (const rel of rels) {
      const p = path.join(root, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

async function launch() {
  const p = executablePath();
  return chromium.launch(p ? { executablePath: p } : {});
}

// Static server over the repo root plus in-memory files ({ '/x.css': text }).
function serve(root, memory = {}) {
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    let body = memory[u];
    if (body === undefined) {
      try { body = fs.readFileSync(path.join(root, u)); } catch { res.statusCode = 404; return res.end(); }
    }
    res.setHeader('content-type', types[path.extname(u)] || 'application/octet-stream');
    res.end(body);
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ port: srv.address().port, close: () => srv.close() })));
}

module.exports = { launch, executablePath, serve };
