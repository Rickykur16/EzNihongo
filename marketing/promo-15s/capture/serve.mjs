// Static server for the repo + /api reverse proxy to the local backend.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const repo = '/home/user/EzNihongo';
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.ico':'image/x-icon'};
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const p = http.request({host:'127.0.0.1', port:3001, path:req.url, method:req.method, headers:req.headers}, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on('error', () => { res.statusCode = 502; res.end(); });
    req.pipe(p); return;
  }
  let file = path.resolve(repo, '.' + decodeURIComponent(url.pathname));
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  if (!file.startsWith(repo)) { res.statusCode = 403; return res.end(); }
  try { const body = await fs.readFile(file); res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(body); }
  catch { res.statusCode = 404; res.end('nf'); }
}).listen(8080, '127.0.0.1', () => console.log('static on 8080'));
