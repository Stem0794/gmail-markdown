(function() {
  const DEFAULTS = {
    convertOnPaste: false,
    autoConvert: false,
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
    // marked v9+ removed the sanitize option; only pass gfm
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
    module.exports = { convertLinksToReadable, matchesShortcut, applyTheme };
  }
})();
