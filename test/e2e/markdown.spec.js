const { test, expect } = require('@playwright/test');
const path = require('path');

const MARKED_JS = path.resolve(__dirname, '../../marked.min.js');
const EMOJI_JS = path.resolve(__dirname, '../../emoji.js');
const CONTENT_JS = path.resolve(__dirname, '../../contentScript.js');
const INJECTOR_JS = path.resolve(__dirname, '../../injector.js');

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

async function setCaretOffset(page, offset) {
  await page.evaluate((caretOffset) => {
    const div = document.querySelector('[aria-label="Message Body"]');
    div.focus();
    const range = document.createRange();
    range.setStart(div.firstChild || div, caretOffset);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }, offset);
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

async function pasteText(page, text) {
  await page.evaluate((pastedText) => {
    const div = document.querySelector('[aria-label="Message Body"]');
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', pastedText);
    div.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    }));
  }, text);
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
  // setAttribute keeps raw hex values (no browser RGB normalisation)
  expect(html).toContain('#f2f2f2');
  expect(html).toContain('#d73a49');
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

test('Tab nests the current bullet item under the previous item', async ({ page }) => {
  await setupPage(page);
  await page.locator(EDITOR).evaluate((editor) => {
    editor.innerHTML = '<ul><li>first line</li><li>second line</li></ul>';
    editor.focus();
    const secondItem = editor.querySelectorAll('li')[1];
    const range = document.createRange();
    range.setStart(secondItem.firstChild, secondItem.textContent.length);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });

  await page.keyboard.press('Tab');

  await expect(page.locator(`${EDITOR} > ul > li`)).toHaveCount(1);
  await expect(page.locator(`${EDITOR} > ul > li > ul > li`)).toHaveText('second line');
});

test('Shift+Tab moves a nested bullet item back to the parent level', async ({ page }) => {
  await setupPage(page);
  await page.locator(EDITOR).evaluate((editor) => {
    editor.innerHTML = '<ul><li>first line<ul><li>second line</li></ul></li></ul>';
    editor.focus();
    const nestedItem = editor.querySelector('ul ul li');
    const range = document.createRange();
    range.setStart(nestedItem.firstChild, nestedItem.textContent.length);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });

  await page.keyboard.press('Shift+Tab');

  await expect(page.locator(`${EDITOR} > ul > li`)).toHaveCount(2);
  await expect(page.locator(`${EDITOR} > ul > li`).filter({ hasText: 'second line' })).toHaveCount(1);
  await expect(page.locator(`${EDITOR} ul ul`)).toHaveCount(0);
});

