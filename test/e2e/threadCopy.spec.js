const { test, expect } = require('@playwright/test');
const path = require('path');

const THREAD_COPY_JS = path.resolve(__dirname, '../../threadCopy.js');

// ─── Setup helpers ───────────────────────────────────────────────────────────

/** Build one .gs message element matching Gmail's thread DOM structure. */
function buildMessage({ name = '', email = '', date = '', body = '', collapsed = false, sig = '', quote = '' } = {}) {
  return `
    <div class="gs">
      <div class="gE">
        ${name  ? `<span class="go">${name}</span>` : ''}
        ${email ? `<span email="${email}" class="gD">${email}</span>` : ''}
        ${date  ? `<span class="g3" title="${date}">date display</span>` : ''}
      </div>
      <div class="adn"${collapsed ? ' style="display:none"' : ''}>
        <div class="a3s">
          ${body}
          ${sig   ? `<div class="gmail_signature">${sig}</div>`   : ''}
          ${quote ? `<div class="gmail_quote">${quote}</div>`     : ''}
        </div>
      </div>
    </div>`;
}

/**
 * Load a mock Gmail thread page and inject threadCopy.js into it.
 *
 * - navigator.clipboard.writeText is replaced with a no-network mock that
 *   stores the last written string in window._lastCopied.
 * - A delegated click listener simulates Gmail's expand behaviour: clicking
 *   any .gE trigger inside a .gs removes display:none from the sibling .adn.
 */
async function setupThreadPage(page, { subject = 'Test Thread', messages = [] } = {}) {
  const messagesHtml = messages.map(buildMessage).join('\n');
  await page.setContent(
    `<!DOCTYPE html><html><body>
      ${subject ? `<h2 class="hP">${subject}</h2>` : ''}
      ${messagesHtml}
    </body></html>`
  );

  // Must be added before threadCopy.js so the overrides are in place when the
  // script initialises and when the button click fires.
  await page.addScriptTag({
    content: `
      window._lastCopied = null;

      // Replace clipboard API with an in-page capture
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (text) => { window._lastCopied = text; } },
        configurable: true
      });

      // Simulate Gmail's expand behaviour: clicking .gE reveals the hidden .adn
      document.addEventListener('click', (e) => {
        const trigger = e.target && e.target.closest('.gE, .aio, .ade');
        if (trigger) {
          const gs = trigger.closest('.gs');
          const adn = gs && gs.querySelector('.adn');
          if (adn) adn.style.removeProperty('display');
        }
      }, true);
    `,
  });

  await page.addScriptTag({ path: THREAD_COPY_JS });
}

