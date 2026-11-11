import { cp, mkdir, rm } from 'node:fs/promises';
const out = new URL('../dist/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of ['index.html', 'style.css', 'src', 'assets']) {
  await cp(new URL('../' + name, import.meta.url), new URL(name, out), { recursive: true });
}
console.log('Built dist/ — ready for any static host.');
