---
name: draft-github-issue
description: Draft GitHub issues using repository templates in .github/ISSUE_TEMPLATE. Use when users ask to create, draft, or refine an issue, bug report, feature proposal, support question, meeting agenda, office hours notes, schema change proposal, maintainer update, project proposal, or experimental feature feedback.
---

# Draft GitHub Issue from Repository Templates

Use this skill to produce issue-ready Markdown that matches the templates in `.github/ISSUE_TEMPLATE`.

## Goal

- Select the most appropriate template.
- Gather missing details with minimal clarifying questions.
- Create a complete issue draft file that preserves the chosen template structure.

## Template Selection

Choose exactly one template based on intent:

- Bug or defect → `.github/ISSUE_TEMPLATE/Bug_report.md`
- New capability in an existing module → `.github/ISSUE_TEMPLATE/Feature_proposal.md`
- Feedback request for experimental work → `.github/ISSUE_TEMPLATE/Experimental_Feature_Feedback.md`
- JSON schema modification request → `.github/ISSUE_TEMPLATE/Schema_change_proposal.md`
- New module/project in monorepo → `.github/ISSUE_TEMPLATE/Project_proposal.md`
- Maintainer add/remove process → `.github/ISSUE_TEMPLATE/Maintainer_update.md`
- Regular project meeting agenda/minutes → `.github/ISSUE_TEMPLATE/Meeting.md`
- Office Hours agenda → `.github/ISSUE_TEMPLATE/Office_Hours.md`
- User/support usage question → `.github/ISSUE_TEMPLATE/Support_question.md`

If intent is ambiguous, ask one concise multiple-choice clarification listing the above options.

## Workflow

1. Read the selected template file.
2. Keep all section headings and checklists from the template.
3. Fill placeholders (`...`) with concrete, concise content from user context.
4. If critical required details are missing, ask only for those details.
5. Write the final issue draft to a Markdown file under `sandbox/issues/` by default.
6. Return:
   - the suggested issue title,
   - the file path created,
   - and the final issue body in chat only if the user explicitly asks for it.

## Output Rules

- Do not include YAML frontmatter from template files in the final issue body.
- Keep checkbox lists (`- [ ]`) intact unless user asks to pre-check items.
- Prefer factual statements over speculative text.
- Do not invent technical details; use explicit TODO markers only when data is unavailable.
- Preserve links and governance/process references from the source template when relevant.
- Default file naming convention: `sandbox/issues/<yyyy-mm-dd>-<short-kebab-title>.md`.
- If user provides a preferred filename/location, use it.

## Quality Checklist

Before returning the draft, verify:

- The chosen template matches user intent.
- No template section is silently removed.
- Actionable sections are specific (repro steps, implementation notes, timelines, etc.).
- The issue is understandable without extra context.