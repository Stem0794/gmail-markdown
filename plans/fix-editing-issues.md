# Plan: Fix H1 "Stuck" Issue and Support "---" Shortcut

## Objective
1.  **Fix H1 "Stuck" Issue:** When a user creates a header (e.g., `# Test`), deletes the text, and is left with an empty H1 line, pressing Backspace should convert the line back to normal text (Paragraph/Div) instead of merging lines or staying as H1.
2.  **Support `---` + Space:** Enable the creation of a horizontal rule using `---` followed by a Space, consistent with other markdown shortcuts.

## Analysis
- **H1 Stuck:** The previous "Undo" implementation relied on `lastAppliedFormat`, which persists even after the user types text. This causes confusion or fails to trigger the "Generic Unformat" behavior users expect from rich text editors (Empty Header + Backspace = Paragraph).
- **`---` Shortcut:** currently only listens for `Enter`.

## Proposed Changes

### 1. Manage `lastAppliedFormat` Lifecycle
- The "Undo" feature (reverting `# `) is intended for *immediate* correction.
- **Change:** Invalidate/Nullify `lastAppliedFormat` as soon as the user types any character that modifies the content (other than the formatting trigger itself).
- **Implementation:** In `keydown`, if the key is printable (length 1) and not a modifier/command, clear `lastAppliedFormat` (unless we just set it). *Actually, safer approach:* Clear `lastAppliedFormat` if the selection moves or content changes outside of our control?
- **Simplified Approach:** We'll leave `lastAppliedFormat` logic mostly as is for the "Immediate Undo", but ensuring the "Generic Unformat" takes precedence or works when `lastAppliedFormat` is stale/irrelevant isn't enough. We must explicitly handle the "Empty Block" case.

### 2. Generic Backspace Handler (The Fix for "Stuck")
- inside `keydown` (Backspace):
    - **Check 1 (Immediate Undo):** If `lastAppliedFormat` exists AND cursor is at start AND content matches (or is empty). (Existing logic).
    - **Check 2 (Generic Unformat):** If `lastAppliedFormat` is NULL (or Check 1 failed) AND cursor is at start of a Block Element (H1-H6, BLOCKQUOTE, PRE):
        - If the Block Element is **empty** (textContent trim is empty):
            - `e.preventDefault()`
            - `document.execCommand('formatBlock', false, 'div')` (Converts to normal text).
            - This solves the "stuck" issue.

### 3. Implement `---` + Space
- In `applyAutoFormat`, inside the `if (e.key === ' ')` block:
    - Add a check for `trimmedPrefix === '---'`.
    - If match:
        - `e.preventDefault()`
        - `deleteBackwards(3)`
        - `document.execCommand('insertHorizontalRule')`

## Implementation Steps
1.  **Update `applyAutoFormat`:** Add `---` detection to the space key handler.
2.  **Update `observeShortcuts`:**
    - Insert logic to clear `lastAppliedFormat` on non-Backspace interactions (e.g., on `input` event or generic `keydown`).
    - Enhance `Backspace` handler to include the "Generic Unformat" fallback for empty blocks.

## Verification
- **Test `---`:** Type `---` then Space. Should create a horizontal line.
- **Test H1 Escape:** Type `# Test`. Backspace 4 times (deletes "Test"). Backspace 1 time (on empty H1). Should become normal text (Div).
- **Test Immediate Undo:** Type `# ` (becomes H1). Backspace 1 time. Should revert to `# `.
