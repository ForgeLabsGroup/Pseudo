// Downloads the official standalone yt-dlp binary to <repo>/.cache/bin (git-ignored).
// Used locally and in the Render build command. Skips if already present (pass --force to update).
import { chmod, mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = {
  win32: ['yt-dlp.exe', 'yt-dlp.exe'],
  linux: ['yt-dlp_linux', 'yt-dlp'],
  darwin: ['yt-dlp_macos', 'yt-dlp'],
};
const asset = ASSETS[process.platform];
if (!asset) {
  console.error(`Unsupported platform ${process.platform}; install yt-dlp and set YTDLP_PATH.`);
  process.exit(1);
}
const [remoteName, localName] = asset;
const binDir = join(dirname(fileURLToPath(import.meta.url)), '../../..', '.cache', 'bin');
const target = join(binDir, localName);

const exists = await stat(target).then(
  () => true,
  () => false,
);
if (exists && !process.argv.includes('--force')) {
  console.log(`yt-dlp already installed at ${target}`);
  process.exit(0);
}

await mkdir(binDir, { recursive: true });
const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${remoteName}`;
console.log(`Downloading ${url}`);
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) {
  console.error(`Download failed: HTTP ${res.status}`);
  process.exit(1);
}
const tmp = `${target}.download`;
await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
await chmod(tmp, 0o755);
await rename(tmp, target);
console.log(`Installed ${target}`);
