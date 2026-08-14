const { test, expect } = require('@playwright/test');
const path = require('path');

const MARKED_JS = path.resolve(__dirname, '../../vendor/marked.umd.js');
const EMOJI_JS = path.resolve(__dirname, '../../emoji.js');
const SECURITY_JS = path.resolve(__dirname, '../../markdownSecurity.js');
const CONTENT_JS = path.resolve(__dirname, '../../contentScript.js');

async function loadContentScript(page, overrides = {}) {
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

  await page.addScriptTag({
    content: `window.chrome = {
      storage: {
        sync: { get: (_d, cb) => cb(${JSON.stringify(opts)}) },
        onChanged: { addListener: () => {} }
      },
      runtime: { getURL: p => p }
    };`,
  });
  await page.addScriptTag({ path: MARKED_JS });
  await page.addScriptTag({ path: EMOJI_JS });
  await page.addScriptTag({ path: SECURITY_JS });
  await page.addScriptTag({ path: CONTENT_JS });
}

test('formatted HTML paste is left to Gmail when convert-on-paste is disabled', async ({ page }) => {
  await page.setContent('<div aria-label="Message Body" contenteditable="true"></div>');
  await loadContentScript(page);

  const prevented = await page.locator('[aria-label="Message Body"]').evaluate((editor) => {
    editor.focus();
    const data = new DataTransfer();
    data.setData('text/plain', 'formatted text');
    data.setData('text/html', '<strong>formatted text</strong>');
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: data,
    });
    editor.dispatchEvent(event);
    return event.defaultPrevented;
  });

  expect(prevented).toBe(false);
});

test('conversion shortcut does not fall back to the first draft', async ({ page }) => {
  await page.setContent(
    '<div aria-label="Message Body" contenteditable="true"># first</div>' +
    '<div aria-label="Message Body" contenteditable="true"># second</div>' +
    '<button id="outside">Outside</button>'
  );
  await loadContentScript(page);

  await page.locator('#outside').focus();
  await page.evaluate(() => window.getSelection().removeAllRanges());
  await page.keyboard.press('Control+Shift+M');

  const editors = await page.locator('[aria-label="Message Body"]').allInnerTexts();
  expect(editors).toEqual(['# first', '# second']);
  await expect(page.locator('[aria-label="Message Body"] h1')).toHaveCount(0);
});
