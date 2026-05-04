#!/usr/bin/env python3
"""
Merges a red-team run's findings (newline-delimited JSON) into alpha.json,
then regenerates alpha.md.

Usage:
    python3 merge_findings.py <findings_jsonl_file> <commit_sha> <alpha_json_path>
"""

import sys
import json
import hashlib
import datetime
import os

# Force UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

VALID_CATEGORIES = {
    "INPUT_VALIDATION", "AUTHENTICATION", "AUTHORIZATION",
    "INJECTION", "PATH_TRAVERSAL", "LOG_INJECTION",
    "RACE_CONDITION", "STATE_VIOLATION", "REPLAY_ATTACK",
    "PARTIAL_FAILURE", "UNHANDLED_EXCEPTION", "SILENT_FAILURE",
    "SUPPLY_CHAIN", "BUSINESS_LOGIC", "NUMERIC_EDGE_CASE",
    "SSRF", "INFO_DISCLOSURE", "DOS",
}

SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Info"]


def vuln_id(file_path: str, category: str, anchor: str) -> str:
    raw = f"{file_path}|{category}|{anchor}"
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


def normalize_path(p: str) -> str:
    return p.replace("\\", "/").lstrip("./")


def parse_findings(jsonl_path: str) -> list[dict]:
    findings = []
    with open(jsonl_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("```") or line.startswith("#"):
                continue
            # strip markdown code fences the LLM sometimes emits
            if line.startswith("{") and line.endswith("}"):
                try:
                    obj = json.loads(line)
                    findings.append(obj)
                except json.JSONDecodeError:
                    continue
    return findings


def merge(findings: list[dict], alpha: dict, commit_sha: str, run_id: str) -> dict:
    now = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    issues = alpha.get("issues", {})

    for f in findings:
        raw_file = f.get("file", "")
        category = f.get("category", "").upper()
        anchor = f.get("anchor", "module")
        severity = f.get("severity", "Low")
        summary = f.get("summary", "")
        exploit = f.get("exploit", "")
        fix = f.get("fix", "")

        if not raw_file or raw_file == "—":
            continue
        if category not in VALID_CATEGORIES:
            # try to salvage by mapping close synonyms
            category = "INPUT_VALIDATION"

        file_key = normalize_path(raw_file)
        vid = vuln_id(file_key, category, anchor)

        if file_key not in issues:
            issues[file_key] = {}

        if vid in issues[file_key]:
            # already known — update last_confirmed only
            issues[file_key][vid]["last_confirmed"] = {
                "run": run_id, "commit": commit_sha, "at": now
            }
        else:
            # new issue
            issues[file_key][vid] = {
                "id": vid,
                "category": category,
                "anchor": anchor,
                "severity": severity,
                "summary": summary,
                "exploit": exploit,
                "fix": fix,
                "resolved": False,
                "first_seen": {"run": run_id, "commit": commit_sha, "at": now},
                "last_confirmed": {"run": run_id, "commit": commit_sha, "at": now},
                "resolved_in": None,
            }

    open_count = sum(
        1 for file_issues in issues.values()
        for v in file_issues.values()
        if not v.get("resolved", False)
    )
    resolved_count = sum(
        1 for file_issues in issues.values()
        for v in file_issues.values()
        if v.get("resolved", False)
    )

    alpha["issues"] = issues
    alpha["_meta"] = {
        "last_updated": now,
        "open_count": open_count,
        "resolved_count": resolved_count,
    }
    return alpha


def render_alpha_md(alpha: dict) -> str:
    meta = alpha.get("_meta", {})
    issues = alpha.get("issues", {})
    now = meta.get("last_updated", "")
    open_count = meta.get("open_count", 0)
    resolved_count = meta.get("resolved_count", 0)

    lines = [
        "# BidMesh — Open Security Issues (Alpha)",
        "",
        f"**Last updated:** {now}  |  **Open:** {open_count}  |  **Resolved:** {resolved_count}",
        "",
        "> This file is auto-generated. Mark an issue resolved by setting `\"resolved\": true`",
        "> and `\"resolved_in\": \"<commit_sha>\"` in `alpha.json`, then re-run the hook.",
        "",
        "---",
        "",
    ]

    # Group open issues by file, sorted by severity
    open_by_file: dict[str, list] = {}
    resolved_issues: list = []

    for file_key, file_issues in sorted(issues.items()):
        for vid, v in file_issues.items():
            if v.get("resolved"):
                resolved_issues.append((file_key, v))
            else:
                open_by_file.setdefault(file_key, []).append(v)

    if not open_by_file and not resolved_issues:
        lines.append("_No issues recorded yet._")
        return "\n".join(lines)

    for file_key, file_issue_list in open_by_file.items():
        sorted_issues = sorted(
            file_issue_list,
            key=lambda v: SEVERITY_ORDER.index(v["severity"])
            if v["severity"] in SEVERITY_ORDER else 99
        )
        lines.append(f"## `{file_key}`  ({len(sorted_issues)} open)")
        lines.append("")
        lines.append("| ID | Category | Anchor | Severity | Summary | First Seen | Last Confirmed |")
        lines.append("|----|----------|--------|----------|---------|------------|----------------|")
        for v in sorted_issues:
            first = v["first_seen"]["commit"][:7]
            last = v["last_confirmed"]["commit"][:7]
            lines.append(
                f"| `{v['id']}` | {v['category']} | `{v['anchor']}` | **{v['severity']}** "
                f"| {v['summary']} | {first} | {last} |"
            )
        lines.append("")
        # expand exploit + fix for each issue
        for v in sorted_issues:
            lines.append(f"### `{v['id']}` — {v['summary']}")
            lines.append("")
            lines.append(f"**Exploit:** {v['exploit']}")
            lines.append("")
            lines.append(f"**Fix:** {v['fix']}")
            lines.append("")

    if resolved_issues:
        lines.append("---")
        lines.append("")
        lines.append("## Resolved")
        lines.append("")
        lines.append("| ID | File | Category | Anchor | Resolved In |")
        lines.append("|----|------|----------|--------|-------------|")
        for file_key, v in sorted(resolved_issues, key=lambda x: x[1].get("resolved_in") or ""):
            rid = (v.get("resolved_in") or "")[:7]
            lines.append(
                f"| `{v['id']}` | `{file_key}` | {v['category']} | `{v['anchor']}` | {rid} |"
            )

    return "\n".join(lines)


def main():
    if len(sys.argv) != 4:
        print("Usage: merge_findings.py <findings.jsonl> <commit_sha> <alpha.json>", file=sys.stderr)
        sys.exit(1)

    findings_path, commit_sha, alpha_path = sys.argv[1], sys.argv[2], sys.argv[3]
    run_id = os.path.basename(findings_path).replace(".jsonl", "")

    with open(alpha_path, encoding="utf-8") as f:
        alpha = json.load(f)

    findings = parse_findings(findings_path)
    print(f"[merge] Parsed {len(findings)} findings from {findings_path}", file=sys.stderr)

    alpha = merge(findings, alpha, commit_sha, run_id)

    with open(alpha_path, "w", encoding="utf-8") as f:
        json.dump(alpha, f, indent=2, ensure_ascii=False)
    print(f"[merge] alpha.json updated ({alpha['_meta']['open_count']} open)", file=sys.stderr)

    alpha_md_path = os.path.join(os.path.dirname(alpha_path), "alpha.md")
    with open(alpha_md_path, "w", encoding="utf-8") as f:
        f.write(render_alpha_md(alpha))
    print(f"[merge] alpha.md regenerated", file=sys.stderr)


if __name__ == "__main__":
    main()
