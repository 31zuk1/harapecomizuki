---
created: 2026-04-05
updated: 2026-04-05
---

# AGENTS.md

This file defines the operating system for autonomous agents working in this repository.

Its goal is not to describe the product at a high level, but to keep long-running autonomous development aligned with the user's intent, the documented architecture, and the practical constraints of this codebase.

If you are an autonomous coding agent, read this file before making changes.

## Vault Discipline

The `docs/` directory is a long-lived project vault.

Treat it as all of the following at once:

- the project's development record
- the project's architecture knowledge base
- the user's reference material
- the agent's compass when the next step is ambiguous

It is not a one-off planning dump and it is not disposable scaffolding.

When you learn something durable about the system, encode it in `docs/`.
When you materially change the system, update the relevant docs in `docs/`.
When you touch a Markdown file in this repository, keep its date metadata current.

## 0. Authority Order

When instructions conflict, follow this order:

1. Direct user instructions in the current conversation
2. This `AGENTS.md`
3. The design docs under `docs/`
4. Existing code

Never use existing code as justification to ignore a documented architectural direction when the user has explicitly asked for structural improvement.

## 1. Project North Star

This repository exists to build a lightweight, single-tenant publishing workflow where Discord is the primary authoring surface and GitHub Pages is the primary publishing surface.

The intended product is **not** a generic CMS.

The intended product **is**:

- a Discord-first writing workflow
- mobile-friendly authoring
- clear draft / published separation
- static site publishing
- operational simplicity
- low infrastructure cost

The product should remain understandable and operable by one person without a database, an admin panel, or a large backend.

## 2. Non-Negotiable Product Invariants

Any autonomous work must preserve these invariants unless the user explicitly asks to change them.

### Authoring Model

- Discord is the primary input channel.
- A `!post` message is the canonical source of a draft update.
- The same Discord message can be edited to update the draft.
- `messageId` tracking is fundamental to the workflow.

### Publishing Model

- Draft and published content are intentionally different states.
- A published article must not update automatically when the draft changes.
- `!publish <slug>` creates or refreshes the published snapshot.
- `!unpublish <slug>` removes the public snapshot but keeps the draft.

### Visibility Model

- Drafts are never shown on the public site.
- Only published snapshots are rendered by the Astro site.

### Operational Model

- The project remains single-tenant.
- The project should continue to work without a database.
- Discord-less local demo must remain possible.
- GitHub Pages remains a supported publishing target.

## 3. Current State vs Target State

The current implementation is a successful PoC, but it is not the target architecture.

Agents must understand the distinction:

- **Current state**: a working, file-based, mostly monolithic implementation optimized for speed
- **Target state**: a layered architecture with clear separation between domain, application, and infrastructure

Read these files before starting substantial structural work:

- `docs/00_overview.md`
- `docs/01_current_analysis.md`
- `docs/02_architecture.md`
- `docs/03_data_model.md`
- `docs/04_roadmap.md`

These documents are the design context that should keep autonomous work aligned over long periods.

## 4. Source-of-Truth Documents

### Product / Direction

- `docs/00_overview.md`

### Current Code Analysis

- `docs/01_current_analysis.md`

### Ideal Architecture

- `docs/02_architecture.md`

### Data Model

- `docs/03_data_model.md`

### Refactoring Plan

- `docs/04_roadmap.md`

If you change architecture, data model, or major behavior, update the corresponding document in the same task. Do not leave docs stale.

## 5. What “Good Autonomous Work” Looks Like Here

Good autonomous work in this repo has these qualities:

- preserves the current working flow while improving internals
- moves the implementation toward the documented target architecture
- increases observability and operational clarity
- makes future refactors easier, not harder
- avoids speculative complexity that does not serve the product

Bad autonomous work in this repo looks like this:

