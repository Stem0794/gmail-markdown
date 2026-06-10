# Chrome Web Store Listing — Markdown for Gmail

> Last Updated: 2026-05-27

## Store Listing

**Extension Name**
Markdown for Gmail

**Short Description**
Write Gmail messages in Markdown and convert them to rich text via right-click or shortcut.

**Detailed Description**
Write your Gmail messages using clean, readable Markdown syntax and instantly convert them to beautifully formatted rich text! Perfect for developers, technical writers, and anyone who wants to write emails faster without clicking format buttons.

Key Features:
- Complete Markdown support: headings, bold, italic, lists, blockquotes, inline code, and code blocks with syntax highlighting.
- Native Integration: Seamlessly integrates into Gmail's compose window.
- Convenient Shortcuts: Convert your markdown using `Ctrl+Shift+M` (`Cmd+Shift+M` on macOS) or the context menu.
- Convert back: Toggle back to markdown with a simple shortcut if you need to edit.
- Thread Copy: Copy entire email threads in clean markdown for documentation or sharing.
- Clean Styling: High-quality, readable styling applied to all rendered elements.

How to Use:
1. Open Gmail and click "Compose" to start a new email.
2. Write your email message using Markdown syntax (e.g. `**bold text**`, `*italic*`, `# Heading`).
3. Press `Ctrl+Shift+M` (or right-click and choose "Convert Markdown") to render the Markdown to rich text.
4. If you need to edit the Markdown again, press the shortcut again to revert the rendering!

Privacy/permissions note:
This extension runs completely locally in your browser. It does not collect, track, or transmit any user data, email contents, or credentials off your device.

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
| 1.4.3 | 2026-06-01 | Add Thread Copy support, UI enhancements and performance updates. | Draft |
| 1.4.2 | 2026-05-27 | Initial release of Thread Copy support and hotfixes. | Published |
| 1.4.1 | 2026-05-27 | Initial release of Thread Copy support and hotfixes. | Published |
| 1.4.0 | 2026-04-10 | Add context menu and custom hotkey configurations. | Published |

## Review Notes

### Known Issues / Limitations
- None.
