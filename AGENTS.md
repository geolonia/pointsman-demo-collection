# AGENTS.md

## Organization policy

Org-wide agent policy (authoritative):

- [geolonia/.github agent policy](https://github.com/geolonia/.github/blob/main/docs/agent-policy.md)

## Project

Name: See catalog-info.yaml \
Owner: See catalog-info.yaml

## Setup

- Install: See README for setup
- Dev: See README for dev command

## Test & Lint

- Lint: See README for lint command
- Test: See README for test command

## Constraints

- Do not commit secrets.
- Prefer small PRs with tests.

## Issue intake (from Slack / Claude)

When asked to create an issue in this repo from a Slack discussion (for example,
a thread summarized into a task):

- **Language:** write the title and body in the same language as the discussion.
  Default to Japanese when the language is unclear, and honor an explicit
  language request in the trigger message (e.g. "in English"). Two exceptions
  (full rule: the `english-agent-files` skill, "Human-facing text"):
  - In a public repository, write the title and body in English, with a
    Japanese summary at the top where the users are Japanese. Check with
    `gh repo view --json visibility`; `PRIVATE` and `INTERNAL` count as
    internal.
  - In an internal repository, when the person you act for is an
    English-speaking team member, write the issue in English with a Japanese
    summary at the top, also when the discussion is Japanese.
- **Structure** (translate the headings to match the issue's language; omit any
  section with nothing to say, except the summary):
  - Title: concise and specific.
  - Summary: a short gist at the top, before Context, because people read the
    gist. Where a language exception above applies, this is the Japanese
    summary.
  - Context: what the discussion was about.
  - What to do: the proposed work.
  - Notes: links, references, and open questions. Always include a link to the
    source Slack thread here.
- **Department / routing (optional):** an issue lands on a team board when its
  org `Department` field is set and the repository has the custom property
  `issue-routing` set to `true`. Routing is delivered by an org-wide GitHub App
  webhook; no workflow file in the repository is involved. Check the property
  first (`gh api "repos/$OWNER/$REPO/properties/values"`).
  - **If the property is `true`,** set the `Department` single-select field by
    this precedence: an explicit request from the requester (in any language,
    for example a Japanese name like デザイン / セキュリティ / 運用) mapped to
    the closest existing option; otherwise a clear mapping from the discussion;
    otherwise leave it unset. Look up the field's current options; do not invent
    option names.
  - **If the property is not `true`,** do not set the field (nothing would route
    it). Still create the issue, and tell the requester that the issue was
    created but department routing is not enabled for this repo, and that the
    operations team can turn it on by setting the `issue-routing` custom
    property.
- Do not @-mention or assign people, and do not invent details that are not in
  the thread.
