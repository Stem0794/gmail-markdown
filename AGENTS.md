# Repository Guidelines

## Project Structure

This is a Manifest V3 Chrome extension for Gmail. `contentScript.js` contains compose-editor behavior, Markdown conversion, slash commands, paste handling, and table/list editing. `threadCopy.js` adds the reading-view thread exporter. `background.js`, `injector.js`, `html2md.js`, and `options.js` provide background, context-menu, conversion, and settings support. Styles and options markup live in `themes.css`, `options.css`, and `options.html`; icons are in `icons/`. Unit tests are in `test/*.test.js`, browser tests in `test/e2e/`, and `test/visual-testbed.html` is a manual mock editor.

## Build, Test, and Development Commands

- `npm test` runs the Mocha unit suite through `scripts/run-tests.js`.
- `npm run test:e2e` runs the Playwright Gmail-editor regression suite.
- `npm run build:zip` creates `gmail-markdown-v<manifest-version>.zip` using the runtime-file allowlist in `scripts/build-zip.sh`.
- For manual testing, load the repository with **Developer mode → Load unpacked** at `chrome://extensions`.

Run unit and E2E tests before submitting changes. Browser tests may require the locally installed Playwright Chromium executable.

## Coding Style & Naming

Use plain JavaScript with two-space indentation, semicolons, `const`/`let`, and descriptive camelCase names. Keep DOM selectors and CSS IDs/classes namespaced with `md-` where practical. Scope injected styles carefully so Gmail-native content, especially scheduling widgets, is unaffected. Preserve the existing defensive DOM checks and avoid adding network access.

## Testing Guidelines

Use Mocha, Chai, and JSDOM for conversion and DOM unit tests; use Playwright for keyboard, paste, slash-command, table, and Gmail-layout behavior. Name tests after observable behavior, and add a regression test for every bug fix. UI changes should cover placement, keyboard accessibility, and feedback states where applicable.

## Versioning & Packaging

Keep the version synchronized in `manifest.json`, `package.json`, and the top-level `package-lock.json`. Add release notes and update `CHROMEWEBSTORE.md` for store releases. Build the ZIP only after tests pass; verify it contains runtime files only and matches the intended manifest version.

## Commits & Pull Requests

Use short imperative commit subjects, for example `Fix pasted list conversion` or `Add table row controls`; scoped conventional prefixes such as `fix:` and `test:` are also used. Pull requests should explain the user-visible change, list validation commands, link relevant issues, and include screenshots or a short recording for Gmail UI changes. Mention any version bump and generated store package explicitly.

## Security & Privacy

All conversion is local. Keep permissions and host access minimal, do not transmit email content, and preserve the documented privacy behavior when adding features.
