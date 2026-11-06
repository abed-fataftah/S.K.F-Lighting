// One off: the shop's share image and the Store block logo (spec 0026 AC-13).
//   node scripts/make-share-images.mjs
// The logo sits on the ink token, the colour of the header it is drawn for (it is yellow and
// white, so on the yellow primary it would vanish). The colour is read from tokens.css, so it has
// one source. Commit the two PNGs it writes; rerun only when the logo or the token changes.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const TOKEN = "--skf-ink";

async function tokenColour() {
  const css = await readFile(`${root}src/app/tokens.css`, "utf8");
  const match = css.match(new RegExp(`${TOKEN}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`${TOKEN} not found in src/app/tokens.css`);
  return match[1];
}

async function render({ out, width, height, logoWidth, background, logo }) {
  const mark = await sharp(logo, { density: 300 }).resize({ width: logoWidth }).png().toBuffer();
  await sharp({ create: { width, height, channels: 3, background } })
    .composite([{ input: mark, gravity: "centre" }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(`${root}public/brand/${out}`);
  console.log(`wrote public/brand/${out} (${width}x${height})`);
}

const background = await tokenColour();
const logo = await readFile(`${root}public/brand/skf-logo.svg`);

// The share image: 1200 by 630, the logo at 40% of the width, no text.
await render({ out: "share.png", width: 1200, height: 630, logoWidth: 480, background, logo });
// The Store block logo: 512 by 512, the same logo with room around it.
await render({ out: "logo.png", width: 512, height: 512, logoWidth: 410, background, logo });
