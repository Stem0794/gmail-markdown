# Chrome Web Store Listing — Markdown for Gmail

> Last Updated: 2026-06-15

## Store Listing

**Extension Name**
Markdown for Gmail

**Short Description**
Write Gmail messages in Markdown and convert them to rich text via right-click or shortcut.

**Detailed Description**
Tired of Gmail's limited formatting toolbar?

Markdown for Gmail lets you write messages using familiar Markdown syntax, apply formatting while you type, and convert drafts into clean rich text with one shortcut.

Built for developers, writers, and keyboard-focused users, it adds powerful formatting tools directly to Gmail without sending your content to an external service.

KEY FEATURES

• Live auto-formatting: Turn headings, lists, blockquotes, bold, italic, strikethrough, inline code, emoji shortcodes, and dividers into formatted content as you type.

• Slash commands: Type `/` to insert H1-H3 headings, bullet and numbered lists, quotes, notes, code blocks, dividers, and editable tables.

• Editable tables: Add or remove rows and columns, move between cells with Tab and Shift+Tab, and create new rows from the keyboard.

• Full Markdown conversion: Convert an entire draft or selected text using Ctrl+Shift+M or the Gmail context menu.

• HTML to Markdown: Convert formatted Gmail content back to Markdown with Ctrl+Shift+H.

• GitHub Flavored Markdown: Supports tables, task lists, strikethrough, and other GFM syntax.

• Better list editing: Nest and outdent list items using Tab and Shift+Tab.

• Code formatting: Create dedicated code blocks or wrap selected text as inline code with Ctrl+E.

• Emoji shortcodes: Type codes such as `:rocket:` or `:smile:` followed by a space.

• Paste-friendly editing: Multiline pasted content keeps its order and can be formatted line by line.

• Copy threads as Markdown: Export Gmail conversations as clean Markdown without signatures or duplicated quoted replies.

• Gmail-compatible styling: Formatting is designed to survive Gmail rendering without interfering with native features such as scheduling availability.

HOW TO USE

1. Open a Gmail compose window.
2. Type Markdown or enter `/` to open the formatting menu.
3. Use live formatting as you type, or press Ctrl+Shift+M to convert Markdown into rich text.
4. Select text and press Ctrl+E for inline code.
5. Press Ctrl+Shift+H when you need to convert formatted content back to Markdown.

PRIVACY AND SECURITY

All formatting and conversion happen locally in your browser. Markdown for Gmail does not collect, track, sell, or transmit your email content, credentials, or personal data to external servers.

Lightweight, keyboard-friendly, and optimized for Gmail.

**Category**
Productivity

**Single Purpose**
Write Gmail messages using Markdown syntax and render them to formatted rich text.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | `icons/icon128.png` |
| Screenshot 1 | 1280×800 or 640×400 | ✅ Ready | `screenshot1.png` |
| Screenshot 2 | 1280×800 or 640×400 | ✅ Ready | `screenshot2.png` |

### Screenshot Notes
- **Screenshot 1**: Showing a Gmail compose window side-by-side with Markdown text on one side and the converted rich text on the other.
- **Screenshot 2**: Showing the right-click context menu option "Convert Markdown" inside Gmail compose.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `contextMenus` | permissions | Used to add the "Convert Markdown" option to the browser right-click context menu inside the Gmail compose editor. |
| `scripting` | permissions | Used to securely inject the rendering logic and helper scripts (marked.js, emoji.js) to convert the editor text on the fly. |
| `activeTab` | permissions | Grants the extension temporary access to execute scripts in the active Gmail tab when clicked or triggered by shortcut. |
| `storage` | permissions | Used to save user preferences, such as selected themes and markdown options. |
| `clipboardWrite` | permissions | Used to allow copying email threads as Markdown to the clipboard. |
| `https://mail.google.com/*` | host_permissions | Necessary to detect when you are writing an email on Gmail and inject the editor listeners for rendering. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**
https://github.com/Stem0794/gmail-markdown/blob/main/PRIVACY.md

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name**
Stem0794

**Contact Email**
theodore.konikowski@gmail.com

**Support URL / Email**
https://github.com/Stem0794/gmail-markdown/issues

**Homepage URL**
https://github.com/Stem0794/gmail-markdown

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.5.0 | 2026-06-15 | Add slash commands, editable tables, nested lists, paste fixes, and Gmail scheduling compatibility. | Ready to upload |
| 1.4.3 | 2026-06-01 | Add Thread Copy support, UI enhancements and performance updates. | Draft |
| 1.4.2 | 2026-05-27 | Initial release of Thread Copy support and hotfixes. | Published |
| 1.4.1 | 2026-05-27 | Initial release of Thread Copy support and hotfixes. | Published |
| 1.4.0 | 2026-04-10 | Add context menu and custom hotkey configurations. | Published |

## Review Notes

### Known Issues / Limitations
- None.
