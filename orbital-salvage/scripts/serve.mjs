import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const preview = process.argv.includes('--dist');
const root = fileURLToPath(new URL(preview ? '../dist/' : '../', import.meta.url));
const port = Number(process.env.PORT || 5173);
const clients = new Set();
let revision = Date.now(), reloadTimer;
const reloadScript = `<script>
(() => {
  let revision;
  const updates = new EventSource('/__dev/events');
  updates.onmessage = event => {
    if (revision !== undefined && revision !== event.data) location.reload();
    revision = event.data;
  };
})();
</script>`;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!preview && url.pathname === '/__dev/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`data: ${revision}\n\n`); clients.add(res);
      const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000);
      req.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
      return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (path !== root && !path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
    let content = await readFile(path);
    if (!preview && extname(path) === '.html') content = content.toString().replace('</body>', `${reloadScript}</body>`);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': preview ? 'no-cache' : 'no-store' });
    res.end(content);
  } catch { res.writeHead(404).end('Not found'); }
});
if (!preview) {
  const watcher = watch(root, { recursive: true }, (_, name) => {
    if (!name || !/^(index\.html$|style\.css$|src[\\/]|assets[\\/])/.test(name)) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      revision++;
      for (const client of clients) client.write(`data: ${revision}\n\n`);
    }, 120);
  });
  server.on('close', () => { watcher.close(); clearTimeout(reloadTimer); });
}
server.listen(port, '127.0.0.1', () => console.log(`Orbital Salvage: http://127.0.0.1:${port}${preview ? '' : ' (automatic reload enabled)'}`));
