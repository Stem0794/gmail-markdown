(function () {
  const BTN_ID = 'md-copy-thread-btn';
  const ACTIONS_ID = 'md-copy-thread-actions';
  const STYLE_ID = 'md-copy-thread-style';
  const DEFAULT_LABEL = 'Copy Markdown';
  const BUTTON_TITLE = 'Copy this email thread as Markdown, without signatures or quoted replies';

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
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(text);
      return;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
      document.body.appendChild(ta);
      try {
        ta.focus();
        ta.select();
        if (typeof document.execCommand !== 'function' || !document.execCommand('copy')) {
          throw new Error('Clipboard copy command failed');
        }
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  // --- Button injection ---

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ACTIONS_ID} {
        box-sizing: border-box;
        display: block;
        clear: both;
        flex: 0 0 100%;
        margin: 10px 0 8px;
        max-width: 100%;
        line-height: 1;
        width: 100%;
      }
      #${ACTIONS_ID} button {
        align-items: center;
        appearance: none;
        background: #fff;
        border: 1px solid #dadce0;
        border-radius: 8px;
        box-sizing: border-box;
        color: #3c4043;
        cursor: pointer;
        display: inline-flex;
        font-family: "Google Sans", Roboto, Arial, sans-serif;
        font-size: 13px;
        font-weight: 500;
        gap: 8px;
        justify-content: center;
        line-height: 18px;
        max-width: 100%;
        min-height: 34px;
        padding: 7px 12px;
        transition: background-color .15s ease, border-color .15s ease, box-shadow .15s ease, color .15s ease;
        vertical-align: middle;
        white-space: nowrap;
      }
      #${ACTIONS_ID} button:hover:not(:disabled) {
        background: #f8fafd;
        border-color: #c2e7ff;
        box-shadow: 0 1px 2px rgba(60, 64, 67, .15);
      }
      #${ACTIONS_ID} button:focus-visible {
        outline: 2px solid #1a73e8;
        outline-offset: 2px;
      }
      #${ACTIONS_ID} button:disabled {
        cursor: wait;
        opacity: .72;
      }
      #${ACTIONS_ID} button[data-state="busy"] {
        background: #f8fafd;
      }
      #${ACTIONS_ID} button[data-state="success"] {
        background: #e6f4ea;
        border-color: #81c995;
        color: #137333;
      }
      #${ACTIONS_ID} button[data-state="error"] {
        background: #fce8e6;
        border-color: #f28b82;
        color: #c5221f;
      }
      #${ACTIONS_ID} .md-copy-thread-btn__icon {
        flex: 0 0 auto;
        height: 16px;
        width: 16px;
      }
      #${ACTIONS_ID} .md-copy-thread-btn__label {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function createCopyIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'md-copy-thread-btn__icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<rect x="9" y="9" width="10" height="10" rx="2"></rect>'
      + '<path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>';
    return svg;
  }

  function setButtonLabel(btn, label) {
    const labelEl = btn.querySelector('.md-copy-thread-btn__label');
    if (labelEl) labelEl.textContent = label;
    else btn.textContent = label;
  }

  function clearFeedbackTimer(btn) {
    if (btn._mdFeedbackTimer) {
      clearTimeout(btn._mdFeedbackTimer);
      btn._mdFeedbackTimer = null;
    }
  }

  function showFeedback(btn, success) {
    clearFeedbackTimer(btn);
    btn.setAttribute('aria-busy', 'false');
    btn.dataset.state = success ? 'success' : 'error';
    setButtonLabel(btn, success ? 'Copied!' : 'Copy failed');
    btn.setAttribute('aria-label', success ? 'Thread copied as Markdown' : 'Copy failed');
    btn._mdFeedbackTimer = setTimeout(function () {
      delete btn.dataset.state;
      setButtonLabel(btn, DEFAULT_LABEL);
      btn.setAttribute('aria-label', DEFAULT_LABEL);
      btn._mdFeedbackTimer = null;
    }, 2000);
  }

  function injectButton() {
    if (document.getElementById(BTN_ID) || document.getElementById(ACTIONS_ID)) return;
    const subjectEl = document.querySelector('h2.hP');
    if (!subjectEl) return;

    ensureStyles();

    const actions = document.createElement('div');
    actions.id = ACTIONS_ID;
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Markdown actions');

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.title = BUTTON_TITLE;
    btn.setAttribute('aria-label', DEFAULT_LABEL);
    btn.setAttribute('aria-busy', 'false');
    btn.appendChild(createCopyIcon());
    const label = document.createElement('span');
    label.className = 'md-copy-thread-btn__label';
    label.textContent = DEFAULT_LABEL;
    btn.appendChild(label);

    btn.addEventListener('click', async function () {
      clearFeedbackTimer(btn);
      delete btn.dataset.state;
      setButtonLabel(btn, 'Expanding thread…');
      btn.setAttribute('aria-label', 'Expanding thread');
      btn.setAttribute('aria-busy', 'true');
      btn.dataset.state = 'busy';
      btn.disabled = true;
      try {
        await expandAll();
        const md = extractThread();
        await copyToClipboard(md);
        btn.disabled = false;
        showFeedback(btn, true);
      } catch (err) {
        console.error('[gmail-md] Copy thread failed:', err);
        btn.disabled = false;
        showFeedback(btn, false);
      }
    });

    actions.appendChild(btn);
    subjectEl.insertAdjacentElement('afterend', actions);
  }

  if (typeof module !== 'undefined') {
    module.exports = { htmlToMarkdown, extractThread, isCollapsed, injectButton };
  }

  let injectionScheduled = false;
  const observer = new MutationObserver(function () {
    if (injectionScheduled) return;
    injectionScheduled = true;
    window.setTimeout(function () {
      injectionScheduled = false;
      if (!document.getElementById(BTN_ID) && document.querySelector('h2.hP')) {
        injectButton();
      }
    }, 0);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  injectButton();
})();
