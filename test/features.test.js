const { assert } = require('chai');
const { JSDOM } = require('jsdom');

// setup helper to load the contentScript with JSDOM environment
function loadScript(html = '<div aria-label="Message Body" contenteditable="true"></div>') {
  const dom = new JSDOM(`<!DOCTYPE html>${html}`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.Node = dom.window.Node;
  global.MutationObserver = class { constructor(cb){} observe(){} disconnect(){} };
  global.chrome = { runtime: { getURL: p => p }, storage: { sync: { get: (_d, cb) => cb({}) } } };
  return require('../contentScript.js');
}

describe('Extension features', function() {
  it('converts markdown links to readable text', function() {
    const { convertLinksToReadable } = loadScript();
    const result = convertLinksToReadable('See [Google](https://google.com)');
    assert.equal(result, 'See Google (https://google.com)');
  });

  it('matches keyboard shortcuts', function() {
    const { matchesShortcut } = loadScript();
    const e = { key: 'M', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false };
    assert.isTrue(matchesShortcut(e, 'Ctrl+Shift+M'));
    assert.isFalse(matchesShortcut(e, 'Ctrl+M'));
  });

  it('applies theme styles to the document', function() {
    const script = loadScript();
    script.applyTheme('strong');
    const style = document.getElementById('md-theme-style');
    assert.exists(style);
    assert.include(style.textContent, 'text-transform: uppercase !important;');
  });

  it('gmailifyHtml converts blockquote to styled div so formatting survives email send', function() {
    const { gmailifyHtml } = loadScript();
    const input = '<blockquote><p>hello</p></blockquote>';
    const output = gmailifyHtml(input);
    // <blockquote> replaced with styled <div> (Gmail strips styles from <blockquote>)
    assert.notInclude(output, '<blockquote');
    assert.include(output, 'border-left:4px solid #ccc');
    assert.include(output, '<div style="');
    // <p> inside should also be converted to <div>
    assert.include(output, '<div>hello</div>');
  });

  it('contentScript does not use background shorthand (Gmail strips it)', function() {
    const fs = require('fs');
    const src = fs.readFileSync(require('path').join(__dirname, '../contentScript.js'), 'utf8');
    // background shorthand (e.g. background:#xxx or background: #xxx) should not appear
    // as an inline style value — use background-color instead so Gmail preserves it.
    assert.notMatch(src, /style[^"]*background\s*:#/);
  });

});