test('adding a list on a blank line does not merge the following line', async ({ page }) => {
  await setupPage(page);
  await pasteText(page, '\n--');
  await page.evaluate(() => {
    const firstLine = document.querySelector('[aria-label="Message Body"]').firstElementChild;
    const range = document.createRange();
    range.setStart(firstLine, 0);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  await page.keyboard.type('*');
  await page.keyboard.press('Space');

  const state = await page.locator(EDITOR).evaluate((element) => ({
    listItemText: element.querySelector('ul li')?.innerText,
    hasFormattingAnchor: !!element.querySelector('[data-md-empty-anchor]'),
    followingLines: Array.from(element.children)
      .filter((child) => child.tagName === 'DIV')
      .map((child) => child.innerText),
  }));
  expect(state.listItemText.trim()).toBe('');
  expect(state.hasFormattingAnchor).toBe(false);
  expect(state.followingLines).toContain('--');
});

test('adding a space after a pasted bullet marker formats only that line', async ({ page }) => {
  await setupPage(page);
  await pasteText(page, 'test\n*dqdqz\ndqzdqz');
  await page.evaluate(() => {
    const secondLine = document.querySelector('[aria-label="Message Body"]').children[1];
    const range = document.createRange();
    range.setStart(secondLine.firstChild, 1);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  await page.keyboard.press('Space');

  const state = await page.locator(EDITOR).evaluate((element) => ({
    listItemText: element.querySelector('ul li')?.innerText,
    plainLines: Array.from(element.children)
      .filter((child) => child.tagName === 'DIV' && !child.querySelector('ul, ol'))
      .map((child) => child.innerText),
  }));
  expect(state.listItemText).toBe('dqdqz');
  expect(state.plainLines).toEqual(['test', 'dqzdqz']);
});

test('converting an edited pasted line to a bullet keeps it in place', async ({ page }) => {
  await setupPage(page);
  await pasteText(page, [
    '* Description : Capture fixe des dates clés.',
    'Comment tester :',
    'Prendre un nouveau lead (statut Empty).',
    'Le passer en "Pris en charge".',
    'Modifier le statut et revenir en "Pris en charge".',
  ].join('\n'));

  await page.locator(EDITOR).evaluate((editor) => {
    const commentLine = editor.children[1];
    const range = document.createRange();
    range.setStart(commentLine.firstChild, 0);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await page.keyboard.type('*');
  await page.keyboard.press('Space');

  const state = await page.locator(EDITOR).evaluate((editor) => ({
    children: Array.from(editor.children).map((child) => ({
      tag: child.tagName,
      text: child.innerText,
    })),
    listText: editor.querySelector('ul li')?.innerText,
  }));
  expect(state.listText).toBe('Comment tester :');
  expect(state.children[1]).toEqual({ tag: 'UL', text: 'Comment tester :' });
  expect(state.children.slice(2).map((child) => child.text)).toEqual([
    'Prendre un nouveau lead (statut Empty).',
    'Le passer en "Pris en charge".',
    'Modifier le statut et revenir en "Pris en charge".',
  ]);
});

test('auto-formats "1. " into an ordered list item', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '1.');
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} ol li`)).toBeAttached();
});

test('inserting a space after a pasted list-like prefix preserves the text', async ({ page }) => {
  await setupPage(page);
  await pasteText(page, '1.TEST\n2.TEST');
  await page.evaluate(() => {
    const firstLine = document.querySelector('[aria-label="Message Body"]').firstElementChild;
    const range = document.createRange();
    range.setStart(firstLine.firstChild, 2);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} ol`)).toHaveCount(0);
  expect(await page.locator(EDITOR).evaluate((element) => element.innerText))
    .toBe('1. TEST\n2.TEST');
});

test('inserting Enter after a pasted horizontal-rule prefix preserves the text', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '---text');
  await setCaretOffset(page, 3);
  await page.keyboard.press('Enter');

  await expect(page.locator(`${EDITOR} hr`)).toHaveCount(0);
  expect(await page.locator(EDITOR).evaluate((element) => element.innerText))
    .toBe('---\ntext');
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

test('inserting a space after an inline marker with trailing text does not auto-format', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '**hello**world');
  await setCaretOffset(page, 9);
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} span`)).toHaveCount(0);
  await expect(page.locator(EDITOR)).toHaveText('**hello** world');
});

test('inline auto-format preserves HTML-like text as literal content', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '**<img src=x>**');
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} img`)).toHaveCount(0);
  await expect(page.locator(EDITOR)).toContainText('<img src=x>');
});

test('auto-formats "/note " into a callout', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/note');
  await expect(page.locator('[data-md-slash-menu="1"]')).toBeVisible();
  await page.keyboard.press('Space');

  const callout = page.locator(`${EDITOR} .md-callout`);
  await expect(callout).toBeAttached();
  await expect(page.locator('[data-md-slash-menu="1"]')).toHaveCount(0);
  expect(await callout.getAttribute('style')).toContain('background-color:');
});

test('inserting a space after "/note" with trailing text preserves the text', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '/notetext');
  await setCaretOffset(page, 5);
  await page.keyboard.press('Space');

  await expect(page.locator(`${EDITOR} .md-callout`)).toHaveCount(0);
  await expect(page.locator(EDITOR)).toHaveText('/note text');
});

// ─── Slash commands ─────────────────────────────────────────────────────────

test('typing "/" shows every available block command', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/');

  const commands = await page.locator('[data-md-slash-command]').evaluateAll((items) =>
    items.map((item) => item.getAttribute('data-md-slash-command'))
  );
  expect(commands).toEqual([
    'quote',
    'note',
    'h1',
    'h2',
    'h3',
    'bullets',
    'numbered',
    'code',
    'divider',
  ]);
});

test('typing "/quote" shows a filtered slash-command menu outside the email', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/quote');

  const menu = page.locator('[data-md-slash-menu="1"]');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-md-slash-command="quote"]')).toContainText('Quote');
  await expect(menu.locator('[data-md-slash-command="note"]')).toHaveCount(0);
  await expect(page.locator(`${EDITOR} [data-md-slash-menu="1"]`)).toHaveCount(0);
});

