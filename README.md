# Markdown for Gmail

A Chrome extension that lets you compose Gmail messages in Markdown and convert them to rich HTML with a single shortcut or right-click.

## Features

- **Markdown to Rich Text** — write in Markdown, then press `Ctrl+Shift+M` (or right-click → *Convert Markdown to Rich Text*) to render it as formatted HTML inside the Gmail compose window.
- **HTML to Markdown** — reverse the conversion with `Ctrl+Shift+H` (or right-click → *Convert HTML to Markdown*).
- **Auto-convert on paste** — optionally convert pasted Markdown automatically.
- **Auto-convert on send** — convert just before the message is sent.
- **GitHub-flavored Markdown** — tables, task lists, strikethrough, and more via the [Marked](https://github.com/markedjs/marked) library.
- **Emoji shortcodes** — type `:rocket:` or `:heart:` and they become 🚀 and ❤️. Over 1 000 GitHub-style codes are supported. Emoji characters you type directly (e.g. 👍) are left untouched.
- **Readable links** — `[text](url)` is converted to `text (url)` so recipients see real URLs.
- **Themes** — choose *Clean*, *Notion-style*, or *Email-friendly* in the options page.
- **Custom keyboard shortcuts** — set any modifier+key combo (e.g. `Cmd+Shift+M` on macOS). The extension command is updated automatically when you save.

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the repository folder.

## Usage

1. Open Gmail and compose a new message.
2. Write your email using Markdown syntax.
3. Press **Ctrl+Shift+M** or right-click and choose **Convert Markdown to Rich Text**.
4. The Markdown is replaced with formatted HTML inside the compose area.

To reverse: press **Ctrl+Shift+H** or right-click → **Convert HTML to Markdown**.

### Options

Click the extension icon → *Options* (or go to `chrome://extensions` → *Details* → *Extension options*) to configure:

| Option | Description |
|---|---|
| Convert on Paste | Auto-convert Markdown when you paste text |
| Convert on Send | Convert just before the message is sent |
| GitHub flavored Markdown | Enable GFM extensions (tables, task lists, etc.) |
| Sanitize HTML | Strip potentially unsafe HTML tags |
| Theme | Choose between Clean, Notion-style, or Email-friendly |
| Custom Shortcut | Override the default `Ctrl+Shift+M` shortcut |
| Disable default shortcut | Turn off the built-in keyboard command |

## Project Structure

```
├── manifest.json        # Chrome Extension Manifest v3
├── background.js        # Service worker — context menus & command handling
├── contentScript.js     # Content script — paste/send observers, shortcut matching
├── injector.js          # Dynamically injected for Markdown → HTML conversion
├── html2md.js           # Dynamically injected for HTML → Markdown conversion
├── turndown.js          # Lightweight HTML-to-Markdown converter
├── emoji.js             # 1 000+ emoji shortcode mappings
├── marked.min.js        # Marked v9.1.2 (bundled)
├── options.html/js/css  # Extension options page
├── themes.css           # Theme stylesheets
├── icons/icon.png       # Toolbar icon
└── test/                # Mocha + Chai test suite
```

## Development

### Prerequisites

- Node.js (for running tests)

### Install dependencies

```bash
npm install
```

### Run tests

```bash
npm test
```

### Packaging for the Chrome Web Store

1. Update the `version` field in `manifest.json`.
2. Zip the extension folder (excluding `node_modules/` and `.git/`).
3. Upload to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## License

See [LICENSE](LICENSE) for details.
