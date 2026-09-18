// Renders Piggy's app icons from inline SVG. Run: npm run icons
import sharp from 'sharp';

const RED = '#E8505B';

// Pig face drawn on a 1024 canvas, centred, occupying roughly the middle 60%.
const pig = (fill, detail) => `
  <g>
    <path d="M330 330 L300 190 L430 270 Z" fill="${fill}" stroke="${fill}" stroke-width="30" stroke-linejoin="round"/>
    <path d="M694 330 L724 190 L594 270 Z" fill="${fill}" stroke="${fill}" stroke-width="30" stroke-linejoin="round"/>
    <circle cx="512" cy="530" r="250" fill="${fill}"/>
    <rect x="452" y="300" width="120" height="22" rx="11" fill="${detail}"/>
    <circle cx="425" cy="480" r="26" fill="${detail}"/>
    <circle cx="599" cy="480" r="26" fill="${detail}"/>
    <ellipse cx="512" cy="600" rx="110" ry="78" fill="${detail}"/>
    <ellipse cx="472" cy="600" rx="18" ry="26" fill="${fill}"/>
    <ellipse cx="552" cy="600" rx="18" ry="26" fill="${fill}"/>
  </g>`;

const svg = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}
  ${body}
</svg>`;

// Adaptive-icon foregrounds must fit the inner 66% safe zone, so shrink around the centre.
const scaled = (body, s) => `<g transform="translate(${512 * (1 - s)} ${512 * (1 - s)}) scale(${s})">${body}</g>`;

const out = [
  ['assets/icon.png', svg(pig('#FFFFFF', RED), RED), 1024],
  ['assets/android-icon-foreground.png', svg(scaled(pig('#FFFFFF', RED), 0.72)), 1024],
  ['assets/android-icon-background.png', svg('', RED), 1024],
  ['assets/android-icon-monochrome.png', svg(scaled(pig('#FFFFFF', 'transparent'), 0.72)), 1024],
  ['assets/splash-icon.png', svg(pig('#FFFFFF', RED)), 1024],
  ['assets/favicon.png', svg(pig('#FFFFFF', RED), RED), 48],
];

for (const [file, s, size] of out) {
  await sharp(Buffer.from(s)).resize(size, size).png().toFile(file);
  console.log('wrote', file);
}
