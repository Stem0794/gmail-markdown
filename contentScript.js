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
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('themes.css');
      document.documentElement.appendChild(link);
    }
    const body = getEditable();
    if (body) {
      body.classList.remove('md-theme-clean', 'md-theme-notion', 'md-theme-email');
      body.classList.add('md-theme-' + theme);
    }
  }

  function deleteBackwards(count) {
    for (let i = 0; i < count; i++) {
      document.execCommand('delete', false, null);
    }
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
      let atStart = false;

      // Check if cursor is at the very start of the block
      if (node.nodeType === Node.TEXT_NODE) {
        if (range.startOffset !== 0) return;
        // Walk up to see if we're truly at the start (no preceding content)
        let n = node;
        while (n && n !== body) {
          if (n.previousSibling) { return; }
          n = n.parentNode;
        }
        atStart = true;
      } else {
        if (range.startOffset !== 0) return;
        atStart = true;
      }

      if (!atStart) return;

      // Find the closest block element
      let block = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
      while (block && block !== body && !block.matches('h1, h2, h3, h4, h5, h6, blockquote, li')) {
        block = block.parentNode;
      }

      if (!block || block === body) return;

      const tag = block.tagName;

      if (/^H[1-6]$/.test(tag)) {
        e.preventDefault();
        document.execCommand('formatBlock', false, 'div');
      } else if (tag === 'BLOCKQUOTE') {
        e.preventDefault();
        document.execCommand('formatBlock', false, 'div');
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
      }
    }
  }

  function observeShortcuts(opts) {
    function attachListener(body) {
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