/** Click the button and wait until the clipboard has been written. */
async function clickAndWaitForCopy(page) {
  await page.locator('#md-copy-thread-btn').click();
  await page.waitForFunction(() => window._lastCopied !== null, { timeout: 5000 });
  return page.evaluate(() => window._lastCopied);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Copy Thread as Markdown button', () => {

  // ── Presence ───────────────────────────────────────────────────────────────

  test.describe('button injection', () => {
    test('is added to the page after the subject heading when a thread is open', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Hello',
        messages: [{ name: 'Alice', body: '<div>Hi</div>' }],
      });
      await expect(page.locator('#md-copy-thread-btn')).toBeAttached();
    });

    test('appears immediately after the h2.hP subject element', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Hello',
        messages: [{ name: 'Alice', body: '<div>Hi</div>' }],
      });
      const isNextSibling = await page.evaluate(() => {
        const h2  = document.querySelector('h2.hP');
        const btn = document.getElementById('md-copy-thread-btn');
        return h2 && btn && h2.nextElementSibling === btn;
      });
      expect(isNextSibling).toBe(true);
    });

    test('is not injected when there is no h2.hP subject heading', async ({ page }) => {
      await setupThreadPage(page, { subject: '', messages: [] });
      await expect(page.locator('#md-copy-thread-btn')).not.toBeAttached();
    });
  });

  // ── Single expanded message ─────────────────────────────────────────────────

  test.describe('when the thread has a single expanded message', () => {
    test('copies the thread subject as an H1 Markdown heading', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Project Update',
        messages: [{ name: 'Alice', email: 'alice@example.com', body: '<div>Hello team</div>' }],
      });
      const copied = await clickAndWaitForCopy(page);
      expect(copied).toContain('# Project Update');
    });

    test('copies the sender name and email address', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Subject',
        messages: [{ name: 'Bob Jones', email: 'bob@example.com', body: '<div>Hi</div>' }],
      });
      const copied = await clickAndWaitForCopy(page);
      expect(copied).toContain('**From:** Bob Jones <bob@example.com>');
    });

    test('copies the message date', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Subject',
        messages: [{
          name: 'Alice',
          date: 'Mon, Jan 1, 2024 at 9:00 AM',
          body: '<div>Hi</div>',
        }],
      });
      const copied = await clickAndWaitForCopy(page);
      expect(copied).toContain('**Date:** Mon, Jan 1, 2024 at 9:00 AM');
    });

    test('copies the message body text', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Subject',
        messages: [{ name: 'Alice', body: '<div>This is the message body.</div>' }],
      });
      const copied = await clickAndWaitForCopy(page);
      expect(copied).toContain('This is the message body.');
    });
  });

  // ── Collapsed messages ──────────────────────────────────────────────────────

  test.describe('when the thread contains collapsed messages', () => {
    test('expands collapsed messages and includes their content', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Subject',
        messages: [
          { name: 'Alice', body: '<div>Older reply</div>', collapsed: true },
          { name: 'Bob',   body: '<div>Latest reply</div>' },
        ],
      });
      const copied = await clickAndWaitForCopy(page);
      expect(copied).toContain('Older reply');
      expect(copied).toContain('Latest reply');
    });

    test('shows "Expanding thread…" on the button while processing', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Subject',
        messages: [
          { name: 'Alice', body: '<div>Old</div>', collapsed: true },
          { name: 'Bob',   body: '<div>New</div>' },
        ],
      });

      // Capture the label synchronously right after click, before the 600ms wait resolves
      const labelDuringExpansion = await page.evaluate(async () => {
        const btn = document.getElementById('md-copy-thread-btn');
        btn.click();
        // Read the label on the next microtask — before setTimeout(600) resolves
        await Promise.resolve();
        return btn.textContent;
      });
      expect(labelDuringExpansion).toBe('Expanding thread…');
    });
  });

  // ── Content stripping ──────────────────────────────────────────────────────

  test.describe('when the message contains unwanted content', () => {
    test('omits the email signature from the copied output', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Subject',
        messages: [{
          name: 'Alice',
          body: '<div>Real body</div>',
          sig: 'Alice Smith | Director',
        }],
      });
      const copied = await clickAndWaitForCopy(page);
      expect(copied).toContain('Real body');
      expect(copied).not.toContain('Alice Smith | Director');
    });

    test('omits quoted replies from the copied output', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Subject',
        messages: [{
          name: 'Bob',
          body: '<div>My reply</div>',
          quote: 'Original message text that was quoted',
        }],
      });
      const copied = await clickAndWaitForCopy(page);
      expect(copied).toContain('My reply');
      expect(copied).not.toContain('Original message text that was quoted');
    });
  });

  // ── Multi-message thread ───────────────────────────────────────────────────

  test.describe('when the thread has multiple messages', () => {
    test('includes all messages separated by --- dividers', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Discussion',
        messages: [
          { name: 'Alice', body: '<div>First</div>' },
          { name: 'Bob',   body: '<div>Second</div>' },
          { name: 'Carol', body: '<div>Third</div>' },
        ],
      });
      const copied = await clickAndWaitForCopy(page);
      expect(copied).toContain('First');
      expect(copied).toContain('Second');
      expect(copied).toContain('Third');
      // Two separators for three messages
      const separatorCount = (copied.match(/^---$/gm) || []).length;
      expect(separatorCount).toBe(2);
    });

    test('lists messages in document order — earliest first', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Subject',
        messages: [
          { name: 'Alice', body: '<div>Earliest</div>' },
          { name: 'Bob',   body: '<div>Latest</div>' },
        ],
      });
      const copied = await clickAndWaitForCopy(page);
      expect(copied.indexOf('Earliest')).toBeLessThan(copied.indexOf('Latest'));
    });
  });

  // ── Button feedback ────────────────────────────────────────────────────────

  test.describe('button feedback after copying', () => {
    test('shows "Copied!" after a successful copy', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Subject',
        messages: [{ name: 'Alice', body: '<div>Hi</div>' }],
      });
      await clickAndWaitForCopy(page);
      await expect(page.locator('#md-copy-thread-btn')).toHaveText('Copied!');
    });

    test('restores the original label after the feedback timeout', async ({ page }) => {
      await setupThreadPage(page, {
        subject: 'Subject',
        messages: [{ name: 'Alice', body: '<div>Hi</div>' }],
      });
      await clickAndWaitForCopy(page);
      // Wait for the 2 s revert timeout
      await page.waitForFunction(
        () => document.getElementById('md-copy-thread-btn').textContent === 'Copy thread as Markdown',
        { timeout: 5000 }
      );
      await expect(page.locator('#md-copy-thread-btn')).toHaveText('Copy thread as Markdown');
    });
  });
});
