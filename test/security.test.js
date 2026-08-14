const assert = require('chai').assert;
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const security = require('../markdownSecurity.js');

let marked;
let documentRef;

describe('Markdown security', function() {
  before(async function() {
    ({ marked } = await import('marked'));
    documentRef = new JSDOM('<!doctype html><html><body></body></html>').window.document;
    security.installMarkedSecurity(marked, documentRef);
  });

  it('tests the same Marked version that is vendored for Chrome', function() {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../node_modules/marked/package.json'), 'utf8'));
    assert.equal(packageJson.version, '18.0.9');
  });

  it('removes executable raw HTML', function() {
    const html = marked.parse('<img src=x onerror="globalThis.pwned=1">');
    assert.notInclude(html.toLowerCase(), '<img');
    assert.notInclude(html.toLowerCase(), 'onerror');
  });

  it('blocks the historical image-alt attribute injection vector', function() {
    const html = marked.parse('![" onerror="alert(1)"](https://example.com/404.jpg)');
    const parsed = new JSDOM(html).window.document;
    assert.lengthOf(parsed.querySelectorAll('img'), 0);
    assert.lengthOf(parsed.querySelectorAll('[onerror]'), 0);
    assert.equal(parsed.querySelector('p').textContent, '[image: " onerror="alert(1)"]');
  });

  it('removes unsafe URL schemes while preserving safe links', function() {
    const dirty = '<p><a href="javascript:alert(1)" onclick="alert(1)">bad</a> <a href="https://example.com" target="_blank">good</a></p>';
    const clean = security.sanitizeHtml(dirty, documentRef);
    assert.notInclude(clean, 'javascript:');
    assert.notInclude(clean, 'onclick');
    assert.notInclude(clean, 'target=');
    assert.include(clean, 'href="https://example.com"');
  });

  it('preserves the formatting tags Gmail Markdown needs', function() {
    const clean = security.sanitizeHtml('<h2>Title</h2><ul><li><strong>Item</strong></li></ul><pre><code>x</code></pre>', documentRef);
    assert.equal(clean, '<h2>Title</h2><ul><li><strong>Item</strong></li></ul><pre><code>x</code></pre>');
  });

  it('parses the former link-label ReDoS shape within a bounded time', function() {
    this.timeout(3000);
    const source = '[' + Array.from({ length: 80 }, (_, i) => '````code' + i + '````').join(' ');
    const started = Date.now();
    marked.parse(source);
    assert.isBelow(Date.now() - started, 1500);
  });
});
