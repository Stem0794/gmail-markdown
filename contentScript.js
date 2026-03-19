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
    if (container.nodeType !== Node.TEXT_NODE) return;
    const text = container.textContent;
    const textBefore = text.slice(0, idx);

    if (e.key === ' ') {
      const trimmedPrefix = textBefore.trim();
      const isStartOfLine = (idx === textBefore.length) && (textBefore.trimStart().length === textBefore.length);

      if (isStartOfLine) {
        if (trimmedPrefix === '#') {
          e.preventDefault();
          container.textContent = text.slice(idx);
          document.execCommand('formatBlock', false, 'H1');
          return;
        } else if (trimmedPrefix === '##') {
          e.preventDefault();
          container.textContent = text.slice(idx);
          document.execCommand('formatBlock', false, 'H2');
          return;
        } else if (trimmedPrefix === '###') {
          e.preventDefault();
          container.textContent = text.slice(idx);
          document.execCommand('formatBlock', false, 'H3');
          return;
        } else if (trimmedPrefix === '*' || trimmedPrefix === '-') {
          e.preventDefault();
          container.textContent = text.slice(idx);
          document.execCommand('insertUnorderedList');
          return;
        } else if (/^\d+\.$/.test(trimmedPrefix)) {
          e.preventDefault();
          container.textContent = text.slice(idx);
          document.execCommand('insertOrderedList');
          return;
        } else if (trimmedPrefix === '>') {
          e.preventDefault();
          container.textContent = text.slice(idx);
          document.execCommand('formatBlock', false, 'blockquote');
          return;
        }
      }
    }

    const boldMatch = textBefore.match(/(\*\*|__)(.+?)\1$/);
    const italicMatch = textBefore.match(/(\*|_)(.+?)\1$/);
    const strikeMatch = textBefore.match(/~~(.+?)~~$/);
    const codeMatch = textBefore.match(/`(.+?)`$/);

    if (boldMatch) { applyInline(container, idx, boldMatch[0], 'bold', e); return; }
    if (italicMatch) { applyInline(container, idx, italicMatch[0], 'italic', e); return; }
    if (strikeMatch) { applyInline(container, idx, strikeMatch[0], 'strikeThrough', e); return; }
    if (codeMatch) { applyInline(container, idx, codeMatch[0], 'code', e); return; }

    if (e.key === 'Enter') {
       if (textBefore.trim() === '---' && idx === textBefore.length) {
         e.preventDefault();
         container.textContent = text.slice(idx);
         document.execCommand('insertHorizontalRule');
       }
    }
  }

  function applyInline(container, idx, match, command, e) {
    e.preventDefault();
    const text = container.textContent;
    const startIdx = idx - match.length;
    const content = match.replace(/^(\*\*|__|~~|\*|_|`)|(\*\*|__|~~|\*|_|`)$/g, '');

    container.textContent = text.slice(0, startIdx) + text.slice(idx);

    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(container, startIdx);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    if (command === 'code') {
      const html = `<code style="background-color: #f2f2f2; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">${content}</code>\u00A0`;
      document.execCommand('insertHTML', false, html);
    } else {
      document.execCommand('insertHTML', false, content);
      const newSel = window.getSelection();
      const newRange = document.createRange();
      newRange.setStart(container, startIdx);
      newRange.setEnd(container, startIdx + content.length);
      newSel.removeAllRanges();
      newSel.addRange(newRange);
      document.execCommand(command);
      newSel.collapseToEnd();
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
          if (
            document.queryCommandSupported &&
            document.queryCommandSupported('insertHTML')
          ) {
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
