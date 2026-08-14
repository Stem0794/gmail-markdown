(function () {
  'use strict';

  const SELECTOR = 'div[aria-label="Message Body"][contenteditable="true"]';
  const DEFAULTS = { shortcut: 'Ctrl+Shift+M' };
  let options = { ...DEFAULTS };
  let lastTrustedMarkdownShortcutAt = 0;

  function getActiveEditor() {
    const active = document.activeElement;
    if (active && active.matches && active.matches(SELECTOR)) return active;

    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      let node = selection.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      return node && node.closest ? node.closest(SELECTOR) : null;
    }
    return null;
  }

  function shortcutParts(combo) {
    const parts = String(combo || '').toLowerCase().split('+').map(part => part.trim()).filter(Boolean);
    const key = parts.pop() || '';
    return {
      key,
      ctrlKey: parts.includes('ctrl'),
      shiftKey: parts.includes('shift'),
      altKey: parts.includes('alt'),
      metaKey: parts.includes('meta') || parts.includes('cmd')
    };
  }

  function matchesShortcut(event, combo) {
    const shortcut = shortcutParts(combo);
    return event.key.toLowerCase() === shortcut.key &&
      event.ctrlKey === shortcut.ctrlKey &&
      event.shiftKey === shortcut.shiftKey &&
      event.altKey === shortcut.altKey &&
      event.metaKey === shortcut.metaKey;
  }

  function dispatchMarkdownShortcut() {
    const editor = getActiveEditor();
    if (!editor) return false;
    editor.focus();
    const shortcut = shortcutParts(options.shortcut);
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: shortcut.key,
      ctrlKey: shortcut.ctrlKey,
      shiftKey: shortcut.shiftKey,
      altKey: shortcut.altKey,
      metaKey: shortcut.metaKey,
      bubbles: true,
      cancelable: true
    }));
    return true;
  }

  // Prevent the content script's first-editor fallback from formatting an unrelated draft
  // when the shortcut is pressed outside a compose editor.
  document.addEventListener('keydown', event => {
    if (!matchesShortcut(event, options.shortcut)) return;
    if (event.isTrusted && getActiveEditor()) {
      lastTrustedMarkdownShortcutAt = Date.now();
      return;
    }
    if (!getActiveEditor()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(DEFAULTS, stored => { options = { ...options, ...stored }; });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.shortcut) options.shortcut = changes.shortcut.newValue || DEFAULTS.shortcut;
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'gmail-md:convert-markdown') {
      // If the browser also delivered the trusted key event to Gmail, avoid converting twice.
      const handledByPage = Date.now() - lastTrustedMarkdownShortcutAt < 250;
      const ok = handledByPage || dispatchMarkdownShortcut();
      sendResponse({ ok });
      return;
    }

    if (message.type === 'gmail-md:convert-html-markdown') {
      const convert = window.gmailMarkdownConvertHtmlToMarkdown;
      const ok = typeof convert === 'function' ? convert() : false;
      sendResponse({ ok });
    }
  });
})();
