(function () {
  'use strict';

  var SELECTOR = 'div[aria-label="Message Body"][contenteditable="true"]';
  var BLOCKQUOTE_INLINE_STYLE = 'border-left:4px solid #ccc;padding-left:24px !important;color:#555;margin:0.5em 0;background:none;';
  var PRE_WRAPPER_STYLE = 'background-color:#f7f6f3;border-radius:3px;padding:12px 16px;margin:1em 0;';
  var PRE_CODE_STYLE = 'font-family:SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;font-size:0.85em;white-space:pre-wrap;color:#333;margin:0;padding:0;display:block;';
  var INLINE_CODE_STYLE = 'background-color:#f2f2f2;color:#d73a49;padding:2px 4px;border-radius:3px;font-family:monospace;';
  var MAX_ATTEMPTS = 50;
  var attempts = 0;

  function gmailifyHtml(html) {
    return html
      .replace(/<blockquote[^>]*>/gi, '<div style="' + BLOCKQUOTE_INLINE_STYLE + '">')
      .replace(/<\/blockquote>/gi, '</div>')
      .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '<div style="' + PRE_WRAPPER_STYLE + '"><pre style="' + PRE_CODE_STYLE + '">$1</pre></div>')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '<code style="' + INLINE_CODE_STYLE + '">$1</code>')
      .replace(/<p>([\s\S]*?)<\/p>/g, '<div>$1</div>')
      .replace(/(<br>)+$/, '');
  }

  function replaceEmojis(text) {
    if (typeof window !== 'undefined' && window.replaceEmojis) {
      return window.replaceEmojis(text);
    }
    return text;
  }

  function convertLinksToReadable(text) {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  }

  var interval = setInterval(function () {
    var emailBody = document.querySelector(SELECTOR);

    if (emailBody && typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      clearInterval(interval);

      chrome.storage.sync.get({ gfm: true }, function (opts) {
        var markedOpts = { gfm: opts.gfm };
        var selection = window.getSelection();
        var range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        const process = (text) => {
          const withEmojis = replaceEmojis(text);
          return convertLinksToReadable(withEmojis);
        };

        if (range && emailBody.contains(range.commonAncestorContainer)) {
          var selectedText = selection.toString();
          if (selectedText.trim()) {
            var tempContainer = document.createElement('div');
            tempContainer.innerHTML = gmailifyHtml(marked.parse(process(selectedText), markedOpts));
            range.deleteContents();
            while (tempContainer.firstChild) {
              range.insertNode(tempContainer.firstChild);
              range.collapse(false);
            }
          }
        } else {
          var markdown = emailBody.innerText;
          var html = gmailifyHtml(marked.parse(process(markdown), markedOpts));
          emailBody.innerHTML = html;
        }

        emailBody.dispatchEvent(new Event('input', { bubbles: true }));
      });
    } else {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(interval);
        console.warn('[gmail-md] Timed out waiting for email body or marked library');
      }
    }
  }, 300);
  
  if (typeof module !== 'undefined') {
    module.exports = {
      replaceEmojis,
      convertLinksToReadable,
      gmailifyHtml,
    };
  }
})();
