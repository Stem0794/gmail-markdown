<p align="center">
  <img src="icons/icon128.png" alt="Markdown for Gmail logo" width="128" height="128">
</p>

# Markdown for Gmail

Write Gmail messages in Markdown, format them as you type, and convert drafts to clean rich text without leaving Gmail.

**[Install Markdown for Gmail from the Chrome Web Store](https://chromewebstore.google.com/detail/markdown-for-gmail/njiajhmgkgphfckfkdflnabadlpdllmk)**

Free and open source. All formatting and conversion happen locally in your browser.

## Highlights

- **Markdown → rich text** — write Markdown, then press `Ctrl+Shift+M` or use the right-click menu to render it inside Gmail.
- **Rich text → Markdown** — reverse the conversion with `Ctrl+Shift+H`.
- **Live auto-formatting** — turn headings, lists, blockquotes, emphasis, code, and dividers into formatted content as you type.
- **Slash commands** — type `/` to insert headings, lists, quotes, code blocks, tables, dividers, and notes from the keyboard.
- **Editable tables and nested lists** — move through table cells with `Tab`, add rows and columns, and indent or outdent list items with `Tab` / `Shift+Tab`.
- **GitHub Flavored Markdown** — tables, task lists, strikethrough, and more via [Marked](https://github.com/markedjs/marked).
- **Emoji shortcodes** — type `:rocket:`, `:heart:`, and 1,000+ GitHub-style shortcodes.
- **Copy threads as Markdown** — export Gmail conversations as clean Markdown without signatures or duplicated quoted replies.
- **Paste-friendly editing** — pasted multiline content keeps its order when you format individual lines later.
- **Gmail-compatible themes** — choose between Default and Bold styling in the extension options.
- **Custom shortcuts** — replace the default Markdown conversion shortcut with your preferred modifier+key combination.

## Install

### Chrome Web Store

The easiest way to install the extension is from the Chrome Web Store:

**[Add Markdown for Gmail to Chrome](https://chromewebstore.google.com/detail/markdown-for-gmail/njiajhmgkgphfckfkdflnabadlpdllmk)**

After installation, open or refresh Gmail and compose a message.

### Install from source

Use this method for development or local testing:

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder.

## Quick start

1. Open Gmail and start a new message.
2. Write your message using Markdown.
3. Press **Ctrl+Shift+M** or right-click and choose **Convert Markdown to Rich Text**.
4. Continue editing the formatted message normally in Gmail.

To convert formatted content back to Markdown, press **Ctrl+Shift+H** or use **Convert HTML to Markdown** from the right-click menu.

Example Markdown:

```md
# Project update

Hi team,

- Shipped the new onboarding flow
- Fixed the billing regression
- Next: performance testing

> Launch is still scheduled for Friday.

Thanks!
```

## Live auto-formatting

When **Auto-format** is enabled, Markdown syntax is converted as you type.

| Type | Then press | Result |
|---|---|---|
| `#` | Space | Heading 1 |
| `##` | Space | Heading 2 |
| `###` | Space | Heading 3 |
| `*` or `-` | Space | Bullet list |
| `1.` | Space | Numbered list |
| `>` | Space | Blockquote |
| `---` | Space or Enter | Horizontal rule + new line |
| `**text**` | Space | **Bold** |
| `*text*` | Space | *Italic* |
| `~~text~~` | Space | ~~Strikethrough~~ |
| `` `text` `` | Space | `Inline code` |

To remove heading or blockquote formatting, place the cursor at the start of the line and press **Backspace**.

## Slash commands

At the start of a compose line, type `/` to open the formatting menu. Keep typing to filter commands.

- Use **Arrow Up** and **Arrow Down** to change the selected command.
- Press **Enter** or **Tab** to apply it.
- Press **Escape** to close the menu.
- Click a command to apply it with the mouse.

| Command | Result |
|---|---|
| `/h1` | Heading 1 |
| `/h2` | Heading 2 |
| `/h3` | Heading 3 |
| `/bullets` | Bullet list |
| `/numbered` | Numbered list |
| `/quote` | Blockquote |
| `/code` | Code block |
| `/table` | Editable 2-column table |
| `/divider` | Horizontal rule |
| `/note` | Gray callout |

Aliases such as `/title`, `/heading`, `/subheading`, `/bullet`, `/ordered`, `/blockquote`, and `/codeblock` are also searchable.

## Lists and tables

### Nested lists

- Press **Tab** inside a list item to nest it under the previous item.
- Press **Shift+Tab** to move a nested item back one level.
- List conversion preserves the current line position, including content edited after a multiline paste.

### Editable tables

`/table` inserts a two-column table with one header row and two body rows.

- Press **Tab** to move to the next cell.
- Press **Shift+Tab** to move to the previous cell.
- Press **Tab** from the final cell to add a row.
- Use **Add row** or **Add column** to expand the table.
- Use **Delete row** or **Delete column** to remove content.
- Deleting the final row or column removes the table and leaves a writable line.

Table styling is designed to survive Gmail rendering without interfering with Gmail's native scheduling widgets.

## Options

Open the extension icon → **Options**, or go to `chrome://extensions` → **Details** → **Extension options**.

| Option | Description |
|---|---|
| Convert on Paste | Automatically convert Markdown when pasting text |
| GitHub flavored Markdown | Enable GFM features such as tables and task lists |
| Theme | Choose **Default** or **Bold** styling |
| Custom Shortcut | Override the default `Ctrl+Shift+M` shortcut |
| Disable default shortcut | Turn off the built-in Markdown conversion command |

### Themes

**Default** is the recommended minimal theme, with Gmail-compatible typography and subtle heading and blockquote styling.

**Bold** increases visual contrast with stronger, uppercase headings while keeping the same Gmail-compatible blockquote treatment.

## Privacy

Markdown for Gmail performs formatting and conversion locally in the browser. It does not send email content to an external service.

The extension only requests access needed for its Gmail integration, settings, context menu, and clipboard features. See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Gmail compatibility

Gmail sanitizes email HTML aggressively, so the extension includes formatting safeguards designed specifically for Gmail:

- Blockquotes are rendered in a Gmail-safe form so their visual styling is preserved.
- Styles are applied inline where needed instead of relying on separate style blocks Gmail may remove.
- Tests guard against unsupported layout CSS that could be stripped or interfere with Gmail UI.

## Development

### Requirements

- Node.js
- Chrome or Chromium for manual testing

### Install dependencies

```bash
npm install
```

### Run tests

```bash
npm test
npm run test:e2e
```

The test suite covers Markdown and HTML conversion, emoji replacement, themes, slash commands, keyboard navigation, nested lists, editable tables, pasted multiline content, Gmail-safe styling, and Playwright browser flows.

### Visual testbed

Open `test/visual-testbed.html` in a browser to test formatting and conversion in a mock Gmail compose window without installing the extension.

### Build a Chrome Web Store package

1. Update the `version` field in `manifest.json`.
2. Keep the version synchronized with `package.json` and `package-lock.json`.
3. Run:

```bash
npm run build:zip
```

This creates `gmail-markdown-v<version>.zip` from the runtime-file allowlist, excluding tests, development files, old archives, and `node_modules`.

## Project structure

```text
├── manifest.json        # Chrome Extension Manifest V3
├── background.js        # Service worker, context menus, command handling
├── contentScript.js     # Compose editor behavior and live formatting
├── threadCopy.js        # Copy Gmail threads as Markdown
├── injector.js          # Markdown → HTML conversion
├── html2md.js           # HTML → Markdown conversion
├── turndown.js          # HTML-to-Markdown converter
├── emoji.js             # 1,000+ emoji shortcode mappings
├── marked.min.js        # Bundled Marked parser
├── options.html/js/css  # Extension options page
├── themes.css           # Gmail-compatible theme styles
├── icons/               # Extension icons
└── test/                # Unit, E2E, and visual tests
```

## License

See [LICENSE](LICENSE).

## Links

- [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/markdown-for-gmail/njiajhmgkgphfckfkdflnabadlpdllmk)
- [Privacy policy](PRIVACY.md)
- [Chrome Web Store release notes and listing](CHROMEWEBSTORE.md)
- [Report an issue](https://github.com/Stem0794/gmail-markdown/issues)
