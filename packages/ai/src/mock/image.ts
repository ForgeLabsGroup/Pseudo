import type { GenerateImageArgs, GeneratedImage } from '../image';

/** SVG placeholder so the media pipeline (storage, library, content) works with no image API. */
export async function mockImage(args: GenerateImageArgs): Promise<GeneratedImage> {
  await new Promise((r) => setTimeout(r, 800));
  const [w, h] =
    args.aspectRatio === '9:16'
      ? [1080, 1920]
      : args.aspectRatio === '1:1'
        ? [1080, 1080]
        : args.aspectRatio === '16:9'
          ? [1920, 1080]
          : [1080, 1350];
  const hue = Math.floor(Math.random() * 360);
  const label = args.prompt.slice(0, 80).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,22%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},80%,45%)"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<text x="50%" y="46%" fill="#fff" font-family="sans-serif" font-size="${Math.round(w / 18)}" text-anchor="middle" opacity="0.9">MOCK IMAGE</text>
<text x="50%" y="54%" fill="#fff" font-family="sans-serif" font-size="${Math.round(w / 40)}" text-anchor="middle" opacity="0.75">${label}</text>
</svg>`;
  return { data: Buffer.from(svg), mimeType: 'image/svg+xml', provider: 'mock', model: 'mock' };
}