- adding a database “just because”
- introducing a large framework without a clear problem it solves
- replacing file-based persistence before the current file-based domain boundaries are clear
- changing user-visible workflow semantics without updating docs and tests
- optimizing cosmetics while leaving reliability blind spots unresolved

## 6. Architectural Direction to Follow

The desired direction is a layered system with clearly separated responsibilities.

### Long-Term Shape

Target structure is conceptually:

```text
apps/
  bot-discord/
  site/
  worker/           # optional

packages/
  domain/
  application/
  infrastructure/
  contracts/
```

### Responsibilities

Agents should gradually move the code toward these responsibilities:

- **Discord adapter**
  Receives Discord events, maps them into application commands, and maps results back into Discord replies
- **Application layer**
  Implements use cases such as create draft, update draft, publish, unpublish, status, list drafts
- **Domain layer**
  Holds post state, publish rules, revision logic, permission rules, and attachment rules
- **Infrastructure layer**
  Implements file-based repositories, git automation, GitHub deploy tracking, asset persistence
- **Site layer**
  Renders published projections only

Do not keep deepening the monolith in `apps/bot/src/content-service.ts`. When making non-trivial changes, prefer extracting responsibilities rather than expanding that file further.

## 7. Data Model Direction

The current JSON registry is acceptable as a transitional persistence format, but the conceptual data model should evolve toward:

- `Post`
- `PostSource`
- `AttachmentRef`
- `DraftRevision`
- `PublishedSnapshot`
- `PublishOperation`
- `DeployState`

Important guidance:

- prefer derived state over duplicated flags when reasonable
- treat `hasUnpublishedChanges` as something that should eventually be derived from revision data
- distinguish “published locally” from “live on GitHub Pages”

If you introduce new state, it must make these distinctions clearer, not blurrier.

## 8. Operational Reality to Respect

This project already surfaced real operational truths:

- `!publish` does not mean GitHub Pages is instantly live
- auto commit / push can fail
- deploy state and publish state are not the same
- long-running bot operation matters

Any agent improving the system should prefer work that makes these realities explicit.

### High-Value Operational Improvements

These are particularly aligned with user intent:

- production-style bot startup
- PM2 or systemd support
- structured git automation results
- GitHub Actions / Pages deploy status tracking
- clearer Discord feedback after publish
- queueing / race protection

## 9. Task Selection Heuristics

Unless the user gives a specific task, select work in this order:

1. Stabilize working behavior that is already expected
2. Improve reliability and observability
3. Reduce architectural coupling
4. Improve operational UX in Discord
5. Improve public site polish

This means:

- fix broken edit tracking before redesigning CSS
- fix git/deploy ambiguity before adding non-essential commands
- extract reusable layers before adding unrelated features

## 10. Preferred Refactoring Strategy

Use the following pattern:

1. Understand current behavior
2. Add or strengthen tests around current behavior
3. Extract one responsibility at a time
4. Keep public behavior compatible
5. Update docs
6. Verify build / test / demo

Do not attempt a full rewrite in one step.

### Strangler Pattern Rule

When replacing a monolithic area:

- introduce a new abstraction beside the old code
- route one use case through it
- verify behavior
- migrate the next use case
- only delete the old path when the replacement is proven

This is especially important for:

- `content-service.ts`
- git automation
- registry persistence
- publish / deploy state handling

## 11. Testing Expectations

Every non-trivial change should be validated with the smallest relevant test set plus any affected end-to-end checks.

### Minimum Bar

For bot-side behavior changes:

- `npm run test`

For site or build-path changes:

- `npm run build`

For Pages-related changes:

- `npm run pages:check`

For command flow changes:

- local demo flow and, when practical, real Discord flow

### Behavior That Must Stay Protected

Agents should preserve and expand coverage for:

- `!post` parsing
- draft creation
- draft update from message edit
- published snapshot freezing
- publish permission checks
- attachment handling
- base path correctness for GitHub Pages
- auto commit / push reporting

