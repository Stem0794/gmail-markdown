(function () {
  const BTN_ID = 'md-copy-thread-btn';

  // --- HTML to Markdown conversion ---

  function processTable(tableEl) {
    const rows = Array.from(tableEl.querySelectorAll('tr'));
    if (!rows.length) return '';
    const cellText = row =>
      Array.from(row.querySelectorAll('th, td'))
        .map(cell => processNode(cell).trim().replace(/\n/g, ' ').replace(/\|/g, '\\|'));
    const headers = cellText(rows[0]);
    let md = '| ' + headers.join(' | ') + ' |\n';
    md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    rows.slice(1).forEach(row => { md += '| ' + cellText(row).join(' | ') + ' |\n'; });
    return md + '\n';
  }

  function processNode(node) {
    let md = '';
    node.childNodes.forEach(function (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        md += child.textContent;
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const tag = child.tagName.toLowerCase();
      switch (tag) {
        case 'strong': case 'b': {
          const inner = processNode(child).trim();
          md += inner ? '**' + inner + '**' : '';
          break;
        }
        case 'em': case 'i': {
          const inner = processNode(child).trim();
          md += inner ? '_' + inner + '_' : '';
          break;
        }
        case 'br':
          md += '\n';
          break;
        case 'p':
          md += processNode(child).trim() + '\n\n';
          break;
        case 'div': {
          const inner = processNode(child).trim();
          md += inner ? inner + '\n' : '\n';
          break;
        }
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
          const level = parseInt(tag[1], 10);
          md += '#'.repeat(level) + ' ' + processNode(child).trim() + '\n\n';
          break;
        }
        case 'a': {
          const text = processNode(child).trim();
          const href = child.getAttribute('href') || '';
          md += text ? '[' + text + '](' + href + ')' : (href || '');
          break;
        }
        case 'ul': {
          child.querySelectorAll(':scope > li').forEach(li => {
            md += '- ' + processNode(li).trim().replace(/\n/g, ' ') + '\n';
          });
          md += '\n';
          break;
        }
        case 'ol': {
          let i = 1;
          child.querySelectorAll(':scope > li').forEach(li => {
            md += i++ + '. ' + processNode(li).trim().replace(/\n/g, ' ') + '\n';
          });
          md += '\n';
          break;
        }
        case 'code':
          md += '`' + child.textContent + '`';
          break;
        case 'pre': {
          const codeEl = child.querySelector('code');
          md += '```\n' + (codeEl || child).textContent.trim() + '\n```\n\n';
          break;
        }
        case 'blockquote': {
          const inner = processNode(child).trim();
          md += inner.split('\n').map(l => '> ' + l).join('\n') + '\n\n';
          break;
        }
        case 'hr':
          md += '\n---\n\n';
          break;
        case 'img': {
          const alt = child.getAttribute('alt') || '';
          if (alt) md += '[image: ' + alt + ']';
          break;
        }
        case 'table':
          md += processTable(child);
          break;
        case 'script': case 'style': case 'head':
          break;
        default:
          md += processNode(child);
      }
    });
    return md;
  }

  function htmlToMarkdown(el) {
    return processNode(el)
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // --- Thread expansion ---

  function isCollapsed(gs) {
    // A message is collapsed when its body container is hidden or absent
    const adn = gs.querySelector('.adn');
    if (!adn) return !gs.querySelector('.a3s');
    const cs = window.getComputedStyle(adn);
    return cs.display === 'none' || cs.visibility === 'hidden';
  }

  async function expandAll() {
    const toExpand = Array.from(document.querySelectorAll('.gs')).filter(isCollapsed);
    if (!toExpand.length) return;

    toExpand.forEach(function (gs) {
      // Gmail expand trigger: the summary header row inside the collapsed message.
      // Try several known Gmail class names in priority order.
      const trigger = gs.querySelector('.aio')
        || gs.querySelector('.gE')
        || gs.querySelector('.ade');
      if (trigger) trigger.click();
    });

    // Give Gmail time to show the message bodies (CSS transition + DOM update)
    await new Promise(function (resolve) { setTimeout(resolve, 600); });
  }

  // --- Thread extraction ---

  function extractThread() {
    const subjectEl = document.querySelector('h2.hP');
    const subject = subjectEl ? subjectEl.textContent.trim() : '';
    let result = subject ? '# ' + subject + '\n\n' : '';

    const messages = document.querySelectorAll('.gs');
    let addedCount = 0;

    messages.forEach(function (msg) {
      const bodyEl = msg.querySelector('.a3s');
      if (!bodyEl) return;

      const clone = bodyEl.cloneNode(true);
      // Strip signatures, quoted content, attribution lines, and quote toggles
      ['.gmail_signature', '.gmail_extra', '.gmail_quote', '.gmail_quote_container', '.gmail_attr']
        .forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));

      const text = htmlToMarkdown(clone);
      if (!text.trim()) return;

      const senderName = (msg.querySelector('.go') || {}).textContent || '';
      const senderEmailEl = msg.querySelector('[email]');
      const senderEmail = senderEmailEl ? senderEmailEl.getAttribute('email') : '';
      const dateEl = msg.querySelector('.g3');
      const date = dateEl ? (dateEl.getAttribute('title') || dateEl.textContent || '') : '';

      if (addedCount > 0) result += '\n---\n\n';
      addedCount++;

      const trimmedName = senderName.trim();
      const trimmedEmail = senderEmail.trim();
      const from = trimmedEmail && trimmedEmail !== trimmedName
        ? trimmedName + (trimmedName ? ' <' + trimmedEmail + '>' : trimmedEmail)
        : trimmedName || trimmedEmail;

      if (from) result += '**From:** ' + from + '\n';
      if (date.trim()) result += '**Date:** ' + date.trim() + '\n';
      if (from || date.trim()) result += '\n';

      result += text + '\n';
    });

    return result.trim();
  }

  // --- Clipboard ---

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  // --- Button injection ---

  function showFeedback(btn, success) {
    const origText = btn.textContent;
    const origBg = btn.style.background;
    const origBorder = btn.style.borderColor;
    btn.textContent = success ? 'Copied!' : 'Copy failed';
    btn.style.background = success ? '#e6f4ea' : '#fce8e6';
    btn.style.borderColor = success ? '#81c784' : '#e57373';
    setTimeout(function () {
      btn.textContent = origText;
      btn.style.background = origBg;
      btn.style.borderColor = origBorder;
    }, 2000);
  }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;
    const subjectEl = document.querySelector('h2.hP');
    if (!subjectEl) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = 'Copy thread as Markdown';
    btn.title = 'Copy this email thread as Markdown, without signatures or quoted replies';
    btn.style.cssText = [
      'display:inline-block',
      'margin:6px 0 4px 0',
      'padding:5px 12px',
      'font-size:12px',
      'font-family:"Google Sans",Roboto,Arial,sans-serif',
      'font-weight:500',
      'line-height:16px',
      'cursor:pointer',
      'background:#fff',
      'border:1px solid #dadce0',
      'border-radius:4px',
      'color:#444746',
      'transition:background 0.15s,border-color 0.15s',
      'vertical-align:middle'
    ].join(';');

    btn.addEventListener('mouseover', function () {
      if (btn.style.background === '#fff') btn.style.background = '#f6f9fe';
    });
    btn.addEventListener('mouseout', function () {
      if (btn.style.background === '#f6f9fe') btn.style.background = '#fff';
    });

    btn.addEventListener('click', async function () {
      const origText = btn.textContent;
      btn.textContent = 'Expanding thread…';
      btn.disabled = true;
      try {
        await expandAll();
        const md = extractThread();
        await copyToClipboard(md);
        btn.disabled = false;
        btn.textContent = origText;
        showFeedback(btn, true);
      } catch (err) {
        console.error('[gmail-md] Copy thread failed:', err);
        btn.disabled = false;
        btn.textContent = origText;
        showFeedback(btn, false);
      }
    });

    subjectEl.insertAdjacentElement('afterend', btn);
  }

  if (typeof module !== 'undefined') {
    module.exports = { htmlToMarkdown, extractThread, isCollapsed, injectButton };
  }

  const observer = new MutationObserver(function () {
    if (!document.getElementById(BTN_ID) && document.querySelector('h2.hP')) {
      injectButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  injectButton();
})();
