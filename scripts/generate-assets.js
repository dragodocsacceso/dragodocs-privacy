const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'ChatGPT Image 8 jul 2026, 19_26_09.png');
const OUT_DIR = path.join(ROOT, 'assets', 'images');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function generate() {
  const base = sharp(SOURCE).png({ quality: 95 });

  await base.resize(512, 512, { fit: 'contain', background: { r: 5, g: 5, b: 7, alpha: 0 } })
    .toFile(path.join(OUT_DIR, 'logo.png'));

  await base.resize(32, 32, { fit: 'contain', background: { r: 5, g: 5, b: 7, alpha: 0 } })
    .toFile(path.join(OUT_DIR, 'favicon-32x32.png'));

  await base.resize(16, 16, { fit: 'contain', background: { r: 5, g: 5, b: 7, alpha: 0 } })
    .toFile(path.join(OUT_DIR, 'favicon-16x16.png'));

  await base.resize(180, 180, { fit: 'contain', background: { r: 5, g: 5, b: 7, alpha: 0 } })
    .toFile(path.join(OUT_DIR, 'apple-touch-icon.png'));

  const sizes = [16, 32, 48];
  const buffers = await Promise.all(sizes.map(size =>
    sharp(SOURCE).resize(size, size, { fit: 'contain', background: { r: 5, g: 5, b: 7, alpha: 0 } }).png().toBuffer()
  ));
  const icoBuffer = await toIco(buffers);
  fs.writeFileSync(path.join(OUT_DIR, 'favicon.ico'), icoBuffer);

  const ogSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#050507"/>
        <stop offset="50%" stop-color="#0A0A14"/>
        <stop offset="100%" stop-color="#12121A"/>
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00F0FF" stop-opacity="0.35"/>
        <stop offset="50%" stop-color="#7C4DFF" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#9D4EDD" stop-opacity="0.15"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <rect x="80" y="80" width="1040" height="470" rx="32" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  </svg>`;

  const logoBuffer = await sharp(SOURCE).resize(280, 280, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  const textSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00F0FF"/>
        <stop offset="50%" stop-color="#2979FF"/>
        <stop offset="100%" stop-color="#B967FF"/>
      </linearGradient>
    </defs>
    <text x="50%" y="500" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="72" font-weight="700" fill="url(#textGrad)" text-anchor="middle">DragoDocs AI</text>
  </svg>`;

  const textSvgTwitter = `<svg width="1200" height="600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="textGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00F0FF"/>
        <stop offset="50%" stop-color="#2979FF"/>
        <stop offset="100%" stop-color="#B967FF"/>
      </linearGradient>
    </defs>
    <text x="50%" y="470" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="72" font-weight="700" fill="url(#textGrad2)" text-anchor="middle">DragoDocs AI</text>
  </svg>`;

  const textBuffer = await sharp(Buffer.from(textSvg)).resize(1200, 630, { fit: 'fill' }).png().toBuffer();

  await sharp(Buffer.from(ogSvg))
    .composite([
      { input: logoBuffer, top: 70, left: 460 },
      { input: textBuffer, top: 0, left: 0 }
    ])
    .toFile(path.join(OUT_DIR, 'og-image.png'));

  const twitterSvg = `<svg width="1200" height="600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#050507"/>
        <stop offset="100%" stop-color="#0D0D16"/>
      </linearGradient>
      <linearGradient id="glow2" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00F0FF" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#7C4DFF" stop-opacity="0.20"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="600" fill="url(#bg2)"/>
    <rect width="1200" height="600" fill="url(#glow2)"/>
  </svg>`;

  const textBufferTwitter = await sharp(Buffer.from(textSvgTwitter)).resize(1200, 600, { fit: 'fill' }).png().toBuffer();

  await sharp(Buffer.from(twitterSvg))
    .composite([
      { input: logoBuffer, top: 60, left: 460 },
      { input: textBufferTwitter, top: 0, left: 0 }
    ])
    .toFile(path.join(OUT_DIR, 'twitter-card.png'));

  console.log('Assets generated successfully in', OUT_DIR);
}

generate().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
