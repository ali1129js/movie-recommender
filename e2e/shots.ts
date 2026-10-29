/**
 * Headless end-to-end run: serves the production build, walks the main flow in real Chrome for all
 * three themes at 1280 and 390 px, takes screenshots and runs axe-core (including colour contrast).
 * Usage: VITE_BASE=/ npm run build && npm run shots   (set SHOTS_DIR to change the output folder)
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright-core';

const OUT = process.env.SHOTS_DIR ?? join(process.cwd(), 'e2e/out');
const DIST = join(process.cwd(), 'dist');
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const THEMES = ['light', 'dark', 'contrast'] as const;
const VIEWPORTS = [
  { name: '1280', width: 1280, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;
const AXE = readFileSync(join(process.cwd(), 'node_modules/axe-core/axe.min.js'), 'utf8');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

function serve(): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIST, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() });
    }),
  );
}

interface AxeResult {
  violations: { id: string; impact: string | null; help: string; nodes: { target: string[] }[] }[];
}

async function runAxe(page: Page): Promise<AxeResult['violations']> {
  await page.addScriptTag({ content: AXE });
  const result = (await page.evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } })`)) as AxeResult;
  return result.violations;
}

async function pick(page: Page, query: string, optionStart: string): Promise<void> {
  const box = page.getByRole('combobox', { name: /Search for a film/ });
  await box.fill(query);
  await page.getByRole('option').filter({ hasText: new RegExp(`^${optionStart}`) }).first().click();
}

async function main(): Promise<void> {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ not found. Run `npm run build` first.');
  await mkdir(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'], headless: true });
  const report: Record<string, unknown>[] = [];
  let failed = false;

  try {
    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
        await context.addInitScript(`localStorage.setItem('movie-recommender-theme', '${theme}')`);
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

        await page.goto(server.url);
        await page.getByRole('combobox', { name: /Search for a film/ }).waitFor();
        await page.waitForFunction(() => !document.body.innerText.includes('Loading the wider'), null, { timeout: 30_000 });
        const actual = await page.evaluate(() => document.documentElement.dataset.theme);
        if (actual !== theme) throw new Error(`Expected theme ${theme}, got ${actual}`);

        await page.screenshot({ path: join(OUT, `home-${theme}-${vp.name}.png`), fullPage: true });
        const axeHome = await runAxe(page);

        await pick(page, 'heat', 'Heat');
        await pick(page, 'pulp', 'Pulp Fiction');
        await page.getByRole('heading', { name: /From viewer ratings/ }).waitFor();
        await page.screenshot({ path: join(OUT, `results-${theme}-${vp.name}.png`), fullPage: true });
        const axeResults = await runAxe(page);

        // Suggestion list open state.
        await page.getByRole('combobox', { name: /Search for a film/ }).fill('toy');
        await page.getByRole('option').first().waitFor();
        const axeOpen = await runAxe(page);
        await page.keyboard.press('Escape');

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        const violations = [...axeHome, ...axeResults, ...axeOpen];
        const summary = {
          theme,
          viewport: vp.name,
          axeViolations: violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`),
          horizontalOverflow: overflow,
          consoleErrors: errors,
        };
        report.push(summary);
        if (violations.length > 0 || overflow || errors.length > 0) failed = true;
        console.log(`${theme}@${vp.name}: axe violations=${violations.length} overflow=${overflow} errors=${errors.length}`);
        await context.close();
      }
    }

    // The headline screenshots: one recommendation with its explanations, light theme.
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await context.addInitScript(`localStorage.setItem('movie-recommender-theme', 'light')`);
      const page = await context.newPage();
      await page.goto(server.url);
      await page.waitForFunction(() => !document.body.innerText.includes('Loading the wider'), null, { timeout: 30_000 });
      await pick(page, 'alien', 'Alien');
      await pick(page, 'blade runner', 'Blade Runner');
      await page.getByRole('heading', { name: /From viewer ratings/ }).waitFor();
      await page.locator('#results-h').scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(OUT, `recommendation-explained-${vp.name}.png`), fullPage: true });
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  if (failed) {
    console.error('Accessibility, overflow or console problems found. See report.json.');
    process.exit(1);
  }
  console.log(`Screenshots written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
