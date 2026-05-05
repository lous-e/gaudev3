# Red-Team Hook

This repo includes a tracked post-commit hook at `.githooks/post-commit`.

To enable it in a local checkout:

```sh
npm run setup:redteam-hook
```

The hook runs after each commit. It scans changed source files with the local
`claude` CLI, writes a run report under `knowledge_base/redteaming/runs/`, and
merges findings into `knowledge_base/redteaming/alpha.json` and
`knowledge_base/redteaming/alpha.md`.

Requirements:

- Git Bash or another Bash-compatible shell
- Python available as `python3` or `python`
- Claude CLI available as `claude`

If Python or Claude is unavailable, the hook skips cleanly.