test('pressing Enter applies the selected quote slash command', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/quote');
  await page.keyboard.press('Enter');

  await expect(page.locator('[data-md-slash-menu="1"]')).toHaveCount(0);
  await expect(page.locator(`${EDITOR} [data-md-quote="1"]`)).toBeAttached();
  await expect(page.locator(EDITOR)).not.toContainText('/quote');
});

test('clicking a slash-command item applies it at the saved caret', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/');
  await page.locator('[data-md-slash-command="quote"]').click();

  await expect(page.locator('[data-md-slash-menu="1"]')).toHaveCount(0);
  await expect(page.locator(`${EDITOR} [data-md-quote="1"]`)).toBeAttached();
  await expect(page.locator(EDITOR)).not.toContainText('/');
});

test('ArrowDown selects the next slash command before Enter applies it', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(page.locator(`${EDITOR} .md-callout`)).toContainText('Important info');
  await expect(page.locator(`${EDITOR} [data-md-quote="1"]`)).toHaveCount(0);
});

test('ArrowDown scrolls the selected slash command into view', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/');

  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('ArrowDown');
  }

  const state = await page.locator('[data-md-slash-menu="1"]').evaluate((menu) => {
    const selected = menu.querySelector('[aria-selected="true"]');
    const menuRect = menu.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    return {
      command: selected.getAttribute('data-md-slash-command'),
      activeDescendant: menu.getAttribute('aria-activedescendant'),
      selectedId: selected.id,
      scrollTop: menu.scrollTop,
      isVisible: selectedRect.top >= menuRect.top && selectedRect.bottom <= menuRect.bottom,
    };
  });

  expect(state.command).toBe('divider');
  expect(state.scrollTop).toBeGreaterThan(0);
  expect(state.isVisible).toBe(true);
  expect(state.activeDescendant).toBe(state.selectedId);
});

test('Escape closes the slash-command menu without changing the typed text', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/quote');
  await page.keyboard.press('Escape');

  await expect(page.locator('[data-md-slash-menu="1"]')).toHaveCount(0);
  await expect(page.locator(EDITOR)).toHaveText('/quote');
});

for (const command of [
  { name: 'h1', selector: 'h1' },
  { name: 'h2', selector: 'h2' },
  { name: 'h3', selector: 'h3' },
  { name: 'bullets', selector: 'ul li' },
  { name: 'numbered', selector: 'ol li' },
  { name: 'code', selector: '[data-md-code="1"] pre' },
]) {
  test(`/${command.name} inserts an editable ${command.name} block`, async ({ page }) => {
    await setupPage(page);
    await page.keyboard.type(`/${command.name}`);
    await page.keyboard.press('Enter');
    await page.keyboard.type('Example');

    await expect(page.locator(`${EDITOR} ${command.selector}`)).toHaveText('Example');
    await expect(page.locator(EDITOR)).not.toContainText(`/${command.name}`);
  });
}

for (const heading of ['h1', 'h2', 'h3']) {
  test(`/${heading} uses the editor formatBlock command`, async ({ page }) => {
    await setupPage(page);
    await page.evaluate(() => {
      const originalExecCommand = document.execCommand.bind(document);
      window.__mdExecCommands = [];
      document.execCommand = (command, showUI, value) => {
        window.__mdExecCommands.push({ command, value });
        return originalExecCommand(command, showUI, value);
      };
    });

    await page.keyboard.type(`/${heading}`);
    await page.keyboard.press('Enter');

    const commands = await page.evaluate(() => window.__mdExecCommands);
    expect(commands).toContainEqual({
      command: 'formatBlock',
      value: heading.toUpperCase(),
    });
  });
}

test('/h1 remains larger than body text after typing begins', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/h1');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Example');

  const fontSizes = await page.locator(EDITOR).evaluate((editor) => ({
    body: Number.parseFloat(getComputedStyle(editor).fontSize),
    h1: Number.parseFloat(getComputedStyle(editor.querySelector('h1')).fontSize),
  }));
  expect(fontSizes.h1).toBeGreaterThan(fontSizes.body);
});

test('/divider inserts a horizontal rule and moves typing to the following line', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/divider');
  await page.keyboard.press('Enter');
  await page.keyboard.type('After');

  await expect(page.locator(`${EDITOR} hr`)).toBeAttached();
  await expect(page.locator(EDITOR)).toContainText('After');
  await expect(page.locator(EDITOR)).not.toContainText('/divider');
});

