var DEFAULTS = {
  convertOnPaste: false,
  autoConvert: false,
  gfm: true,
  sanitize: false,
  theme: 'clean',
  shortcut: 'Ctrl+Shift+M',
  disableDefault: false
};

var VALID_MODIFIERS = ['ctrl', 'shift', 'alt', 'meta', 'cmd'];

function isValidShortcut(str) {
  if (!str) return false;
  var parts = str.toLowerCase().split('+').map(function (s) { return s.trim(); });
  if (parts.length < 2) return false;
  var key = parts.pop();
  if (!key || key.length === 0) return false;
  return parts.every(function (p) { return VALID_MODIFIERS.indexOf(p) !== -1; });
}

function saveOptions() {
  var shortcutInput = document.getElementById('shortcut').value.trim();
  if (shortcutInput && !isValidShortcut(shortcutInput)) {
    var status = document.getElementById('status');
    status.textContent = 'Invalid shortcut format. Use e.g. Ctrl+Shift+M';
    status.style.color = '#c00';
    setTimeout(function () { status.textContent = ''; status.style.color = ''; }, 3000);
    return;
  }

  var opts = {
    convertOnPaste: document.getElementById('convertOnPaste').checked,
    autoConvert: document.getElementById('autoConvert').checked,
    gfm: document.getElementById('gfm').checked,
    sanitize: document.getElementById('sanitize').checked,
    theme: document.getElementById('theme').value,
    shortcut: shortcutInput || DEFAULTS.shortcut,
    disableDefault: document.getElementById('disableDefault').checked
  };

  chrome.storage.sync.set(opts, function () {
    var status = document.getElementById('status');
    status.textContent = 'Options saved';
    status.style.color = '';
    setTimeout(function () { status.textContent = ''; }, 1500);

    if (chrome.commands && chrome.commands.update) {
      chrome.commands.update({ name: 'convert_markdown', shortcut: opts.shortcut }, function () {
        if (chrome.runtime.lastError) {
          console.warn('Failed to update command shortcut', chrome.runtime.lastError);
        }
      });
    }
  });
}

function restoreOptions() {
  chrome.storage.sync.get(DEFAULTS, function (items) {
    document.getElementById('convertOnPaste').checked = items.convertOnPaste;
    document.getElementById('autoConvert').checked = items.autoConvert;
    document.getElementById('gfm').checked = items.gfm;
    document.getElementById('sanitize').checked = items.sanitize;
    document.getElementById('theme').value = items.theme;
    document.getElementById('shortcut').value = items.shortcut;
    document.getElementById('disableDefault').checked = items.disableDefault;
  });
}

document.getElementById('save').addEventListener('click', saveOptions);
document.addEventListener('DOMContentLoaded', restoreOptions);
