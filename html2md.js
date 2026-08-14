(function (root) {
  'use strict';

  const SELECTOR = 'div[aria-label="Message Body"][contenteditable="true"]';

  function getActiveEditable() {
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

  function convertHtmlToMarkdown() {
    const emailBody = getActiveEditable();
    if (!emailBody || typeof root.TurndownService !== 'function') return false;

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const td = new root.TurndownService();

    if (range && emailBody.contains(range.commonAncestorContainer) && selection.toString().trim()) {
      const fragment = range.cloneContents();
      const container = document.createElement('div');
      container.appendChild(fragment);
      const markdown = td.turndown(container.innerHTML);
      range.deleteContents();
      range.insertNode(document.createTextNode(markdown));
      range.collapse(false);
    } else {
      emailBody.innerText = td.turndown(emailBody.innerHTML);
    }

    emailBody.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  root.gmailMarkdownConvertHtmlToMarkdown = convertHtmlToMarkdown;
  if (typeof module !== 'undefined' && module.exports) module.exports = { convertHtmlToMarkdown };
})(typeof globalThis !== 'undefined' ? globalThis : this);
