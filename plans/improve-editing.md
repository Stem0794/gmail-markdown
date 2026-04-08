# Plan: Improve Markdown Editing Experience

## Objective
Enhance the Gmail Markdown extension by adding two features:
1.  **Easy Formatting Removal:** Allow users to revert auto-formatted blocks (like headers or lists) to their original markdown text (e.g., `# `) by pressing `Backspace` at the beginning of the block.
2.  **Automatic Spacing:** Ensure that when a block format (Title, List, etc.) is applied, a new line/space is automatically added below it if one doesn't exist.

## Analysis
The current implementation in `contentScript.js` detects markdown patterns (like `# ` or `* `) on `Space` keypress and uses `document.execCommand` to apply formatting. It does not track state for "undoing" this via Backspace, nor does it explicitly manage spacing after the formatted block.

## Proposed Changes

### 1. State Tracking for "Undo"
- Introduce a variable `lastAppliedFormat` to store the details of the most recent auto-formatting action.
- Structure: `{ node: HTMLElement, trigger: string, timestamp: number }`.

### 2. Modify `applyAutoFormat`
- **Capture Block Element:** After executing the format command, identify the resulting block element (e.g., `H1`, `LI`) using the current selection.
- **Implement "Space Under":** Check if the new block element has a next sibling. If not, insert a standardized empty line (e.g., `<div><br></div>`) after it.
- **Update State:** key `lastAppliedFormat` with the new block node and the trigger text used (e.g., `#`, `*`).

### 3. Handle `Backspace`
- Add a specific check for `e.key === 'Backspace'` in the `keydown` listener.
- **Condition:**
    - `lastAppliedFormat` is valid and recent.
    - The cursor (selection) is at the start of the `lastAppliedFormat.node`.
- **Action:**
    - Prevent default Backspace behavior.
    - Revert the block format (convert back to default text block, usually `DIV`).
    - Re-insert the original trigger text (e.g., `# `) at the beginning.
    - Reset `lastAppliedFormat`.

### 4. Edge Cases
- **Selection changes:** If the user moves the cursor away, `lastAppliedFormat` should ideally be invalidated or the check should fail (implicit via "cursor at start of node" check).
- **Nested elements:** Ensure we correctly identify the block container even if the cursor is in a text node deep inside.

## Implementation Steps
1.  Read `contentScript.js` (Already done).
2.  Modify `contentScript.js`:
    - Add `lastAppliedFormat` variable.
    - Update `applyAutoFormat` to handle the post-formatting logic (identifying node, adding space, saving state).
    - Update `observeShortcuts`'s `keydown` listener to handle `Backspace`.

## Verification
- **Test Case 1 (Undo):** Type `# ` -> Text becomes Header 1. Press `Backspace`. Text should revert to `# ` (plain text).
- **Test Case 2 (Spacing):** Type `# ` -> Text becomes Header 1. Verify a new empty line exists below the header.
- **Test Case 3 (Normal Backspace):** Type `# Test`. Move cursor to end. Press Backspace. Should delete 't'.
- **Test Case 4 (Undo with text):** Type `# Test`. Move cursor to start of "Test". Press Backspace. Should revert to `# Test` (plain text).
