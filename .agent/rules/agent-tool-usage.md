# Agent Tool Usage Policy

These rules govern how the agent interacts with the file system and when to use terminal commands versus native agent tools.

## 1. Prefer Native Tools for Reading and Discovery
- **Avoid Terminal Prompts:** The user's system requires manual permission approval for un-allowlisted terminal commands (like `Get-ChildItem` with dynamic paths). This creates an unsustainable volume of prompts for the user.
- **Use Native Read Tools:** ALWAYS prioritize native tools over terminal commands for read operations. 
  - Use `list_dir` instead of `ls`, `dir`, or `Get-ChildItem`.
  - Use `find_by_name` instead of `find` or `fd`.
  - Use `grep_search` instead of `grep` or `findstr`.
  - Use `view_file` instead of `cat` or `Get-Content`.

## 2. Terminal Command Guidelines
- **Last Resort:** Only use terminal commands (like `run_command`) if a native tool cannot accomplish the task (e.g., running tests, compiling code, manipulating git state, starting a dev server).
- **Be Mindful of Prompts:** Remember that every terminal command you run might halt your execution and wait for the user to manually click "Allow" in their UI. Optimize your workflow to minimize these interruptions.
