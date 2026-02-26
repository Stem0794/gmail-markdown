(function () {
  function process(node) {
    var md = '';
    node.childNodes.forEach(function (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        md += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        var tag = child.tagName.toLowerCase();
        switch (tag) {
          case 'strong':
          case 'b':
            md += '**' + process(child) + '**';
            break;
          case 'em':
          case 'i':
            md += '_' + process(child) + '_';
            break;
          case 'br':
            md += '\n';
            break;
          case 'p':
            md += process(child) + '\n\n';
            break;
          case 'h1': case 'h2': case 'h3':
          case 'h4': case 'h5': case 'h6':
            var level = parseInt(tag.charAt(1), 10);
            md += '#'.repeat(level) + ' ' + process(child) + '\n\n';
            break;
          case 'a':
            md += '[' + process(child) + '](' + (child.getAttribute('href') || '') + ')';
            break;
          case 'img':
            var alt = child.getAttribute('alt') || '';
            var src = child.getAttribute('src') || '';
            md += '![' + alt + '](' + src + ')';
            break;
          case 'ul':
            md += Array.from(child.children).map(function (li) {
              return '- ' + process(li);
            }).join('\n') + '\n';
            break;
          case 'ol':
            md += Array.from(child.children).map(function (li, i) {
              return (i + 1) + '. ' + process(li);
            }).join('\n') + '\n';
            break;
          case 'code':
            md += '`' + child.textContent + '`';
            break;
          case 'pre':
            var code = child.querySelector('code');
            md += '```\n' + (code || child).textContent + '\n```\n';
            break;
          case 'hr':
            md += '\n---\n\n';
            break;
          case 'blockquote':
            var inner = process(child).trim().replace(/^/gm, '> ');
            md += inner + '\n\n';
            break;
          default:
            md += process(child);
        }
      }
    });
    return md;
  }

  function turndown(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    return process(div).replace(/\n{3,}/g, '\n\n').trim();
  }

  function TurndownService() {}
  TurndownService.prototype.turndown = turndown;

  window.TurndownService = TurndownService;
})();
