(function () {
  'use strict';

  var SELECTOR = 'div[aria-label="Message Body"][contenteditable="true"]';
  var MAX_ATTEMPTS = 50;
  var attempts = 0;

  var interval = setInterval(function () {
    var emailBody = document.querySelector(SELECTOR);
    if (emailBody && typeof TurndownService !== 'undefined') {
      clearInterval(interval);
      var selection = window.getSelection();
      var range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      var td = new TurndownService();

      if (range && emailBody.contains(range.commonAncestorContainer) && selection.toString().trim()) {
        var frag = range.cloneContents();
        var div = document.createElement('div');
        div.appendChild(frag);
        var md = td.turndown(div.innerHTML);
        range.deleteContents();
        range.insertNode(document.createTextNode(md));
        range.collapse(false);
      } else {
        var md = td.turndown(emailBody.innerHTML);
        emailBody.innerText = md;
      }

      emailBody.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(interval);
        console.warn('[gmail-md] Timed out waiting for email body or TurndownService');
      }
    }
  }, 300);
})();