test('legacy heading names remain searchable aliases', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/title');

  const menu = page.locator('[data-md-slash-menu="1"]');
  await expect(menu.locator('[data-md-slash-command="h1"]')).toBeVisible();
  await expect(menu.locator('[data-md-slash-command]')).toHaveCount(1);
});

test('moving the caret away from a slash command closes the stale menu', async ({ page }) => {
  await setupPage(page);
  await page.keyboard.type('/quote');
  await expect(page.locator('[data-md-slash-menu="1"]')).toBeVisible();
  await page.keyboard.press('Home');

  await expect(page.locator('[data-md-slash-menu="1"]')).toHaveCount(0);
  await expect(page.locator(EDITOR)).toHaveText('/quote');
});

// ─── Paste handling ───────────────────────────────────────────────────────────

test('plain-text paste normalizes Windows and legacy Mac line endings', async ({ page }) => {
  await setupPage(page);
  await pasteText(page, 'first\r\nsecond\rthird');

  expect(await page.locator(EDITOR).evaluate((element) => element.innerText))
    .toBe('first\nsecond\nthird');
});

test('plain-text paste keeps HTML-like content literal', async ({ page }) => {
  await setupPage(page);
  await pasteText(page, '<img src=x>');

  await expect(page.locator(`${EDITOR} img`)).toHaveCount(0);
  await expect(page.locator(EDITOR)).toHaveText('<img src=x>');
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

test('Ctrl+Shift+M keeps raw HTML literal while converting Markdown', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '**safe** <img src=x> <javascript:alert(1)>');
  await page.keyboard.press('Control+Shift+M');

  await expect(page.locator(`${EDITOR} strong`)).toBeAttached();
  await expect(page.locator(`${EDITOR} img`)).toHaveCount(0);
  await expect(page.locator(`${EDITOR} a[href^="javascript:"]`)).toHaveCount(0);
  await expect(page.locator(EDITOR)).toContainText('<img src=x>');
});

test('Ctrl+Shift+M preserves safe HTTPS autolinks', async ({ page }) => {
  await setupPage(page);
  await setEditorText(page, '<https://example.com>');
  await page.keyboard.press('Control+Shift+M');

  await expect(page.locator(`${EDITOR} a[href="https://example.com"]`)).toBeAttached();
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

test('convert-on-paste keeps raw HTML literal while converting Markdown', async ({ page }) => {
  await setupPage(page, { convertOnPaste: true });
  await pasteText(page, '**safe** <img src=x> <javascript:alert(1)>');

  await expect(page.locator(`${EDITOR} strong`)).toBeAttached();
  await expect(page.locator(`${EDITOR} img`)).toHaveCount(0);
  await expect(page.locator(`${EDITOR} a[href^="javascript:"]`)).toHaveCount(0);
  await expect(page.locator(EDITOR)).toContainText('<img src=x>');
});

test('context-menu injector keeps raw HTML literal while converting Markdown', async ({ page }) => {
  await page.setContent(
    '<!DOCTYPE html><html><body>' +
    '<div aria-label="Message Body" contenteditable="true">' +
    '**safe** &lt;img src=x&gt; &lt;javascript:alert(1)&gt;</div>' +
    '</body></html>'
  );
  await page.addScriptTag({
    content: `window.chrome = {
      storage: { sync: { get: (_d, cb) => cb({ gfm: true }) } }
    };`,
  });
  await page.addScriptTag({ path: MARKED_JS });
  await page.addScriptTag({ path: INJECTOR_JS });

  await expect(page.locator(`${EDITOR} strong`)).toBeAttached();
  await expect(page.locator(`${EDITOR} img`)).toHaveCount(0);
  await expect(page.locator(`${EDITOR} a[href^="javascript:"]`)).toHaveCount(0);
  await expect(page.locator(EDITOR)).toContainText('<img src=x>');
});

// ─── Auto-format disabled ─────────────────────────────────────────────────────

test('auto-format can be disabled via options', async ({ page }) => {
  await setupPage(page, { autoFormat: false });
  await setEditorText(page, '#');
  await page.keyboard.press('Space');

  const html = await page.locator(EDITOR).innerHTML();
  expect(html).not.toContain('<h1>');
});
