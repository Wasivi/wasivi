import { test, expect } from '@playwright/test';

const SHOTS = 'screenshots';

// Errors worth failing on; React Router's v7 future-flag notices are not.
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

const PAGES = [
  ['/', 'WASIVI'],
  ['/about', 'WASIVI — About'],
  ['/how-we-work', 'WASIVI — How We Work'],
  ['/faq', 'WASIVI — FAQ'],
  ['/projects', 'WASIVI — Projects'],
];

for (const [path, title] of PAGES) {
  test(`page ${path} loads cleanly`, async ({ page }) => {
    const errors = collectErrors(page);
    const res = await page.goto(path);
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(title);
    await page.waitForTimeout(1500);
    const name = path === '/' ? 'home' : path.slice(1);
    await page.screenshot({ path: `${SHOTS}/page-${name}.png` });
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// Counts pixels in a screenshot by colour class, inside the browser (no
// image library needed). Gold = the brass glyph; brown = the "chocolate"
// failure: dark, warm, low-brightness pixels inside the medallion.
async function colourStats(page, png, box) {
  return page.evaluate(
    async ({ b64, box }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(box.x, box.y, box.width, box.height);
      let gold = 0, brown = 0, total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, bl] = [data[i], data[i + 1], data[i + 2]];
        total++;
        if (r > 140 && g > 120 && bl < 110 && r - bl > 70) gold++;
        const max = Math.max(r, g, bl);
        if (max > 35 && max < 110 && r - bl > 25 && r >= g) brown++;
      }
      return { gold: gold / total, brown: brown / total };
    },
    { b64: png.toString('base64'), box }
  );
}

test('hero medallion renders gold at every angle, never brown', async ({ page }) => {
  const errors = collectErrors(page);
  for (const angle of [0, 35, 90, 140, 180, 250, 325]) {
    await page.goto(`/?angle=${angle}`);
    await page.locator('.medallion-stage canvas').waitFor();
    await page.waitForTimeout(4500); // let the camera entrance settle
    const box = await page.locator('.mark-placeholder').boundingBox();
    const png = await page.screenshot({ path: `${SHOTS}/hero-${angle}.png`, clip: box });
    const inner = { x: 0, y: 0, width: Math.round(box.width), height: Math.round(box.height) };
    const { gold, brown } = await colourStats(page, png, inner);
    // Near side-on views show mostly chrome and steel side walls, so only
    // require gold when the medallion is turned toward the viewer.
    const sideOn = Math.abs(Math.sin((angle * Math.PI) / 180)) > 0.9;
    if (!sideOn) expect(gold, `gold share at ${angle}°`).toBeGreaterThan(0.04);
    expect(brown, `brown share at ${angle}°`).toBeLessThan(0.08);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});
