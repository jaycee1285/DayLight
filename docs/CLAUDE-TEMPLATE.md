# CLAUDE.md Template

Copy this to new repos and fill in the project-specific sections.

---

## Session Kickoff Questions

When starting a session (especially if the human seems unfocused, tired, or hungover), ask these to get oriented fast:

### The Pain
1. **What's bothering you most right now?** (Gets the emotional priority, not just the logical one)

### Categorize It
2. **Is this a UI issue, reactivity/state issue, or server/data issue?** (Completely different debugging approaches)
3. **If multiple, what's the priority order?**

### The Roadmap
4. **What are your next 3 issues?** For each, label it:
   - UI (visual, layout, interaction)
   - Reactivity (state updates, derived values, re-renders)
   - Server (API, persistence, data flow)

### The Win
5. **What's one small thing that would delight you?** (Low-effort polish that makes the project feel better - good for momentum or ending on a high note)

---

## Before Diving In

**Don't optimistically start coding without context.** If the human hasn't provided enough information, ASK. Jumping into a repo blind leads to "fixes" that violate invisible constraints.

Context checklist - if any of these are unclear, ask:

1. **Architectural constraints** - What can we use? (e.g., "no new dependencies", "must use existing store pattern", "specific APIs only")

2. **Implementation concerns** - How can data move? Are there compliance/security requirements? (e.g., HIPAA, GDPR, offline-first, no optimistic updates)

3. **Design system/goals** - Is there an existing component library? Visual language? Don't invent new patterns if there's an established one.

4. **Session goals** - What are we actually trying to accomplish? Verify alignment before writing code. A bug fix session is different from a feature session.

This is a two-way contract: human provides context, Claude asks when it's missing.

---

## Dev Environment (Nix)

**Don't panic on missing tools.** If a package exists on [search.nixos.org](https://search.nixos.org), it gets added to `flake.nix` and appears in `$PATH` next run. Disk space and patience are abundant.

**Build fails from missing deps are one-line fixes.** Don't waste cognitive load working around tooling gaps. Just say "this needs X, add it to the flake" and move on.

**Confidence matters.** If you know the environment will be fixed for next run, you can plan multi-step work without hedging.

---

## Working Style

**Communication is direct.** Blunt feedback isn't personal. Fix the thing and move on.

**Be circumspect before jumping to fixes.** Agents tend to find the first plausible problem and try to fix it immediately. Resist this. Review related files, understand the full data flow, and have a backup hypothesis ready before making changes. Consider dropping investigation notes to `.claude/` so context survives between runs.

**Wire things up completely.** Don't half-implement features. If you're adding a component, make sure it's actually used and functional end-to-end.

**Trust stated intuitions.** If I say "it's not X", I've probably already checked. Don't re-investigate X.

**ALWAYS suggest restarting the dev server.** I hate reloading, but that aversion can mask whether a fix actually worked. If there's *any* doubt that hot-reload might not pick up the change (store changes, new imports, structural changes), explicitly say: "Restart the dev server to test this." The app working matters more than avoiding a restart.

**Personal project pragmatism.** Don't over-engineer. Don't build for hypothetical future requirements.

---

## Project-Specific Context

<!-- Fill these in per-repo -->

### Stack
- Framework:
- Package manager: `bun` / `pnpm` / `npm`
- Runtime:

### Key Architectural Decisions
<!-- e.g., "two store systems exist, use X for new work" -->

### Compliance/Security Constraints
<!-- e.g., "HIPAA - no optimistic uploads", "offline-first required" -->

### Common Gotchas
<!-- Framework-specific pitfalls you've hit before -->

### Build Commands
```bash
# Dev
# Build
# Test
```

### Key Files
| File | Purpose |
|------|---------|
|  |  |
