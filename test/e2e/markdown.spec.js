const { test, expect } = require('@playwright/test');
const path = require('path');

const MARKED_JS = path.resolve(__dirname, '../../marked.min.js');
const EMOJI_JS = path.resolve(__dirname, '../../emoji.js');
const CONTENT_JS = path.resolve(__dirname, '../../contentScript.js');

async function setupPage(page, overrides = {}) {
  const opts = {
    convertOnPaste: false,
    autoFormat: true,
    gfm: true,
    theme: 'default',
    shortcut: 'Ctrl+Shift+M',
    codeShortcut: 'Ctrl+E',
    disableDefault: false,
    ...overrides,
  };

  await page.setContent(
    '<!DOCTYPE html><html><body>' +
    '<div aria-label="Message Body" contenteditable="true"></div>' +
    '</body></html>'
  );

  // Inject chrome mock as first script so contentScript can see it
  await page.addScriptTag({
    content: `window.chrome = {
      storage: { sync: { get: (_d, cb) => cb(${JSON.stringify(opts)}) } },
      runtime: { getURL: p => p }
    };`,
  });
  await page.addScriptTag({ path: MARKED_JS });
  await page.addScriptTag({ path: EMOJI_JS });
  await page.addScriptTag({ path: CONTENT_JS });
  await page.locator('[aria-label="Message Body"]').click();
}

const EDITOR = '[aria-label="Message Body"]';

/**
 * Set the text content of the editor and position the cursor at the end of that text.
 */
async function setEditorText(page, text) {
  await page.evaluate((t) => {
    const div = document.querySelector('[aria-label="Message Body"]');
    div.focus();
    div.textContent = t;
    const range = document.createRange();
    range.setStart(div.firstChild || div, t.length);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }, text);
}

/**
 * Select all text inside the editor.
 */
async function selectAll(page) {
  await page.evaluate(() => {
    const div = document.querySelector('[aria-label="Message Body"]');
    div.focus();
    const range = document.createRange();
    range.selectNodeContents(div);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
}

// ─── Inline code shortcut ────────────────────────────────────────────────────

test('Ctrl+E wraps selected text in an inline <code> element', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, 'hello world');
  await selectAll(page);
  await page.keyboard.press('Control+e');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).toContain('<code');
  expect(html).toContain('hello world');
  // Browser normalises hex to rgb: #2d2d2d → rgb(45, 45, 45), #ff6b6b → rgb(255, 107, 107)
  expect(html).toContain('rgb(45, 45, 45)');
  expect(html).toContain('rgb(255, 107, 107)');
});

test('Ctrl+E on already-formatted code removes the formatting', async ({ page }) => {
  await setupPage(page);
  // Wrap first
  await setEditorText(page, 'hello world');
  await selectAll(page);
  await page.keyboard.press('Control+e');

  // Now select the code element and toggle off
  await page.evaluate(() => {
    const code = document.querySelector('[aria-label="Message Body"] code');
    const range = document.createRange();
    range.selectNodeContents(code);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  await page.keyboard.press('Control+e');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).not.toContain('<code');
  expect(html).toContain('hello world');
});

test('Ctrl+E does nothing when no text is selected', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, 'hello world');
  // cursor is at end, nothing selected
  await page.keyboard.press('Control+e');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).not.toContain('<code');
});

test('custom codeShortcut replaces Ctrl+E', async ({ page }) => {
  await setupPage(page, { codeShortcut: 'Ctrl+Shift+K' });
  await setEditorText(page, 'hello world');
  await selectAll(page);

  // Default Ctrl+E should NOT trigger, but it might natively steal focus (e.g., to omnibox).
  await page.keyboard.press('Control+e');
  let html = await page.locator(EDITOR).innerHTML();
  expect(html).not.toContain('<code');

  // Must refocus the editor and re-select text because Ctrl+e moved focus away!
  await page.evaluate(() => {
    const div = document.querySelector('[aria-label="Message Body"]');
    div.focus();
    const range = document.createRange();
    range.selectNodeContents(div);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });

  // Custom shortcut should trigger
  await page.keyboard.press('Control+Shift+K');
  html = await page.locator(EDITOR).innerHTML();
  expect(html).toContain('<code');
});

// ─── Auto-format: block elements ─────────────────────────────────────────────

test('auto-formats "# " into an H1 heading', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '#');
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} h1`)).toBeAttached();
});

test('auto-formats "## " into an H2 heading', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '##');
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} h2`)).toBeAttached();
});

test('auto-formats "### " into an H3 heading', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '###');
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} h3`)).toBeAttached();
});

test('auto-formats "> " into a blockquote', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '>');
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} [data-md-quote]`)).toBeAttached();
});

test('auto-formats "* " into an unordered list item', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '*');
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} ul li`)).toBeAttached();
});

test('auto-formats "- " into an unordered list item', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '-');
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} ul li`)).toBeAttached();
});

test('auto-formats "1. " into an ordered list item', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '1.');
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} ol li`)).toBeAttached();
});

test('auto-formats "``` " into a code block', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '```');
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} pre`)).toBeAttached();
});

// ─── Auto-format: inline styles ──────────────────────────────────────────────

test('auto-formats **text** into a bold span on space', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '**hello**');
  await page.keyboard.press('Space');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).toMatch(/font-weight:\s*bold/);
  expect(html).toContain('hello');
});

test('auto-formats *text* into an italic span on space', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '*hello*');
  await page.keyboard.press('Space');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).toMatch(/font-style:\s*italic/);
  expect(html).toContain('hello');
});

test('auto-formats ~~text~~ into a strikethrough span on space', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '~~hello~~');
  await page.keyboard.press('Space');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).toMatch(/text-decoration(-line)?:\s*line-through/);
  expect(html).toContain('hello');
});

test('auto-formats `text` into an inline code element on space', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '`hello`');
  await page.keyboard.press('Space');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).toContain('<code');
  expect(html).toContain('hello');
});

// ─── Markdown conversion shortcut ────────────────────────────────────────────

test('Ctrl+Shift+M converts markdown heading to H1', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '# Hello World');
  await page.keyboard.press('Control+Shift+M');

  const h1 = page.locator(`${EDITOR} h1`);
  await expect(h1).toBeAttached();
  await expect(h1).toContainText('Hello World');
});

test('Ctrl+Shift+M converts **bold** to bold formatting', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '**bold text**');
  await page.keyboard.press('Control+Shift+M');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).toContain('<strong>');
  expect(html).toContain('bold text');
});

test('Ctrl+Shift+M converts selected markdown only', async ({ page }) => {
  await setupPage(page);
  // Put a heading in the editor and select only it
  await page.evaluate(() => {
    const div = document.querySelector('[aria-label="Message Body"]');
    div.focus();
    div.innerHTML = '<div>plain text</div><div># Heading</div>';
    // Select only the second div
    const second = div.children[1];
    const range = document.createRange();
    range.selectNodeContents(second);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  await page.keyboard.press('Control+Shift+M');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).toContain('<h1>');
  expect(html).toContain('plain text');
});

// ─── Auto-format disabled ─────────────────────────────────────────────────────

test('auto-format can be disabled via options', async ({ page }) => {
  await setupPage(page, { autoFormat: false });
  await setEditorText(page, '#');
  await page.keyboard.press('Space');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).not.toContain('<h1>');
});
