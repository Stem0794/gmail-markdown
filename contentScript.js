(function () {
  const DEFAULTS = {
    convertOnPaste: false,
    autoFormat: true,
    gfm: true,
    theme: 'default',
    shortcut: 'Ctrl+Shift+M',
    codeShortcut: 'Ctrl+E',
    disableDefault: false
  };

  const SELECTOR = 'div[aria-label="Message Body"][contenteditable="true"]';

  const BLOCKQUOTE_INLINE_STYLE = 'border-left:4px solid #ccc;padding-left:24px !important;color:#555;margin:0.5em 0;background:none;';
  const PRE_WRAPPER_STYLE = 'background-color:#f7f6f3;border-radius:3px;padding:12px 16px;margin:1em 0;overflow-x:auto;max-width:100%;';
  const PRE_CODE_STYLE = 'font-family:SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;font-size:0.85em;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;color:#333;margin:0;padding:0;display:block;';
  const INLINE_CODE_STYLE = 'background-color:#f2f2f2;color:#d73a49;padding:2px 4px;border-radius:3px;font-family:monospace;';

  const AUTO_FORMATS = [
    { reg: /(\*\*|__)(.+?)\1$/, cmd: 'bold' },
    { reg: /(\*|_)(.+?)\1$/, cmd: 'italic' },
    { reg: /~~(.+?)~~$/, cmd: 'strikeThrough' },
    { reg: /`(.+?)`$/, cmd: 'code' },
    { reg: /:([a-zA-Z0-9_\+\-]+):$/, cmd: 'emoji' }
  ];

  function getActiveEditable() {
    const active = document.activeElement;
    if (active && active.matches && active.matches(SELECTOR)) return active;
    
    // Fallback based on text selection
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      let node = sel.getRangeAt(0).commonAncestorContainer;
      while (node && node !== document.body) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(SELECTOR)) return node;
        node = node.parentNode;
      }
    }
    
    // Absolute fallback: first editor on page
    return document.querySelector(SELECTOR);
  }

  function convertLinksToReadable(text) {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  }

  function applyTheme(theme) {
    const id = 'md-theme-style';
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.documentElement.appendChild(style);
    }
    const sel = 'div[aria-label="Message Body"][contenteditable="true"]';
    const base = `
        ${sel} > div:not([style]), ${sel} > p:not([style]) { margin: 0 !important; padding: 0 !important; }
    `;
    const themes = {
      default: `
        ${sel} h1 { font-size: 1.4em !important; font-weight: bold !important; margin: 0.6em 0 !important; }
        ${sel} h2 { font-size: 1.2em !important; font-weight: bold !important; margin: 0.5em 0 !important; }
        ${sel} h3 { font-size: 1.1em !important; font-weight: bold !important; margin: 0.4em 0 !important; }
        ${sel} table { border-collapse: collapse !important; border-spacing: 0 !important; margin: 0.5em 0 !important; }
        ${sel} th, ${sel} td { border: 1px solid #ccc !important; padding: 6px 10px !important; text-align: left !important; }
        ${sel} th { background-color: #f8f9fa !important; font-weight: bold !important; }
      `,
      bold: `
        ${sel} h1 { font-size: 1.4em !important; font-weight: bold !important; text-transform: uppercase !important; margin: 0.6em 0 !important; }
        ${sel} h2 { font-size: 1.2em !important; font-weight: bold !important; text-transform: uppercase !important; margin: 0.5em 0 !important; }
        ${sel} h3 { font-size: 1.1em !important; font-weight: bold !important; text-transform: uppercase !important; margin: 0.4em 0 !important; }
        ${sel} table { border-collapse: collapse !important; border-spacing: 0 !important; margin: 0.5em 0 !important; }
        ${sel} th, ${sel} td { border: 1px solid #ccc !important; padding: 6px 10px !important; text-align: left !important; }
        ${sel} th { background-color: #f8f9fa !important; font-weight: bold !important; text-transform: uppercase !important; }
      `
    };
    // Map 'strong' to 'bold' if user had it saved previously
    let activeTheme = theme === 'strong' ? 'bold' : theme;
    style.textContent = base + (themes[activeTheme] || themes.default);
  }

  function deleteBackwards(count) {
    for (let i = 0; i < count; i++) {
      document.execCommand('delete', false, null);
    }
  }

  function isCursorAtBlockStart(range, block) {
    try {
      const testRange = document.createRange();
      testRange.setStart(block, 0);
      testRange.setEnd(range.startContainer, range.startOffset);
      return testRange.toString().length === 0;
    } catch (e) {
      return false;
    }
  }

  function replaceBlockWithDiv(block) {
    const isPreBlock = block.tagName === 'PRE';
    const isCodeWrapper = !!(block.getAttribute && block.getAttribute('data-md-code'));
    const div = document.createElement('div');
    if (isPreBlock || isCodeWrapper) {
      // For code wrappers, unwrap the inner <pre> content
      const source = isCodeWrapper ? (block.querySelector('pre') || block) : block;
      source.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
      while (source.firstChild) div.appendChild(source.firstChild);
    } else {
      while (block.firstChild) div.appendChild(block.firstChild);
    }
    if (!div.hasChildNodes()) div.innerHTML = '<br>';
    block.parentNode.replaceChild(div, block);
    const s = window.getSelection();
    if (isPreBlock || isCodeWrapper) {
      const contentRange = document.createRange();
      contentRange.selectNodeContents(div);
      s.removeAllRanges();
      s.addRange(contentRange);
      document.execCommand('removeFormat');
    }
    const newRange = document.createRange();
    newRange.setStart(div, 0);
    newRange.collapse(true);
    s.removeAllRanges();
    s.addRange(newRange);
    div.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false }));
  }

  function insertCodeBlock(body) {
    // Outer <div> provides background-color (Gmail strips background-color from <pre>).
    // Inner <pre> handles whitespace preservation and native Enter behaviour.
    const wrapperStyle = PRE_WRAPPER_STYLE;
    const preStyle = PRE_CODE_STYLE;
    const html = `<div data-md-code="1" style="${wrapperStyle}"><pre style="${preStyle}"><br></pre></div><div><br></div>`;
    document.execCommand('insertHTML', false, html);

    // Place cursor inside the <pre> block
    const sel = window.getSelection();
    const wrappers = body.querySelectorAll('[data-md-code] pre');
    if (wrappers.length) {
      const pre = wrappers[wrappers.length - 1];
      const newRange = document.createRange();
      newRange.setStart(pre, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }

  function insertLineAfterHR(body) {
    const hrs = body.querySelectorAll('hr');
    if (!hrs.length) return;
    const hr = hrs[hrs.length - 1];
    const emptyDiv = document.createElement('div');
    emptyDiv.innerHTML = '<br>';
    hr.parentNode.insertBefore(emptyDiv, hr.nextSibling);
    const newRange = document.createRange();
    newRange.setStart(emptyDiv, 0);
    newRange.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  function applyAutoFormat(e, body) {
    if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Backspace') return;

    // Handle Backspace: remove block formatting when at the start of a formatted block
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!body.contains(range.startContainer)) return;

      let node = range.startContainer;

      // Find the closest block element first
      let block = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
      while (block && block !== body && !block.matches('h1, h2, h3, h4, h5, h6, blockquote, li, pre, [data-md-quote], [data-md-code]')) {
        block = block.parentNode;
      }

      if (!block || block === body) {
        // Chrome sometimes reports cursor at body[0] instead of inside the first child
        if (node === body && range.startOffset === 0) {
          const firstChild = body.childNodes[0];
          if (firstChild && firstChild.nodeType === Node.ELEMENT_NODE &&
            firstChild.matches('h1, h2, h3, h4, h5, h6, blockquote, pre, [data-md-quote], [data-md-code]')) {
            e.preventDefault();
            replaceBlockWithDiv(firstChild);
          }
        }
        return;
      }

      if (!isCursorAtBlockStart(range, block)) return;

      const tag = block.tagName;

      if (/^H[1-6]$/.test(tag)) {
        e.preventDefault();
        replaceBlockWithDiv(block);
      } else if (tag === 'BLOCKQUOTE' || block.getAttribute('data-md-quote')) {
        e.preventDefault();
        replaceBlockWithDiv(block);
      } else if (tag === 'PRE' || block.getAttribute('data-md-code')) {
        e.preventDefault();
        replaceBlockWithDiv(block);
      } else if (tag === 'LI') {
        const list = block.closest('ul, ol');
        if (list) {
          e.preventDefault();
          if (list.tagName === 'UL') {
            document.execCommand('insertUnorderedList', false, null);
          } else {
            document.execCommand('insertOrderedList', false, null);
          }
        }
      }
      return;
    }

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!body.contains(range.startContainer)) return;

    let container = range.startContainer;
    let offset = range.startOffset;

    if (container.nodeType !== Node.TEXT_NODE) {
      if (container.childNodes[offset - 1] && container.childNodes[offset - 1].nodeType === Node.TEXT_NODE) {
        container = container.childNodes[offset - 1];
        offset = container.textContent.length;
      } else {
        return;
      }
    }

    const text = container.textContent;
    const textBefore = text.slice(0, offset);

    if (e.key === ' ') {
      const trimmedPrefix = textBefore.trim();
      const isStartOfLine = (textBefore.trimStart() === textBefore);

      // Handle --- + space as horizontal rule
      if (trimmedPrefix === '---') {
        e.preventDefault();
        deleteBackwards(textBefore.length);
        document.execCommand('insertHorizontalRule');
        insertLineAfterHR(body);
        return;
      }

      if (/^[\s\u200B\u200C\u200D\uFEFF]*`{3}$/.test(textBefore)) {
        e.preventDefault();
        deleteBackwards(textBefore.length);
        insertCodeBlock(body);
        return;
      }

      if (isStartOfLine && trimmedPrefix.length > 0) {
        let command = null;
        let arg = null;
        let prefixLen = 0;

        if (trimmedPrefix === '#') { command = 'formatBlock'; arg = 'H1'; prefixLen = 1; }
        else if (trimmedPrefix === '##') { command = 'formatBlock'; arg = 'H2'; prefixLen = 2; }
        else if (trimmedPrefix === '###') { command = 'formatBlock'; arg = 'H3'; prefixLen = 3; }
        else if (trimmedPrefix === '*' || trimmedPrefix === '-') { command = 'insertUnorderedList'; prefixLen = 1; }
        else if (/^\d+\.$/.test(trimmedPrefix)) { command = 'insertOrderedList'; prefixLen = trimmedPrefix.length; }
        else if (trimmedPrefix === '>') { command = 'insertQuoteDiv'; prefixLen = 1; }

        if (command === 'insertQuoteDiv') {
          e.preventDefault();
          deleteBackwards(prefixLen);
          // Use formatBlock to wrap the current line in a blockquote, then immediately
          // replace it with a styled <div>. This avoids Gmail's email renderer stripping
          // styles from <blockquote> elements.
          document.execCommand('formatBlock', false, 'blockquote');
          const currentSel = window.getSelection();
          if (currentSel.rangeCount) {
            let bq = currentSel.getRangeAt(0).startContainer;
            if (bq.nodeType === Node.TEXT_NODE) bq = bq.parentNode;
            while (bq && bq !== body && bq.tagName !== 'BLOCKQUOTE') bq = bq.parentNode;
            if (bq && bq.tagName === 'BLOCKQUOTE') {
              const quoteDiv = document.createElement('div');
              quoteDiv.setAttribute('style', BLOCKQUOTE_INLINE_STYLE);
              quoteDiv.setAttribute('data-md-quote', '1');
              
              // Automatically inject a physical space so the user doesn't have to manually.
              const spaceNode = document.createTextNode('\u00A0');
              quoteDiv.appendChild(spaceNode);

              while (bq.firstChild) quoteDiv.appendChild(bq.firstChild);
              bq.parentNode.replaceChild(quoteDiv, bq);
              const emptyDiv = document.createElement('div');
              emptyDiv.innerHTML = '<br>';
              quoteDiv.parentNode.insertBefore(emptyDiv, quoteDiv.nextSibling);
              const newRange = document.createRange();
              
              // Set cursor immediately after the injected space
              newRange.setStart(spaceNode, 1);
              newRange.collapse(true);
              currentSel.removeAllRanges();
              currentSel.addRange(newRange);
            }
          }
          return;
        } else if (command) {
          e.preventDefault();
          deleteBackwards(prefixLen);
          document.execCommand(command, false, arg);
          // Add an empty line after the formatted block
          if (command === 'formatBlock') {
            // Move cursor to end of current content, then insert a paragraph after
            const currentSel = window.getSelection();
            if (currentSel.rangeCount) {
              const currentRange = currentSel.getRangeAt(0);
              let blockEl = currentRange.startContainer;
              if (blockEl.nodeType === Node.TEXT_NODE) blockEl = blockEl.parentNode;
              while (blockEl && blockEl !== body && !blockEl.matches('h1, h2, h3, h4, h5, h6')) {
                blockEl = blockEl.parentNode;
              }
              if (blockEl && blockEl !== body) {
                const emptyDiv = document.createElement('div');
                emptyDiv.innerHTML = '<br>';
                blockEl.parentNode.insertBefore(emptyDiv, blockEl.nextSibling);
              }
            }
          }
          return;
        }
      }

      for (const f of AUTO_FORMATS) {
        const match = textBefore.match(f.reg);
        if (match) {
          const fullMatch = match[0];
          const content = match[2] || match[1] || fullMatch.replace(/^(\*\*|__|~~|\*|_|`)|(\*\*|__|~~|\*|_|`)$/g, '');

          let emojiStr = null;
          if (f.cmd === 'emoji') {
            const emojiMap = window.EMOJI_MAP || (typeof EMOJI_MAP !== 'undefined' ? EMOJI_MAP : {});
            emojiStr = emojiMap[content] || emojiMap[content.toLowerCase()];
            if (!emojiStr) continue; // Not a registered emoji, ignore
          }

          e.preventDefault();
          deleteBackwards(fullMatch.length);

          if (f.cmd === 'code') {
            const html = `<code style="${INLINE_CODE_STYLE}">${content}</code>`;
            document.execCommand('insertHTML', false, html);
            // Explicitly place cursor outside the <code> element so the browser
            // doesn't carry forward monospace/padding styles into subsequent text.
            const codeSel = window.getSelection();
            if (codeSel.rangeCount) {
              let cur = codeSel.getRangeAt(0).startContainer;
              if (cur.nodeType === Node.TEXT_NODE) cur = cur.parentNode;
              while (cur && cur !== body && cur.tagName !== 'CODE') cur = cur.parentNode;
              if (cur && cur.tagName === 'CODE') {
                const space = document.createTextNode('\u00A0');
                cur.parentNode.insertBefore(space, cur.nextSibling);
                const r = document.createRange();
                r.setStartAfter(space);
                r.collapse(true);
                codeSel.removeAllRanges();
                codeSel.addRange(r);
              } else {
                document.execCommand('insertText', false, '\u00A0');
              }
            }
          } else if (f.cmd === 'emoji') {
            document.execCommand('insertText', false, emojiStr + '\u00A0');
          } else {
            let style = '';
            if (f.cmd === 'bold') style = 'font-weight:bold;';
            else if (f.cmd === 'italic') style = 'font-style:italic;';
            else if (f.cmd === 'strikeThrough') style = 'text-decoration:line-through;';

            const html = `<span style="${style}">${content}</span>\u00A0`;
            document.execCommand('insertHTML', false, html);
          }
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      if (textBefore.trim() === '---') {
        e.preventDefault();
        deleteBackwards(textBefore.length);
        document.execCommand('insertHorizontalRule');
        insertLineAfterHR(body);
        return;
      }

      if (/^[\s\u200B\u200C\u200D\uFEFF]*`{3}$/.test(textBefore)) {
        e.preventDefault();
        deleteBackwards(textBefore.length);
        insertCodeBlock(body);
        return;
      }

      // Exit code block when Enter is pressed on an empty line inside <pre>
      let preEl = container.parentNode;
      while (preEl && preEl !== body && preEl.tagName !== 'PRE') {
        preEl = preEl.parentNode;
      }
      if (preEl && preEl !== body && preEl.tagName === 'PRE') {
        const lastNl = textBefore.lastIndexOf('\n');
        const currentLine = lastNl >= 0 ? textBefore.slice(lastNl + 1) : textBefore;
        if (currentLine === '') {
          e.preventDefault();
          if (container.nodeType === Node.TEXT_NODE && container.textContent.endsWith('\n')) {
            container.textContent = container.textContent.slice(0, -1);
          }
          // If pre is inside a code wrapper div, exit the wrapper instead
          const exitTarget = (preEl.parentElement && preEl.parentElement.getAttribute('data-md-code'))
            ? preEl.parentElement : preEl;
          let afterEl = exitTarget.nextSibling;
          if (!afterEl) {
            afterEl = document.createElement('div');
            afterEl.innerHTML = '<br>';
            exitTarget.parentNode.insertBefore(afterEl, exitTarget.nextSibling);
          }
          const exitRange = document.createRange();
          exitRange.setStart(afterEl, 0);
          exitRange.collapse(true);
          const exitSel = window.getSelection();
          exitSel.removeAllRanges();
          exitSel.addRange(exitRange);
          return;
        }
      }
    }
  }

  function attachShortcutListener(body, opts) {
    applyTheme(opts.theme);
    if (body._mdShortcutsAttached) return;
    body._mdShortcutsAttached = true;
    body.addEventListener('keydown', (e) => {
        if (opts.autoFormat) {
          applyAutoFormat(e, body);
        }

        // Code shortcut (default Ctrl+E): wrap/unwrap selected text in inline code
        if (opts.codeShortcut && matchesShortcut(e, opts.codeShortcut)) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount && !sel.isCollapsed && body.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            e.preventDefault();
            const range = sel.getRangeAt(0);

            // Toggle off: if selection is inside an existing <code>, unwrap it
            let ancestor = range.commonAncestorContainer;
            if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentElement;
            let codeEl = ancestor;
            while (codeEl && codeEl !== body) {
              if (codeEl.tagName === 'CODE') break;
              codeEl = codeEl.parentElement;
            }
            if (codeEl && codeEl.tagName === 'CODE') {
              const text = document.createTextNode(codeEl.textContent);
              codeEl.parentNode.replaceChild(text, codeEl);
            } else {
              const selectedText = sel.toString();
              // Build the <code> element manually so we can place the cursor
              // *after* it in a clean text node, preventing style leaking.
              range.deleteContents();
              const codeNode = document.createElement('code');
              codeNode.setAttribute('style', INLINE_CODE_STYLE);
              codeNode.textContent = selectedText;
              range.insertNode(codeNode);
              // Insert a zero-width space after <code> to break style inheritance
              const breaker = document.createTextNode('\u200B');
              if (codeNode.nextSibling) {
                codeNode.parentNode.insertBefore(breaker, codeNode.nextSibling);
              } else {
                codeNode.parentNode.appendChild(breaker);
              }
              // Place cursor after the breaker so typing starts unstyled
              const newRange = document.createRange();
              newRange.setStartAfter(breaker);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
            }
            return;
          }
        }

        if (e.key !== ' ' && e.key !== 'Enter') return;
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        let container = range.startContainer;
        let offset = range.startOffset;

        if (container.nodeType !== Node.TEXT_NODE) {
          if (container.childNodes[offset - 1] && container.childNodes[offset - 1].nodeType === Node.TEXT_NODE) {
            container = container.childNodes[offset - 1];
            offset = container.textContent.length;
          } else {
            return;
          }
        }

        const text = container.textContent;
        if (text.slice(offset - 5, offset) === '/note') {
          e.preventDefault();
          deleteBackwards(5);
          const html = '<div class="md-callout" style="background:#f2f2f2;padding:8px;border-radius:4px;margin:8px 0;">Important info</div>';
          document.execCommand('insertHTML', false, html);
        }
      });
  }

  function matchesShortcut(e, combo) {
    const parts = combo.toLowerCase().split('+');
    const key = parts.pop();
    const ctrl = parts.includes('ctrl');
    const shift = parts.includes('shift');
    const alt = parts.includes('alt');
    const meta = parts.includes('meta') || parts.includes('cmd');
    return e.key.toLowerCase() === key &&
      e.ctrlKey === ctrl &&
      e.shiftKey === shift &&
      e.altKey === alt &&
      e.metaKey === meta;
  }

  function attachPasteListener(body, opts) {
    if (body._mdPasteAttached) return;
    body._mdPasteAttached = true;
    body.addEventListener('paste', (e) => {
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (opts.convertOnPaste) {
          // Because convertMarkdown takes priority, we must trigger it
          convertMarkdown(opts, text);
        } else {
          // Insert as plain text wrapped in <div> elements to match Gmail's native structure.
          // Using <br> instead would corrupt Gmail's contenteditable state, causing it to
          // switch from <div> to <p> elements for subsequent lines (which have margin spacing).
          const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const lines = escaped.split('\n');
          if (lines.length === 1) {
            // Single line: insert inline to avoid block-level duplication quirks
            document.execCommand('insertText', false, text);
          } else {
            // Multi-line: wrap in <div> to match Gmail's native structure
            const html = lines.map(line => `<div>${line || '<br>'}</div>`).join('');
            document.execCommand('insertHTML', false, html);
          }
        }
      }, true);
  }



  function setupCentralObserver(opts) {
    function scanAndAttach() {
      const editors = document.querySelectorAll(SELECTOR);
      editors.forEach(body => {
        attachShortcutListener(body, opts);
        attachPasteListener(body, opts);
      });
    }

    scanAndAttach();

    const observer = new MutationObserver(() => scanAndAttach());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function replaceEmojis(text) {
    if (typeof window.replaceEmojis === 'function') return window.replaceEmojis(text);
    return text;
  }

  // Convert Marked's block-level paragraph tags to <br> line breaks
  // so spacing matches Gmail's native contenteditable behavior
  function gmailifyHtml(html) {
    return html
      // Replace <blockquote> with a styled <div> — Gmail's renderer strips styles from
      // <blockquote> elements, so a plain div with inline styles is more reliable.
      .replace(/<blockquote[^>]*>/gi, `<div style="${BLOCKQUOTE_INLINE_STYLE}">`)
      .replace(/<\/blockquote>/gi, '</div>')
      // Wrap <pre> blocks in a styled <div> to preserve background color and formatting
      .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, `<div style="${PRE_WRAPPER_STYLE}"><pre style="${PRE_CODE_STYLE}">$1</pre></div>`)
      // Apply inline styles to standalone <code> tags
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, `<code style="${INLINE_CODE_STYLE}">$1</code>`)
      .replace(/<p>([\s\S]*?)<\/p>/g, '<div>$1</div>')
      .replace(/(<br>)+$/, ''); // strip trailing <br>
  }

  function convertMarkdown(opts, markdownText) {
    applyTheme(opts.theme);
    const emailBody = getActiveEditable();
    const markedLib = window.marked || (typeof marked !== 'undefined' ? marked : null);
    if (!emailBody || !markedLib || typeof markedLib.parse !== 'function') {
      console.warn('[gmail-md] Marked library not ready');
      return;
    }

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    const process = (text) => {
      const withEmojis = replaceEmojis(text);
      return convertLinksToReadable(withEmojis);
    };

    if (markdownText !== undefined) {
      const html = gmailifyHtml(markedLib.parse(process(markdownText), { gfm: opts.gfm }));
      document.execCommand('insertHTML', false, html);
      return;
    }

    if (range && emailBody.contains(range.commonAncestorContainer) && selection.toString().trim()) {
      const html = gmailifyHtml(markedLib.parse(process(selection.toString()), { gfm: opts.gfm }));
      document.execCommand('insertHTML', false, html);
    } else {
      const html = gmailifyHtml(markedLib.parse(process(emailBody.innerText), { gfm: opts.gfm }));
      emailBody.innerHTML = html;
    }
    emailBody.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(DEFAULTS, (opts) => {
      applyTheme(opts.theme);
      setupCentralObserver(opts);

      document.addEventListener('keydown', (e) => {
        if (opts.shortcut && matchesShortcut(e, opts.shortcut)) {
          e.preventDefault();
          convertMarkdown(opts);
        }
      });

      // Capture Tab early before Gmail's focus navigation can intercept it 
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          const sel = window.getSelection();
          if (sel && sel.rangeCount) {
            let container = sel.getRangeAt(0).startContainer;
            if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
            
            // First check if we are inside a contenteditable message body
            if (container.closest && container.closest(SELECTOR)) {
              const li = container.closest('li');
              if (li) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (e.shiftKey) {
                  document.execCommand('outdent', false, null);
                } else {
                  document.execCommand('indent', false, null);
                }
              }
            }
          }
        }
      }, true); // useCapture: true is critical here
    });
  }

  if (typeof module !== 'undefined') {
    module.exports = {
      convertLinksToReadable,
      matchesShortcut,
      applyTheme,
      convertMarkdown,
      setupCentralObserver,
      gmailifyHtml
    };
  }
})();
