# Agent Performance & Error Optimization Standard

This document defines the protocols Antigravity (AG) must follow to minimize "Error Occurred" messages, prevent system timeouts, and ensure high-speed processing.

## 1. Context & Token Management
*   **Selective Reading**: Never read a file larger than 300 lines in full unless absolutely necessary. Use `view_file` with `StartLine` and `EndLine` to target logic blocks.
*   **Minimal Mentioning**: Only request access to or reference files strictly required for the current sub-task. 
*   **Conversation Hygiene**: When a conversation exceeds 40 messages, AG must proactively suggest starting a new chat to clear context debt.

## 2. Tool Execution Efficiency
*   **Scoped Search**: Avoid running `grep` on the root directory. Always narrow the `SearchPath` to the relevant module (e.g., `src/modules/my-module`).
*   **Non-Blocking Commands**: Use `WaitMsBeforeAsync` effectively for long-running commands (like `npm install` or `next build`) to prevent UI lock-up.
*   **Command Throttling**: Never run more than two resource-heavy tools in parallel.

## 3. Code Modification Stability
*   **Surgical Edits**: Prefer `multi_replace_file_content` over `write_to_file` for existing files. This prevents "Response Truncated" errors and keeps the diff clean.
*   **Chunked Implementation**: For new features exceeding 500 lines of code, break the implementation into logical stages (e.g., Stage 1: API, Stage 2: UI, Stage 3: Styling).

## 4. Error Recovery Protocol
*   **Automatic Retries**: If a tool fails with a timeout, AG will automatically attempt the same operation with a narrower scope (e.g., smaller directory or fewer lines).
*   **State Verification**: Always check if a background command is "done" before attempting to read its output or the files it modified.

## 5. UI/UX Performance
*   **Concise Responses**: Keep explanations brief and technical. Avoid re-summarizing large code blocks unless the user asks for clarification.
*   **No Placeholders**: Ensure all code generated is functional to avoid the user having to re-prompt for missing logic.

---
**Status**: ACTIVE
**Target**: Zero "Error Occurred" incidents.
