chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'convert-md',
    title: 'Convert Markdown to Rich Text',
    contexts: ['editable']
  });
  chrome.contextMenus.create({
    id: 'convert-html-md',
    title: 'Convert HTML to Markdown',
    contexts: ['editable']
  });
});

async function injectMarkdownTools(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['marked.min.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['injector.js'] });
  } catch (err) {
    console.warn('[gmail-md] Failed to inject markdown tools:', err.message);
  }
}

async function injectHtmlToMarkdown(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['turndown.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['html2md.js'] });
  } catch (err) {
    console.warn('[gmail-md] Failed to inject HTML-to-MD tools:', err.message);
  }
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'convert-md') {
    await injectMarkdownTools(tab.id);
  } else if (info.menuItemId === 'convert-html-md') {
    await injectHtmlToMarkdown(tab.id);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'convert_markdown') {
    const { disableDefault } = await chrome.storage.sync.get({ disableDefault: false });
    if (disableDefault) return;
    const tabId = await getActiveTabId();
    if (tabId) await injectMarkdownTools(tabId);
  } else if (command === 'convert_html_markdown') {
    const tabId = await getActiveTabId();
    if (tabId) await injectHtmlToMarkdown(tabId);
  }
});