If you change behavior without adding or adjusting tests where appropriate, the task is incomplete.

## 12. Documentation Rules

### Required Updates

Update docs when you change any of the following:

- directory or module responsibilities
- architecture direction
- data shape
- publish semantics
- deploy semantics
- runtime / hosting model
- operator workflow

The goal is to keep the vault useful both to future agents and to the human owner of the project.
Write docs so they remain worth rereading weeks later.

### Where to Update

- product-level positioning: `docs/00_overview.md`
- current implementation facts: `docs/01_current_analysis.md`
- target structure: `docs/02_architecture.md`
- models and schemas: `docs/03_data_model.md`
- sequencing and task plan: `docs/04_roadmap.md`

### Obsidian Rule

When adding new docs under `docs/`, connect them with wikilinks so the vault remains graph-friendly.

### Markdown Date Rule

All generated or substantially edited Markdown files must include date metadata at the top.

Use this shape unless a better local convention has already been established:

```yaml
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

When editing an existing Markdown file:

- preserve `created` if already present and credible
- update `updated` to the current date

## 13. Constraints on New Dependencies

Be conservative with dependencies.

Add a new dependency only if it clearly improves one of these:

- reliability
- operational clarity
- architecture separation
- testing productivity

Do not add dependencies for fashion or vague “future flexibility”.

### In Particular

- do not introduce a database without explicit user approval
- do not introduce a full backend framework unless the current runtime model demonstrably blocks progress
- do not replace GitHub Pages unless the user asks for a different publishing target

## 14. Rules for User-Visible Behavior

When changing user-visible Discord behavior:

- keep responses concise
- make failure modes actionable
- distinguish local success from public availability
- do not claim “live” if deploy completion is unknown

When changing site behavior:

- keep drafts invisible
- preserve base path correctness for project pages
- preserve attachment rendering

## 15. Security and Secret Handling

Never commit secrets.

Key rules:

- `.env` must stay ignored
- do not print secrets into logs or docs
- if a token appears to have been exposed, instruct rotation and treat it as compromised

When automating git or GitHub operations, surface failures clearly but do not leak sensitive tokens into output.

## 16. Migration Rules

If a change is structurally correct but would break current data or workflow, do not force it through in one step.

Instead:

- add a compatibility adapter
- preserve old data reading
- write migration notes
- document the cutover plan

Prefer compatibility layers over hard cutovers, especially for:

- `data/posts.json`
- published markdown layout
- attachment paths
- command syntax

## 17. Definition of Done for Autonomous Tasks

A task is not done just because code compiles.

A substantial task is done when:

- the code change is implemented
- the relevant tests/build checks pass
- user-visible implications are explained
- the design docs are updated if needed
- the change does not move the architecture away from the target state

## 18. Current High-Priority Workstreams

Unless redirected by the user, the next meaningful improvements are:

1. stabilize current bot behavior and commit the outstanding fixes
2. add production-style bot startup
3. turn git automation into a structured result
4. separate publish state from deploy state
5. begin splitting `content-service.ts` into smaller components

These priorities come from `docs/04_roadmap.md` and should be treated as the default path toward beta.

## 19. When to Pause and Ask the User

Autonomy is encouraged, but pause for user confirmation when:

- a change would alter the core authoring or publishing workflow
- a new infrastructure component would be introduced
- a dependency choice has meaningful cost or vendor lock-in
- a migration would make old state unreadable
- the implementation would deviate from the documented target architecture

Do not ask for confirmation on ordinary internal refactors, tests, or documentation updates.

## 20. Summary for Future Agents

If you only remember five things, remember these:

1. This is a Discord-first publishing workflow, not a general CMS.
2. Draft and published states must remain explicitly separate.
3. The system must evolve toward domain/application/infrastructure separation.
4. Reliability and operational clarity matter more than feature count.
5. Keep the docs in `docs/` synchronized with the code and use them to stay aligned.
