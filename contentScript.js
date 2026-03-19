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
    // Only log if GM_DEBUG is enabled
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
    if (e.key !== ' ' && e.key !== 'Enter') return;
    
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!body.contains(range.startContainer)) return;
    
    let container = range.startContainer;
    let offset = range.startOffset;
    
    if (container.nodeType !== Node.TEXT_NODE) {
      return;
    }
    
    const text = container.textContent;
    const textBefore = text.slice(0, offset);
    
    if (e.key === ' ') {
      const trimmedPrefix = textBefore.trim();
      const isStartOfLine = (textBefore.trimStart() === textBefore);
      
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
      // Trigger horizontal rule on --- + Enter
      if (textBefore.trim() === '---') {
        e.preventDefault();
        deleteBackwards(textBefore.length); // Delete everything before the cursor in this node
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
    // 'marked' is now globally available from manifest content scripts
    if (!emailBody || typeof marked?.parse !== 'function') {
      console.warn('[gmail-md] Marked library not ready');
      return;
    }
    
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (markdownText !== undefined) {
      const html = marked.parse(markdownText, { gfm: opts.gfm });
      document.execCommand('insertHTML', false, html);
      return;
    }

    if (range && emailBody.contains(range.commonAncestorContainer) && selection.toString().trim()) {
      const html = marked.parse(selection.toString(), { gfm: opts.gfm });
      document.execCommand('insertHTML', false, html);
    } else {
      const html = marked.parse(emailBody.innerText, { gfm: opts.gfm });
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
