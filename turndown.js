(function (root) {
  'use strict';

  function process(node) {
    let md = '';
    node.childNodes.forEach(function (child) {
      if (child.nodeType === 3) {
        md += child.textContent;
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        switch (tag) {
          case 'strong': case 'b': md += '**' + process(child) + '**'; break;
          case 'em': case 'i': md += '_' + process(child) + '_'; break;
          case 'br': md += '\n'; break;
          case 'p': md += process(child) + '\n\n'; break;
          case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
            md += '#'.repeat(parseInt(tag.charAt(1), 10)) + ' ' + process(child) + '\n\n';
            break;
          case 'a': md += '[' + process(child) + '](' + (child.getAttribute('href') || '') + ')'; break;
          case 'img': {
            const alt = child.getAttribute('alt') || '';
            if (alt) md += '[image: ' + alt + ']';
            break;
          }
          case 'ul':
            md += Array.from(child.children).map(li => '- ' + process(li)).join('\n') + '\n';
            break;
          case 'ol':
            md += Array.from(child.children).map((li, i) => (i + 1) + '. ' + process(li)).join('\n') + '\n';
            break;
          case 'code': md += '`' + child.textContent + '`'; break;
          case 'pre': {
            const code = child.querySelector('code');
            md += '```\n' + (code || child).textContent + '\n```\n';
            break;
          }
          case 'hr': md += '\n---\n\n'; break;
          case 'blockquote': md += process(child).trim().replace(/^/gm, '> ') + '\n\n'; break;
          case 'script': case 'style': case 'head': break;
          default: md += process(child);
        }
      }
    });
    return md;
  }

  function turndown(html) {
    if (typeof document === 'undefined') throw new Error('TurndownService requires a DOM document');
    const div = document.createElement('div');
    div.innerHTML = String(html || '');
    return process(div).replace(/\n{3,}/g, '\n\n').trim();
  }

  function TurndownService() {}
  TurndownService.prototype.turndown = turndown;

  if (root) root.TurndownService = TurndownService;
  if (typeof module !== 'undefined' && module.exports) module.exports = TurndownService;
})(typeof globalThis !== 'undefined' ? globalThis : this);
