'use strict';

const { assert } = require('chai');
const { JSDOM } = require('jsdom');

// ─── Setup helpers ───────────────────────────────────────────────────────────

function loadScript(html = '') {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.Node = dom.window.Node;
  global.MutationObserver = class { constructor() {} observe() {} disconnect() {} };
  delete require.cache[require.resolve('../threadCopy.js')];
  return require('../threadCopy.js');
}

/** Build a minimal Gmail-style .gs message element. */
function msg({ name = '', email = '', date = '', body = '', collapsed = false, sig = '', quote = '' } = {}) {
  return `
    <div class="gs">
      <div class="gE">
        ${name  ? `<span class="go">${name}</span>` : ''}
        ${email ? `<span email="${email}" class="gD">${email}</span>` : ''}
        ${date  ? `<span class="g3" title="${date}">...</span>` : ''}
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('threadCopy', function () {

  // ── htmlToMarkdown ─────────────────────────────────────────────────────────

  describe('htmlToMarkdown()', function () {
    let htmlToMarkdown;

    before(function () {
      ({ htmlToMarkdown } = loadScript());
    });

    it('passes plain text through unchanged', function () {
      const el = document.createElement('div');
      el.innerHTML = '<div>Hello world</div>';
      assert.equal(htmlToMarkdown(el), 'Hello world');
    });

    it('converts <strong> to **bold**', function () {
      const el = document.createElement('div');
      el.innerHTML = '<strong>bold</strong>';
      assert.include(htmlToMarkdown(el), '**bold**');
    });

    it('converts <em> to _italic_', function () {
      const el = document.createElement('div');
      el.innerHTML = '<em>italic</em>';
      assert.include(htmlToMarkdown(el), '_italic_');
    });

    it('converts <h1>–<h3> to # heading markers', function () {
      const el = document.createElement('div');
      el.innerHTML = '<h1>One</h1><h2>Two</h2><h3>Three</h3>';
      const md = htmlToMarkdown(el);
      assert.match(md, /^# One/m);
      assert.match(md, /^## Two/m);
      assert.match(md, /^### Three/m);
    });

    it('converts <a href> to [text](url)', function () {
      const el = document.createElement('div');
      el.innerHTML = '<a href="https://example.com">click here</a>';
      assert.include(htmlToMarkdown(el), '[click here](https://example.com)');
    });

    it('converts <ul> to a - bulleted list', function () {
      const el = document.createElement('div');
      el.innerHTML = '<ul><li>First</li><li>Second</li></ul>';
      const md = htmlToMarkdown(el);
      assert.include(md, '- First');
      assert.include(md, '- Second');
    });

    it('converts <ol> to a numbered list', function () {
      const el = document.createElement('div');
      el.innerHTML = '<ol><li>Alpha</li><li>Beta</li></ol>';
      const md = htmlToMarkdown(el);
      assert.include(md, '1. Alpha');
      assert.include(md, '2. Beta');
    });

    it('wraps <code> in backticks', function () {
      const el = document.createElement('div');
      el.innerHTML = '<code>x = 42</code>';
      assert.include(htmlToMarkdown(el), '`x = 42`');
    });

    it('wraps <pre><code> in a fenced code block', function () {
      const el = document.createElement('div');
      el.innerHTML = '<pre><code>const x = 1;</code></pre>';
      const md = htmlToMarkdown(el);
      assert.include(md, '```');
      assert.include(md, 'const x = 1;');
    });

    it('prefixes <blockquote> lines with >', function () {
      const el = document.createElement('div');
      el.innerHTML = '<blockquote>quoted text</blockquote>';
      assert.match(htmlToMarkdown(el), /^> quoted text/m);
    });

    it('converts a <table> to a pipe-delimited Markdown table with separator row', function () {
      const el = document.createElement('div');
      el.innerHTML = '<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>';
      const md = htmlToMarkdown(el);
      assert.include(md, '| Name | Age |');
      assert.include(md, '| --- | --- |');
      assert.include(md, '| Alice | 30 |');
    });

    it('drops <script> and <style> content entirely', function () {
      const el = document.createElement('div');
      el.innerHTML = '<script>alert(1)</script><style>.x{}</style><div>visible</div>';
      const md = htmlToMarkdown(el);
      assert.notInclude(md, 'alert');
      assert.notInclude(md, '.x{}');
      assert.include(md, 'visible');
    });

    it('collapses three or more consecutive blank lines into a single blank line', function () {
      const el = document.createElement('div');
      el.innerHTML = '<div>a</div><div></div><div></div><div></div><div>b</div>';
      assert.notMatch(htmlToMarkdown(el), /\n{3,}/);
    });
  });

  // ── extractThread ──────────────────────────────────────────────────────────

  describe('extractThread()', function () {

    it('uses the h2.hP text as an H1 heading at the top of the output', function () {
      const { extractThread } = loadScript(
        '<h2 class="hP">Project Update</h2>' +
        msg({ name: 'Alice', body: '<div>Hello</div>' })
      );
      assert.match(extractThread(), /^# Project Update/);
    });

    it('includes the sender name and email address', function () {
      const { extractThread } = loadScript(
        '<h2 class="hP">Subject</h2>' +
        msg({ name: 'Bob Jones', email: 'bob@example.com', body: '<div>Hi</div>' })
      );
      assert.include(extractThread(), '**From:** Bob Jones <bob@example.com>');
    });

    it('uses the title attribute of .g3 as the message date', function () {
      const { extractThread } = loadScript(
        '<h2 class="hP">Subject</h2>' +
        msg({ name: 'Alice', date: 'Mon, Jan 1, 2024 at 9:00 AM', body: '<div>Hi</div>' })
      );
      assert.include(extractThread(), '**Date:** Mon, Jan 1, 2024 at 9:00 AM');
    });

    it('includes the plain text body of the message', function () {
      const { extractThread } = loadScript(
        '<h2 class="hP">Subject</h2>' +
        msg({ name: 'Alice', body: '<div>This is the body text.</div>' })
      );
      assert.include(extractThread(), 'This is the body text.');
    });

    it('separates multiple messages with a --- horizontal rule', function () {
      const { extractThread } = loadScript(
        '<h2 class="hP">Subject</h2>' +
        msg({ name: 'Alice', body: '<div>First</div>' }) +
        msg({ name: 'Bob',   body: '<div>Second</div>' })
      );
      assert.include(extractThread(), '---');
    });

    it('preserves message order — earliest message appears before later ones', function () {
      const { extractThread } = loadScript(
        '<h2 class="hP">Subject</h2>' +
        msg({ name: 'Alice', body: '<div>First message</div>' }) +
        msg({ name: 'Bob',   body: '<div>Second message</div>' })
      );
      const md = extractThread();
      assert.isBelow(md.indexOf('First message'), md.indexOf('Second message'));
    });

    it('skips a message whose body is empty after stripping', function () {
      const { extractThread } = loadScript(
        '<h2 class="hP">Subject</h2>' +
        msg({ name: 'Alice', sig: 'Signature only — no real body' })
      );
      assert.notInclude(extractThread(), '**From:** Alice');
    });

    it('returns only the subject when the thread has no messages', function () {
      const { extractThread } = loadScript('<h2 class="hP">No replies yet</h2>');
      assert.equal(extractThread(), '# No replies yet');
    });

    it('returns an empty string when there is no subject and no messages', function () {
      const { extractThread } = loadScript();
      assert.equal(extractThread(), '');
    });

    // ── Stripping unwanted content ───────────────────────────────────────────

    describe('when the message contains unwanted content', function () {

      it('removes .gmail_signature so sign-offs are not included', function () {
        const { extractThread } = loadScript(
          '<h2 class="hP">S</h2>' +
          msg({ name: 'Alice', body: '<div>Body</div>', sig: 'John Doe | CEO' })
        );
        assert.notInclude(extractThread(), 'John Doe | CEO');
      });

      it('removes .gmail_quote so previous replies are not duplicated', function () {
        const { extractThread } = loadScript(
          '<h2 class="hP">S</h2>' +
          msg({ name: 'Alice', body: '<div>Reply</div>', quote: 'Original quoted text' })
        );
        assert.notInclude(extractThread(), 'Original quoted text');
      });

      it('removes .gmail_quote_container (the show/hide toggle and its nested quote)', function () {
        const { extractThread } = loadScript(
          '<h2 class="hP">S</h2>' +
          `<div class="gs"><div class="gE"></div><div class="adn"><div class="a3s">
            <div>Body text</div>
            <div class="gmail_quote_container"><span>…</span><div class="gmail_quote">nested hidden</div></div>
          </div></div></div>`
        );
        assert.notInclude(extractThread(), 'nested hidden');
      });

      it('removes .gmail_attr (the "On [date] X wrote:" attribution line)', function () {
        const { extractThread } = loadScript(
          '<h2 class="hP">S</h2>' +
          `<div class="gs"><div class="gE"></div><div class="adn"><div class="a3s">
            <div>Body text</div>
            <div class="gmail_attr">On Mon, Alice wrote:</div>
          </div></div></div>`
        );
        assert.notInclude(extractThread(), 'On Mon, Alice wrote:');
      });

      it('removes .gmail_extra (footer extras sometimes added by Gmail)', function () {
        const { extractThread } = loadScript(
          '<h2 class="hP">S</h2>' +
          `<div class="gs"><div class="gE"></div><div class="adn"><div class="a3s">
            <div>Body text</div>
            <div class="gmail_extra">extra footer content</div>
          </div></div></div>`
        );
        assert.notInclude(extractThread(), 'extra footer content');
      });

      it('does not modify the original DOM — stripping is done on a clone', function () {
        const { extractThread } = loadScript(
          '<h2 class="hP">S</h2>' +
          msg({ name: 'Alice', body: '<div>Body</div>', sig: 'My Signature' })
        );
        extractThread();
        assert.exists(document.querySelector('.gmail_signature'),
          'Original .gmail_signature should remain in the DOM after extraction');
      });
    });
  });

  // ── isCollapsed ────────────────────────────────────────────────────────────

  describe('isCollapsed()', function () {

    it('returns false for an expanded message whose .adn container is visible', function () {
      const { isCollapsed } = loadScript(
        '<div class="gs"><div class="adn"><div class="a3s">body</div></div></div>'
      );
      assert.isFalse(isCollapsed(document.querySelector('.gs')));
    });

    it('returns true when .adn has display:none (Gmail collapsed state)', function () {
      const { isCollapsed } = loadScript(
        '<div class="gs"><div class="adn" style="display:none"><div class="a3s">body</div></div></div>'
      );
      assert.isTrue(isCollapsed(document.querySelector('.gs')));
    });

    it('returns true when .adn has visibility:hidden', function () {
      const { isCollapsed } = loadScript(
        '<div class="gs"><div class="adn" style="visibility:hidden"><div class="a3s">body</div></div></div>'
      );
      assert.isTrue(isCollapsed(document.querySelector('.gs')));
    });

    it('returns false when there is no .adn but .a3s is present directly', function () {
      const { isCollapsed } = loadScript(
        '<div class="gs"><div class="a3s">body</div></div>'
      );
      assert.isFalse(isCollapsed(document.querySelector('.gs')));
    });

    it('returns true when the message has no .adn and no .a3s (summary-only state)', function () {
      const { isCollapsed } = loadScript(
        '<div class="gs"><div class="gE">summary only</div></div>'
      );
      assert.isTrue(isCollapsed(document.querySelector('.gs')));
    });
  });

  // ── injectButton ───────────────────────────────────────────────────────────

  describe('injectButton()', function () {

    beforeEach(function () {
      loadScript('<h2 class="hP">Subject</h2>');
    });

    it('inserts a button into the DOM', function () {
      assert.exists(document.getElementById('md-copy-thread-btn'));
    });

    it('places the button as the next sibling of the h2.hP subject heading', function () {
      const h2 = document.querySelector('h2.hP');
      assert.equal(h2.nextElementSibling.id, 'md-copy-thread-btn');
    });

    it('labels the button "Copy thread as Markdown"', function () {
      assert.equal(document.getElementById('md-copy-thread-btn').textContent, 'Copy thread as Markdown');
    });

    it('does not create a duplicate button when called a second time', function () {
      const { injectButton } = require('../threadCopy.js');
      injectButton();
      assert.lengthOf(document.querySelectorAll('#md-copy-thread-btn'), 1);
    });

    it('does nothing when there is no h2.hP subject heading in the DOM', function () {
      loadScript(''); // no h2.hP
      assert.isNull(document.getElementById('md-copy-thread-btn'));
    });
  });
});
