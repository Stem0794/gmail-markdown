(function() {
  const DEFAULTS = {
    convertOnPaste: false,
    autoConvert: false,
    autoFormat: true,
    gfm: true,
    sanitize: false,
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

  function replaceEmojis(text) {
    if (typeof window !== 'undefined' && window.replaceEmojis) {
      return window.replaceEmojis(text);
    }
    const map = (typeof window !== 'undefined' && window.EMOJI_MAP) || {};
    return text.replace(/:([a-zA-Z0-9_+-]+):/g, (m, p1) => map[p1] || m);
  }

  function convertLinksToReadable(text) {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
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

  function applyAutoFormat(e, body) {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!body.contains(range.startContainer)) return;
    
    let container = range.startContainer;
    let idx = range.startOffset;
    
    if (container.nodeType !== Node.TEXT_NODE) {
      if (container.childNodes[idx - 1] && container.childNodes[idx - 1].nodeType === Node.TEXT_NODE) {
        container = container.childNodes[idx - 1];
        idx = container.textContent.length;
      } else {
        return;
      }
    }
    
    const text = container.textContent;
    const textBefore = text.slice(0, idx);
    
    debugLog('Auto-format check', { key: e.key, textBefore });

    if (e.key === ' ') {
      const trimmedPrefix = textBefore.trim();
      const isStartOfLine = (textBefore.trimStart() === trimmedPrefix);
      
      if (isStartOfLine) {
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
          debugLog('Applying block format', { command, arg });
          e.preventDefault();
          const delRange = document.createRange();
          delRange.setStart(container, idx - prefixLen);
          delRange.setEnd(container, idx);
          delRange.deleteContents();
          document.execCommand(command, false, arg);
          return;
        }
      }
    }

    const formats = [
      { reg: /(\*\*|__)(.+?)\1$/, cmd: 'bold' },
      { reg: /(\*|_)(.+?)\1$/, cmd: 'italic' },
      { reg: /~~(.+?)~~$/, cmd: 'strikeThrough' },
      { reg: /`(.+?)`$/, cmd: 'code' }
    ];

    for (const format of formats) {
      const match = textBefore.match(format.reg);
      if (match) {
        debugLog('Applying inline format', { cmd: format.cmd, match: match[0] });
        applyInline(container, idx, match[0], format.cmd, e);
        return;
      }
    }

    if (e.key === 'Enter') {
       if (textBefore.trim() === '---' && idx === textBefore.length) {
         e.preventDefault();
         const delRange = document.createRange();
         delRange.setStart(container, idx - 3);
         delRange.setEnd(container, idx);
         delRange.deleteContents();
         document.execCommand('insertHorizontalRule');
       }
    }
  }

  function applyInline(container, idx, match, command, e) {
    e.preventDefault();
    const startIdx = idx - match.length;
    const content = match.replace(/^(\*\*|__|~~|\*|_|`)|(\*\*|__|~~|\*|_|`)$/g, '');
    
    const range = document.createRange();
    range.setStart(container, startIdx);
    range.setEnd(container, idx);
    range.deleteContents();
    
    if (command === 'code') {
      const html = `<code style="background-color: #f2f2f2; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">${content}</code>\u00A0`;
      document.execCommand('insertHTML', false, html);
    } else {
      document.execCommand('insertHTML', false, content);
      const sel = window.getSelection();
      const newRange = document.createRange();
      newRange.setStart(sel.anchorNode, sel.anchorOffset - content.length);
      newRange.setEnd(sel.anchorNode, sel.anchorOffset);
      sel.removeAllRanges();
      sel.addRange(newRange);
      document.execCommand(command);
      sel.collapseToEnd();
      if (e.key === ' ') {
        document.execCommand('insertText', false, ' ');
      } else {
        document.execCommand('insertParagraph');
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
        if (!body.contains(range.startContainer)) return;
        let container = range.startContainer;
        let idx = range.startOffset;
        if (container.nodeType !== Node.TEXT_NODE) {
          if (container.lastChild && container.lastChild.nodeType === Node.TEXT_NODE) {
            container = container.lastChild;
            idx = container.textContent.length;
          } else {
            return;
          }
        }
        const text = container.textContent;
        if (text.slice(idx - 5, idx) === '/note') {
          container.textContent = text.slice(0, idx - 5);
          sel.collapse(container, idx - 5);
          const html =
            '<div class="md-callout" contenteditable="true" ' +
            'style="background:#f2f2f2;padding:8px;border-radius:4px;">' +
            'Important info</div>';
          if (document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
            document.execCommand('insertHTML', false, html);
          } else {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const node = temp.firstChild;
            const r = sel.getRangeAt(0);
            r.insertNode(node);
            r.setStart(node, 0);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
          }
          e.preventDefault();
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

  function loadMarked(cb) {
    if (window.marked) {
      cb();
      return;
    }
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('marked.min.js');
    script.onload = cb;
    script.onerror = () => console.warn('[gmail-md] Failed to load marked library');
    document.documentElement.appendChild(script);
  }

  function getMarkedOpts(opts) {
    return { gfm: opts.gfm };
  }

  function convertMarkdown(opts, markdownText) {
    loadMarked(() => {
      applyTheme(opts.theme);
      const emailBody = getEditable();
      if (!emailBody || typeof marked?.parse !== 'function') return;
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const markedOpts = getMarkedOpts(opts);

      if (markdownText !== undefined) {
        const converted = convertLinksToReadable(markdownText);
        const html = marked.parse(replaceEmojis(converted), markedOpts);
        if (document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
          document.execCommand('insertHTML', false, html);
        } else if (range) {
          const temp = document.createElement('div');
          temp.innerHTML = html;
          range.deleteContents();
          range.insertNode(temp);
        }
        emailBody.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      if (range && emailBody.contains(range.commonAncestorContainer) && selection.toString().trim()) {
        const tempContainer = document.createElement('div');
        const converted = convertLinksToReadable(selection.toString());
        tempContainer.innerHTML = marked.parse(replaceEmojis(converted), markedOpts);
        range.deleteContents();
        range.insertNode(tempContainer);
      } else {
        const converted = convertLinksToReadable(emailBody.innerText);
        const html = marked.parse(replaceEmojis(converted), markedOpts);
        emailBody.innerHTML = html;
      }
      emailBody.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(DEFAULTS, (opts) => {
      applyTheme(opts.theme);
      observeShortcuts(opts);
      if (opts.convertOnPaste) {
        observePaste((text) => convertMarkdown(opts, text));
      }
      if (opts.autoConvert) {
        observeSendButton(() => convertMarkdown(opts));
      }
      if (opts.shortcut) {
        document.addEventListener('keydown', (e) => {
          if (matchesShortcut(e, opts.shortcut)) {
            e.preventDefault();
            convertMarkdown(opts);
          }
        });
      }
    });
  }

  if (typeof module !== 'undefined') {
    module.exports = { convertLinksToReadable, matchesShortcut, applyTheme, observeShortcuts };
  }
})();
