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
  delete require.cache[require.resolve('../contentScript.js')];
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

  it('contentScript does not use other CSS properties commonly stripped by Gmail', function() {
    const fs = require('fs');
    const src = fs.readFileSync(require('path').join(__dirname, '../contentScript.js'), 'utf8');
    
    // Gmail strips Flexbox and CSS Grid
    assert.notMatch(src, /style[^='"]*display\s*:\s*(flex|grid)/i, 'Should not use display: flex or grid in inline styles');
    
    // Gmail often strips position absolute and fixed
    assert.notMatch(src, /style[^='"]*position\s*:\s*(absolute|fixed)/i, 'Should not use position: absolute or fixed in inline styles');
    
    // Gmail strips negative margins
    assert.notMatch(src, /style[^='"]*margin[^:]*:\s*-[0-9]/i, 'Should not use negative margins in inline styles');
    
    // Gmail strips float
    assert.notMatch(src, /style[^='"]*float\s*:/i, 'Should not use float in inline styles');
  });

  it('applyTheme does not include blockquote rules (to avoid list subitem styling conflicts)', function() {
    const script = loadScript();
    script.applyTheme('default');
    const style = document.getElementById('md-theme-style');
    assert.notInclude(style.textContent, 'blockquote {');
    
    script.applyTheme('bold');
    assert.notInclude(style.textContent, 'blockquote {');
  });

  it('gmailifyHtml implements text wrapping in code blocks', function() {
    const { gmailifyHtml } = loadScript();
    const input = '<pre><code>long_unbroken_text_that_should_wrap</code></pre>';
    const output = gmailifyHtml(input);
    assert.include(output, 'word-break:break-word');
    assert.include(output, 'overflow-wrap:anywhere');
    assert.include(output, 'overflow-x:auto');
  });

  it('captures Tab key in lists and prevents default behavior', function() {
    // We need to trigger the window listener added in the chrome.storage callback
    const html = `
      <div aria-label="Message Body" contenteditable="true">
        <ul>
          <li><span id="target">Item</span></li>
        </ul>
      </div>
    `;
    loadScript(html);
    
    const target = document.getElementById('target');
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    sel.removeAllRanges();
    sel.addRange(range);

    // Mock execCommand
    let commandCalled = null;
    document.execCommand = (cmd) => { commandCalled = cmd; };

    const event = new window.KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    });
    
    // Dispatching on window since the listener is on window (capturing)
    window.dispatchEvent(event);

    assert.isTrue(event.defaultPrevented, 'Tab event should be prevented in list');
    assert.equal(commandCalled, 'indent');
  });
});
