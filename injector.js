(function () {
  'use strict';

  var SELECTOR = 'div[aria-label="Message Body"][contenteditable="true"]';
  var MAX_ATTEMPTS = 50;
  var attempts = 0;

  function replaceEmojis(text) {
    if (typeof window !== 'undefined' && window.replaceEmojis) {
      return window.replaceEmojis(text);
    }
    return text;
  }

  var interval = setInterval(function () {
    var emailBody = document.querySelector(SELECTOR);

    if (emailBody && typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      clearInterval(interval);

      chrome.storage.sync.get({ gfm: true }, function (opts) {
        var markedOpts = { gfm: opts.gfm };
        var selection = window.getSelection();
        var range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        if (range && emailBody.contains(range.commonAncestorContainer)) {
          var selectedText = selection.toString();
          if (selectedText.trim()) {
            var tempContainer = document.createElement('div');
            tempContainer.innerHTML = marked.parse(replaceEmojis(selectedText), markedOpts);
            range.deleteContents();
            while (tempContainer.firstChild) {
              range.insertNode(tempContainer.firstChild);
              range.collapse(false);
            }
          }
        } else {
          var markdown = emailBody.innerText;
          var html = marked.parse(replaceEmojis(markdown), markedOpts);
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
})();
