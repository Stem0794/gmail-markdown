(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GmailMarkdownSecurity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ALLOWED_TAGS = new Set([
    'a', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'input', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'table', 'tbody', 'td', 'tfoot',
    'th', 'thead', 'tr', 'ul'
  ]);
  const DROP_WITH_CONTENT = new Set([
    'base', 'embed', 'form', 'iframe', 'link', 'math', 'meta', 'object', 'script', 'style', 'svg'
  ]);
  const SAFE_ALIGNMENTS = new Set(['left', 'center', 'right']);
  const installedMarked = typeof WeakSet === 'function' ? new WeakSet() : null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isSafeLinkUrl(url) {
    const normalized = String(url || '').trim().replace(/[\u0000-\u0020\u007F]+/g, '');
    const scheme = normalized.match(/^([a-z][a-z0-9+.-]*):/i);
    return !scheme || ['http', 'https', 'mailto'].includes(scheme[1].toLowerCase());
  }

  function sanitizeHtml(html, documentRef) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.createElement !== 'function') {
      throw new Error('sanitizeHtml requires a DOM document');
    }

    const template = doc.createElement('template');
    template.innerHTML = String(html == null ? '' : html);

    function cleanElement(element) {
      Array.from(element.children || []).forEach(cleanElement);
      const tag = element.tagName.toLowerCase();

      if (DROP_WITH_CONTENT.has(tag)) {
        element.remove();
        return;
      }

      if (!ALLOWED_TAGS.has(tag)) {
        const parent = element.parentNode;
        if (!parent) return;
        while (element.firstChild) parent.insertBefore(element.firstChild, element);
        element.remove();
        return;
      }

      const original = {};
      Array.from(element.attributes).forEach(attribute => {
        original[attribute.name.toLowerCase()] = attribute.value;
        element.removeAttribute(attribute.name);
      });

      if (tag === 'a') {
        const href = String(original.href || '').trim();
        if (href && isSafeLinkUrl(href)) element.setAttribute('href', href);
        if (original.title) element.setAttribute('title', original.title);
      } else if (tag === 'ol') {
        if (/^[1-9]\d{0,8}$/.test(original.start || '')) element.setAttribute('start', original.start);
      } else if (tag === 'th' || tag === 'td') {
        const align = String(original.align || '').toLowerCase();
        if (SAFE_ALIGNMENTS.has(align)) element.setAttribute('align', align);
      } else if (tag === 'input') {
        if (String(original.type || '').toLowerCase() !== 'checkbox') {
          element.remove();
          return;
        }
        element.setAttribute('type', 'checkbox');
        element.setAttribute('disabled', '');
        if (Object.prototype.hasOwnProperty.call(original, 'checked')) element.setAttribute('checked', '');
      }
    }

    Array.from(template.content.children).forEach(cleanElement);
    return template.innerHTML;
  }

  function safeImageRenderer(imageOrHref, title, text) {
    const token = imageOrHref && typeof imageOrHref === 'object' ? imageOrHref : null;
    const label = token ? (token.text || '') : (text || '');
    return escapeHtml(label ? `[image: ${label}]` : '[image]');
  }

  function installMarkedSecurity(markedLib, documentRef) {
    if (!markedLib) return false;
    if (installedMarked && installedMarked.has(markedLib)) return true;

    if (markedLib.Renderer && markedLib.Renderer.prototype) {
      markedLib.Renderer.prototype.image = safeImageRenderer;
    }

    if (typeof markedLib.use === 'function') {
      markedLib.use({
        hooks: {
          postprocess(html) {
            return sanitizeHtml(html, documentRef);
          }
        }
      });
    } else {
      return false;
    }

    if (installedMarked) installedMarked.add(markedLib);
    return true;
  }

  if (typeof globalThis !== 'undefined' && globalThis.marked) {
    installMarkedSecurity(globalThis.marked);
  }

  return { escapeHtml, isSafeLinkUrl, sanitizeHtml, safeImageRenderer, installMarkedSecurity };
});
