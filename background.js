'use strict';

const GMAIL_DOCUMENT_PATTERNS = ['https://mail.google.com/*'];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'convert-md',
      title: 'Convert Markdown to Rich Text',
      contexts: ['editable'],
      documentUrlPatterns: GMAIL_DOCUMENT_PATTERNS
    });
    chrome.contextMenus.create({
      id: 'convert-html-md',
      title: 'Convert HTML to Markdown',
      contexts: ['editable'],
      documentUrlPatterns: GMAIL_DOCUMENT_PATTERNS
    });
  });
});

async function sendConversionMessage(tabId, type) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type });
  } catch (err) {
    // Commands can be triggered outside Gmail. In that case there is no content script.
    console.debug('[gmail-md] Conversion command ignored:', err.message);
  }
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'convert-md') {
    await sendConversionMessage(tab?.id, 'gmail-md:convert-markdown');
  } else if (info.menuItemId === 'convert-html-md') {
    await sendConversionMessage(tab?.id, 'gmail-md:convert-html-markdown');
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'convert_markdown') {
    const { disableDefault } = await chrome.storage.sync.get({ disableDefault: false });
    if (disableDefault) return;
    await sendConversionMessage(await getActiveTabId(), 'gmail-md:convert-markdown');
  } else if (command === 'convert_html_markdown') {
    await sendConversionMessage(await getActiveTabId(), 'gmail-md:convert-html-markdown');
  }
});
