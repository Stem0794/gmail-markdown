(function () {
  'use strict';

  var SELECTOR = 'div[aria-label="Message Body"][contenteditable="true"]';

  // Block-level patterns — matched when Enter is pressed
  var BLOCK_PATTERNS = [
    {
      regex: /^(#{1,6})\s+(.+)$/,
      convert: function (m) {
        var level = m[1].length;
        return '<h' + level + '>' + escapeHtml(m[2]) + '</h' + level + '>';
      }
    },
    {
      regex: /^>\s+(.+)$/,
      convert: function (m) {
        return '<blockquote>' + escapeHtml(m[1]) + '</blockquote>';
      }
    },
    {
      regex: /^(---|___|\*\*\*)$/,
      convert: function () {
        return '<hr>';
      }
    }
  ];

  // Inline patterns — matched on input, anchored to cursor position ($)
  var INLINE_PATTERNS = [
    { regex: /\*\*(.+?)\*\*$/, tag: 'strong' },
    { regex: /(?<!\*)\*([^*]+)\*$/, tag: 'em' },
    { regex: /~~(.+?)~~$/, tag: 'del' },
    { regex: /`([^`]+)`$/, tag: 'code' },
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)$/,
      convert: function (m) {
        return '<a href="' + escapeAttr(m[2]) + '">' + escapeHtml(m[1]) + '</a>';
      }
    }
  ];

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // Find the block element the cursor is in (direct child of emailBody)
  function getLineElement(emailBody) {
    var sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return null;
    var node = sel.anchorNode;
    while (node && node !== emailBody) {
      if (node.parentNode === emailBody) return node;
      node = node.parentNode;
    }
    return null;
  }

  function handleEnter(e, emailBody) {
    var lineEl = getLineElement(emailBody);
    if (!lineEl) return;

    var text = lineEl.textContent.trim();

    for (var i = 0; i < BLOCK_PATTERNS.length; i++) {
      var match = text.match(BLOCK_PATTERNS[i].regex);
      if (match) {
        e.preventDefault();
        lineEl.innerHTML = BLOCK_PATTERNS[i].convert(match);

        // Insert a new empty line after the converted block
        var newLine = document.createElement('div');
        newLine.innerHTML = '<br>';
        emailBody.insertBefore(newLine, lineEl.nextSibling);

        // Move cursor to the new line
        var range = document.createRange();
        range.setStart(newLine, 0);
        range.collapse(true);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        emailBody.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }
  }

  function handleInline(emailBody) {
    var sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;

    var node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    if (!emailBody.contains(node)) return;

    var text = node.textContent;
    var offset = sel.anchorOffset;
    var before = text.substring(0, offset);

    for (var i = 0; i < INLINE_PATTERNS.length; i++) {
      var pattern = INLINE_PATTERNS[i];
      var match = pattern.regex.exec(before);
      if (!match) continue;

      var start = match.index;
      var end = start + match[0].length;
      var html;

      if (pattern.convert) {
        html = pattern.convert(match);
      } else {
        html = '<' + pattern.tag + '>' + escapeHtml(match[1]) + '</' + pattern.tag + '>';
      }

      // Select the matched text and replace via execCommand for undo support
      var range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertHTML', false, html + '\u00A0');
      return;
    }
  }

  function attach(emailBody) {
    if (emailBody._mdLiveAttached) return;
    emailBody._mdLiveAttached = true;

    var processing = false;

    emailBody.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        handleEnter(e, emailBody);
      }
    });

    emailBody.addEventListener('input', function () {
      if (processing) return;
      processing = true;
      try {
        handleInline(emailBody);
      } finally {
        processing = false;
      }
    });
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ liveFormat: false }, function (opts) {
      if (!opts.liveFormat) return;

      var existing = document.querySelector(SELECTOR);
      if (existing) attach(existing);

      var observer = new MutationObserver(function () {
        var body = document.querySelector(SELECTOR);
        if (body) attach(body);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
