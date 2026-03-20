(function() {
  const DEFAULTS = {
    convertOnPaste: false,
    autoConvert: false,
    autoFormat: true,
    gfm: true,
    theme: 'clean',
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

  function applyTheme(theme) {
    const id = 'md-theme-style';
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.documentElement.appendChild(style);
    }
    const sel = 'div[aria-label="Message Body"][contenteditable="true"]';
    const themes = {
      clean: `
        ${sel} h1 { font-size: 1.4em !important; font-weight: bold !important; margin: 0.6em 0 !important; }
        ${sel} h2 { font-size: 1.2em !important; font-weight: bold !important; margin: 0.5em 0 !important; }
        ${sel} h3 { font-size: 1.1em !important; font-weight: bold !important; margin: 0.4em 0 !important; }
        ${sel} blockquote { border-left: 4px solid #ccc !important; padding-left: 10px !important; color: #555 !important; margin: 0.5em 0 !important; background: none !important; }
      `,
      notion: `
        ${sel} h1 { font-size: 1.5em !important; font-weight: bold !important; margin: 1em 0 0.4em !important; }
        ${sel} h2 { font-size: 1.25em !important; font-weight: bold !important; margin: 0.9em 0 0.3em !important; }
        ${sel} h3 { font-size: 1.1em !important; font-weight: bold !important; margin: 0.8em 0 0.3em !important; }
        ${sel} blockquote { border-left: 3px solid #9b9b9b !important; padding-left: 12px !important; color: #333 !important; background: #fafafa !important; margin: 0.5em 0 !important; }
      `,
      email: `
        ${sel} h1 { font-size: 1em !important; font-weight: bold !important; margin: 0.8em 0 !important; }
        ${sel} h2 { font-size: 1em !important; font-weight: bold !important; margin: 0.8em 0 !important; }
        ${sel} h3 { font-size: 1em !important; font-weight: bold !important; margin: 0.8em 0 !important; }
        ${sel} blockquote { border-left: 4px solid #ccc !important; padding-left: 8px !important; color: #000 !important; background: none !important; margin: 0.8em 0 !important; }
      `
    };
    style.textContent = themes[theme] || themes.clean;
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
    const div = document.createElement('div');
    while (block.firstChild) div.appendChild(block.firstChild);
    if (!div.hasChildNodes()) div.innerHTML = '<br>';
    block.parentNode.replaceChild(div, block);
    const newRange = document.createRange();
    newRange.setStart(div, 0);
    newRange.collapse(true);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(newRange);
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
      while (block && block !== body && !block.matches('h1, h2, h3, h4, h5, h6, blockquote, li')) {
        block = block.parentNode;
      }

      if (!block || block === body) {
        // Chrome sometimes reports cursor at body[0] instead of inside the first child
        if (node === body && range.startOffset === 0) {
          const firstChild = body.childNodes[0];
          if (firstChild && firstChild.nodeType === Node.ELEMENT_NODE &&
              firstChild.matches('h1, h2, h3, h4, h5, h6, blockquote')) {
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

  function observePaste(callback) {
    function attachListener(body) {
      if (body._mdPasteAttached) return;
      body._mdPasteAttached = true;
      body.addEventListener('paste', (e) => {
        const text = e.clipboardData.getData('text/plain');
        if (text) {
          e.preventDefault();
          callback(text);
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

    if (markdownText !== undefined) {
      const html = markedLib.parse(markdownText, { gfm: opts.gfm });
      document.execCommand('insertHTML', false, html);
      return;
    }

    if (range && emailBody.contains(range.commonAncestorContainer) && selection.toString().trim()) {
      const html = markedLib.parse(selection.toString(), { gfm: opts.gfm });
      document.execCommand('insertHTML', false, html);
    } else {
      const html = markedLib.parse(emailBody.innerText, { gfm: opts.gfm });
      emailBody.innerHTML = html;
    }
    emailBody.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(DEFAULTS, (opts) => {
      applyTheme(opts.theme);
      observeShortcuts(opts);
      if (opts.convertOnPaste) observePaste((text) => convertMarkdown(opts, text));
      if (opts.autoConvert) observeSendButton(() => convertMarkdown(opts));
      
      document.addEventListener('keydown', (e) => {
        if (opts.shortcut && matchesShortcut(e, opts.shortcut)) {
          e.preventDefault();
          convertMarkdown(opts);
        }
      });
    });
  }
})();
