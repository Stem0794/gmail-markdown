(function() {
  const DEFAULTS = {
    convertOnPaste: false,
    autoConvert: false,
    autoFormat: true,
    gfm: true,
    theme: 'default',
    shortcut: 'Ctrl+Shift+M',
    disableDefault: false
  };

  const SELECTOR = 'div[aria-label="Message Body"][contenteditable="true"]';

  function debugLog(...args) {
    if (window.GM_DEBUG) console.log('[gmail-md]', ...args);
  }

  function getEditable() {
    return document.querySelector(SELECTOR);
  }

  function convertLinksToReadable(text) {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  }

  function applyTheme(theme) {
    const id = 'md-theme-style';
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.documentElement.appendChild(style);
    }
    const sel = 'div[aria-label="Message Body"][contenteditable="true"]';
    const base = `
        ${sel} > div, ${sel} > p { margin: 0 !important; padding: 0 !important; }
    `;
    const themes = {
      default: `
        ${sel} h1 { font-size: 1.4em !important; font-weight: bold !important; margin: 0.6em 0 !important; }
        ${sel} h2 { font-size: 1.2em !important; font-weight: bold !important; margin: 0.5em 0 !important; }
        ${sel} h3 { font-size: 1.1em !important; font-weight: bold !important; margin: 0.4em 0 !important; }
        ${sel} blockquote { border-left: 4px solid #ccc !important; padding-left: 10px !important; color: #555 !important; margin: 0.5em 0 !important; background: none !important; }
      `,
      strong: `
        ${sel} h1 { font-size: 1.4em !important; font-weight: bold !important; text-transform: uppercase !important; margin: 0.6em 0 !important; }
        ${sel} h2 { font-size: 1.2em !important; font-weight: bold !important; text-transform: uppercase !important; margin: 0.5em 0 !important; }
        ${sel} h3 { font-size: 1.1em !important; font-weight: bold !important; text-transform: uppercase !important; margin: 0.4em 0 !important; }
        ${sel} blockquote { border-left: 4px solid #ccc !important; padding-left: 10px !important; color: #555 !important; margin: 0.5em 0 !important; background: none !important; }
      `
    };
    style.textContent = base + (themes[theme] || themes.default);
  }

  function deleteBackwards(count) {
    for (let i = 0; i < count; i++) {
      document.execCommand('delete', false, null);
    }
  }

  function isCursorAtBlockStart(range, block) {
    try {
      const testRange = document.createRange();
      testRange.setStart(block, 0);
      testRange.setEnd(range.startContainer, range.startOffset);
      return testRange.toString().length === 0;
    } catch (e) {
      return false;
    }
  }

  function replaceBlockWithDiv(block) {
    const isPreBlock = block.tagName === 'PRE';
    const div = document.createElement('div');
    if (isPreBlock) {
      block.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    }
    while (block.firstChild) div.appendChild(block.firstChild);
    if (!div.hasChildNodes()) div.innerHTML = '<br>';
    block.parentNode.replaceChild(div, block);
    const s = window.getSelection();
    if (isPreBlock) {
      const contentRange = document.createRange();
      contentRange.selectNodeContents(div);
      s.removeAllRanges();
      s.addRange(contentRange);
      document.execCommand('removeFormat');
    }
    const newRange = document.createRange();
    newRange.setStart(div, 0);
    newRange.collapse(true);
    s.removeAllRanges();
    s.addRange(newRange);
    div.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false }));
  }

  function insertCodeBlock(body) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    const pre = document.createElement('pre');
    pre.style.cssText = 'background:#f7f6f3;border-radius:3px;padding:12px 16px;font-family:SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;font-size:0.85em;white-space:pre-wrap;margin:4px 0;color:#333;';

    let blockEl = range.startContainer;
    if (blockEl.nodeType === Node.TEXT_NODE) blockEl = blockEl.parentNode;
    while (blockEl && blockEl !== body && blockEl.parentNode !== body) {
      blockEl = blockEl.parentNode;
    }

    if (blockEl && blockEl !== body) {
      blockEl.parentNode.replaceChild(pre, blockEl);
    } else {
      body.appendChild(pre);
    }

    const emptyDiv = document.createElement('div');
    emptyDiv.innerHTML = '<br>';
    pre.parentNode.insertBefore(emptyDiv, pre.nextSibling);

    const newRange = document.createRange();
    newRange.setStart(pre, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    pre.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false }));
  }

  function insertLineAfterHR(body) {
    const hrs = body.querySelectorAll('hr');
    if (!hrs.length) return;
    const hr = hrs[hrs.length - 1];
    const emptyDiv = document.createElement('div');
    emptyDiv.innerHTML = '<br>';
    hr.parentNode.insertBefore(emptyDiv, hr.nextSibling);
    const newRange = document.createRange();
    newRange.setStart(emptyDiv, 0);
    newRange.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  function applyAutoFormat(e, body) {
    if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Backspace') return;

    // Handle Backspace: remove block formatting when at the start of a formatted block
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!body.contains(range.startContainer)) return;

      let node = range.startContainer;

      // Find the closest block element first
      let block = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
      while (block && block !== body && !block.matches('h1, h2, h3, h4, h5, h6, blockquote, li, pre')) {
        block = block.parentNode;
      }

      if (!block || block === body) {
        // Chrome sometimes reports cursor at body[0] instead of inside the first child
        if (node === body && range.startOffset === 0) {
          const firstChild = body.childNodes[0];
          if (firstChild && firstChild.nodeType === Node.ELEMENT_NODE &&
              firstChild.matches('h1, h2, h3, h4, h5, h6, blockquote, pre')) {
            e.preventDefault();
            replaceBlockWithDiv(firstChild);
          }
        }
        return;
      }

      if (!isCursorAtBlockStart(range, block)) return;

      const tag = block.tagName;

      if (/^H[1-6]$/.test(tag)) {
        e.preventDefault();
        replaceBlockWithDiv(block);
      } else if (tag === 'BLOCKQUOTE') {
        e.preventDefault();
        replaceBlockWithDiv(block);
      } else if (tag === 'PRE') {
        e.preventDefault();
        replaceBlockWithDiv(block);
      } else if (tag === 'LI') {
        const list = block.closest('ul, ol');
        if (list) {
          e.preventDefault();
          if (list.tagName === 'UL') {
            document.execCommand('insertUnorderedList', false, null);
          } else {
            document.execCommand('insertOrderedList', false, null);
          }
        }
      }
      return;
    }

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!body.contains(range.startContainer)) return;

    let container = range.startContainer;
    let offset = range.startOffset;

    if (container.nodeType !== Node.TEXT_NODE) {
      if (container.childNodes[offset - 1] && container.childNodes[offset - 1].nodeType === Node.TEXT_NODE) {
        container = container.childNodes[offset - 1];
        offset = container.textContent.length;
      } else {
        return;
      }
    }

    const text = container.textContent;
    const textBefore = text.slice(0, offset);

    if (e.key === ' ') {
      const trimmedPrefix = textBefore.trim();
      const isStartOfLine = (textBefore.trimStart() === textBefore);

      // Handle --- + space as horizontal rule
      if (trimmedPrefix === '---') {
        e.preventDefault();
        deleteBackwards(textBefore.length);
        document.execCommand('insertHorizontalRule');
        insertLineAfterHR(body);
        return;
      }

      if (/^[\s\u200B\u200C\u200D\uFEFF]*`{3}$/.test(textBefore)) {
        e.preventDefault();
        deleteBackwards(textBefore.length);
        insertCodeBlock(body);
        return;
      }

      if (isStartOfLine && trimmedPrefix.length > 0) {
        let command = null;
        let arg = null;
        let prefixLen = 0;

        if (trimmedPrefix === '#') { command = 'formatBlock'; arg = 'H1'; prefixLen = 1; }
        else if (trimmedPrefix === '##') { command = 'formatBlock'; arg = 'H2'; prefixLen = 2; }
        else if (trimmedPrefix === '###') { command = 'formatBlock'; arg = 'H3'; prefixLen = 3; }
        else if (trimmedPrefix === '*' || trimmedPrefix === '-') { command = 'insertUnorderedList'; prefixLen = 1; }
        else if (/^\d+\.$/.test(trimmedPrefix)) { command = 'insertOrderedList'; prefixLen = trimmedPrefix.length; }
        else if (trimmedPrefix === '>') { command = 'formatBlock'; arg = 'blockquote'; prefixLen = 1; }

        if (command) {
          e.preventDefault();
          deleteBackwards(prefixLen);
          document.execCommand(command, false, arg);
          // Add an empty line after the formatted block
          if (command === 'formatBlock') {
            // Move cursor to end of current content, then insert a paragraph after
            const currentSel = window.getSelection();
            if (currentSel.rangeCount) {
              const currentRange = currentSel.getRangeAt(0);
              let blockEl = currentRange.startContainer;
              if (blockEl.nodeType === Node.TEXT_NODE) blockEl = blockEl.parentNode;
              while (blockEl && blockEl !== body && !blockEl.matches('h1, h2, h3, h4, h5, h6, blockquote')) {
                blockEl = blockEl.parentNode;
              }
              if (blockEl && blockEl !== body) {
                const emptyDiv = document.createElement('div');
                emptyDiv.innerHTML = '<br>';
                blockEl.parentNode.insertBefore(emptyDiv, blockEl.nextSibling);
              }
            }
          }
          return;
        }
      }

      const formats = [
        { reg: /(\*\*|__)(.+?)\1$/, cmd: 'bold' },
        { reg: /(\*|_)(.+?)\1$/, cmd: 'italic' },
        { reg: /~~(.+?)~~$/, cmd: 'strikeThrough' },
        { reg: /`(.+?)`$/, cmd: 'code' }
      ];

      for (const f of formats) {
        const match = textBefore.match(f.reg);
        if (match) {
          e.preventDefault();
          const fullMatch = match[0];
          const content = match[2] || match[1] || fullMatch.replace(/^(\*\*|__|~~|\*|_|`)|(\*\*|__|~~|\*|_|`)$/g, '');
          
          deleteBackwards(fullMatch.length);
          
          if (f.cmd === 'code') {
            const html = `<code style="background-color: #f2f2f2; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">${content}</code>\u00A0`;
            document.execCommand('insertHTML', false, html);
          } else {
            let style = '';
            if (f.cmd === 'bold') style = 'font-weight:bold;';
            else if (f.cmd === 'italic') style = 'font-style:italic;';
            else if (f.cmd === 'strikeThrough') style = 'text-decoration:line-through;';
            
            const html = `<span style="${style}">${content}</span>\u00A0`;
            document.execCommand('insertHTML', false, html);
          }
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      if (textBefore.trim() === '---') {
        e.preventDefault();
        deleteBackwards(textBefore.length);
        document.execCommand('insertHorizontalRule');
        insertLineAfterHR(body);
        return;
      }

      if (/^[\s\u200B\u200C\u200D\uFEFF]*`{3}$/.test(textBefore)) {
        e.preventDefault();
        deleteBackwards(textBefore.length);
        insertCodeBlock(body);
        return;
      }

      // Exit code block when Enter is pressed on an empty line inside <pre>
      let preEl = container.parentNode;
      while (preEl && preEl !== body && preEl.tagName !== 'PRE') {
        preEl = preEl.parentNode;
      }
      if (preEl && preEl !== body && preEl.tagName === 'PRE') {
        const lastNl = textBefore.lastIndexOf('\n');
        const currentLine = lastNl >= 0 ? textBefore.slice(lastNl + 1) : textBefore;
        if (currentLine === '') {
          e.preventDefault();
          if (container.nodeType === Node.TEXT_NODE && container.textContent.endsWith('\n')) {
            container.textContent = container.textContent.slice(0, -1);
          }
          let afterEl = preEl.nextSibling;
          if (!afterEl) {
            afterEl = document.createElement('div');
            afterEl.innerHTML = '<br>';
            preEl.parentNode.insertBefore(afterEl, preEl.nextSibling);
          }
          const exitRange = document.createRange();
          exitRange.setStart(afterEl, 0);
          exitRange.collapse(true);
          const exitSel = window.getSelection();
          exitSel.removeAllRanges();
          exitSel.addRange(exitRange);
          return;
        }
      }
    }
  }

  function observeShortcuts(opts) {
    function attachListener(body) {
      applyTheme(opts.theme);
      if (body._mdShortcutsAttached) return;
      body._mdShortcutsAttached = true;
      body.addEventListener('keydown', (e) => {
        if (opts.autoFormat) {
          applyAutoFormat(e, body);
        }

        if (e.key !== ' ' && e.key !== 'Enter') return;
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        let container = range.startContainer;
        let offset = range.startOffset;
        
        if (container.nodeType !== Node.TEXT_NODE) {
          if (container.childNodes[offset - 1] && container.childNodes[offset - 1].nodeType === Node.TEXT_NODE) {
            container = container.childNodes[offset - 1];
            offset = container.textContent.length;
          } else {
            return;
          }
        }
        
        const text = container.textContent;
        if (text.slice(offset - 5, offset) === '/note') {
          e.preventDefault();
          deleteBackwards(5);
          const html = '<div class="md-callout" style="background:#f2f2f2;padding:8px;border-radius:4px;margin:8px 0;">Important info</div>';
          document.execCommand('insertHTML', false, html);
        }
      });
    }
    const existing = getEditable();
    if (existing) attachListener(existing);
    const observer = new MutationObserver(() => {
      const body = getEditable();
      if (body) attachListener(body);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function matchesShortcut(e, combo) {
    const parts = combo.toLowerCase().split('+');
    const key = parts.pop();
    const ctrl = parts.includes('ctrl');
    const shift = parts.includes('shift');
    const alt = parts.includes('alt');
    const meta = parts.includes('meta') || parts.includes('cmd');
    return e.key.toLowerCase() === key &&
           e.ctrlKey === ctrl &&
           e.shiftKey === shift &&
           e.altKey === alt &&
           e.metaKey === meta;
  }

  function observePaste(convertOnPaste, callback) {
    function attachListener(body) {
      if (body._mdPasteAttached) return;
      body._mdPasteAttached = true;
      body.addEventListener('paste', (e) => {
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        e.preventDefault();
        if (convertOnPaste) {
          callback(text);
        } else {
          // Insert as plain text wrapped in <div> elements to match Gmail's native structure.
          // Using <br> instead would corrupt Gmail's contenteditable state, causing it to
          // switch from <div> to <p> elements for subsequent lines (which have margin spacing).
          const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const lines = escaped.split('\n');
          const html = lines.map(line => `<div>${line || '<br>'}</div>`).join('');
          document.execCommand('insertHTML', false, html);
        }
      }, true);
    }
    const existing = getEditable();
    if (existing) attachListener(existing);
    const observer = new MutationObserver(() => {
      const body = getEditable();
      if (body) attachListener(body);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function observeSendButton(callback) {
    function attachListener(btn) {
      if (btn._mdSendAttached) return;
      btn._mdSendAttached = true;
      btn.addEventListener('click', () => callback(), true);
    }
    const observer = new MutationObserver(() => {
      const btn = document.querySelector('div[aria-label^="Send"]');
      if (btn) attachListener(btn);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function replaceEmojis(text) {
    const emojiLib = window.replaceEmojis || (typeof replaceEmojis !== 'undefined' ? replaceEmojis : null);
    if (typeof emojiLib === 'function') return emojiLib(text);
    return text;
  }

  // Convert Marked's block-level paragraph tags to <br> line breaks
  // so spacing matches Gmail's native contenteditable behavior
  function gmailifyHtml(html) {
    return html
      .replace(/<p>([\s\S]*?)<\/p>/g, '<div>$1</div>')
      .replace(/(<br>)+$/, ''); // strip trailing <br>
  }

  function convertMarkdown(opts, markdownText) {
    applyTheme(opts.theme);
    const emailBody = getEditable();
    const markedLib = window.marked || (typeof marked !== 'undefined' ? marked : null);
    if (!emailBody || !markedLib || typeof markedLib.parse !== 'function') {
      console.warn('[gmail-md] Marked library not ready');
      return;
    }

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    const process = (text) => {
      const withEmojis = replaceEmojis(text);
      return convertLinksToReadable(withEmojis);
    };

    if (markdownText !== undefined) {
      const html = gmailifyHtml(markedLib.parse(process(markdownText), { gfm: opts.gfm }));
      document.execCommand('insertHTML', false, html);
      return;
    }

    if (range && emailBody.contains(range.commonAncestorContainer) && selection.toString().trim()) {
      const html = gmailifyHtml(markedLib.parse(process(selection.toString()), { gfm: opts.gfm }));
      document.execCommand('insertHTML', false, html);
    } else {
      const html = gmailifyHtml(markedLib.parse(process(emailBody.innerText), { gfm: opts.gfm }));
      emailBody.innerHTML = html;
    }
    emailBody.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(DEFAULTS, (opts) => {
      applyTheme(opts.theme);
      observeShortcuts(opts);
      observePaste(opts.convertOnPaste, (text) => convertMarkdown(opts, text));
      if (opts.autoConvert) observeSendButton(() => convertMarkdown(opts));
      
      document.addEventListener('keydown', (e) => {
        if (opts.shortcut && matchesShortcut(e, opts.shortcut)) {
          e.preventDefault();
          convertMarkdown(opts);
        }
      });
    });
  }

  if (typeof module !== 'undefined') {
    module.exports = {
      convertLinksToReadable,
      matchesShortcut,
      applyTheme,
      convertMarkdown,
      observeShortcuts
    };
  }
})();
