# Shortcode Expansion — Dates & Recurrence

## Decision: `@` = dates/recurrence, contexts dropped

Contexts (`@home`, `@phone`) are unused. Reclaim `@` for dates and recurrence.

## Final Syntax

### Recurrence

| Input | Meaning | Recurrence output |
|-------|---------|-------------------|
| `@d` | Daily | `FREQ=DAILY` |
| `@w` | Weekly | `FREQ=WEEKLY` |
| `@m` | Monthly (today's day-of-month) | `FREQ=MONTHLY;BYMONTHDAY={today}` |
| `@wMWF` | Weekly on Mon/Wed/Fri | `FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| `@wTR` | Weekly on Tue/Thu | `FREQ=WEEKLY;BYDAY=TU,TH` |
| `@3d` | Every 3 days | `FREQ=DAILY;INTERVAL=3` |
| `@2w` | Every 2 weeks | `FREQ=WEEKLY;INTERVAL=2` |
| `@m15` | Monthly on the 15th | `FREQ=MONTHLY;BYMONTHDAY=15` |

Day letters: `M`=Mon, `T`=Tue, `W`=Wed, `R`=Thu, `F`=Fri, `S`=Sat, `U`=Sun

### Dates (set scheduled)

| Input | Meaning | Scheduled output |
|-------|---------|-----------------|
| `@tom` | Tomorrow | tomorrow's date |
| `@d22` | 22nd of this month | `{YYYY}-{MM}-22` |
| `@d3-15` | March 15th (this year) | `{YYYY}-03-15` |

### Parse disambiguation

| Token | Rule |
|-------|------|
| `@d` (bare) | Recurrence: daily |
| `@d` + digits | Date: day of this month (`@d22`) |
| `@d` + digits-digits | Date: month-day (`@d3-15`) |
| `@` + digits + `d` | Recurrence: every N days (`@3d`) |
| `@` + digits + `w` | Recurrence: every N weeks (`@2w`) |
| `@w` (bare) | Recurrence: weekly |
| `@w` + day letters | Recurrence: weekly on those days (`@wMWF`) |
| `@m` (bare) | Recurrence: monthly |
| `@m` + digits | Recurrence: monthly on Nth (`@m15`) |
| `@tom` | Date: tomorrow |

No ambiguity in practice: recurrence intervals (`@2d`–`@6d`) don't collide with useful dates (the 2nd–6th of a month are rarely scheduled by day-of-month).

## Scope

### Phase 0: Drop contexts
1. Remove `@context` parsing from `parser.ts`
2. Remove context UI (AddTask chips, edit modal)
3. Update `ParsedShortcodes` — drop `contexts`, add `scheduled: string | null` and `recurrence: Recurrence | null`
4. Leave existing `contexts` field in frontmatter (ignore, don't break old files)

### Phase 1: Date shortcuts
1. Add date token parser: `@tom`, `@d{N}`, `@d{M-D}`
2. Resolve to `YYYY-MM-DD` string
3. Wire `parsed.scheduled` into AddTask flow
4. Show parsed date in AddTask UI as confirmation

### Phase 2: Recurrence shortcuts
1. Add recurrence token parser: `@d`, `@w`, `@m`, `@{N}d`, `@{N}w`, `@w{DAYS}`, `@m{N}`
2. Build `Recurrence` object from parsed token
3. Wire into AddTask — call `addRecurringTask()` when recurrence detected
4. Show recurrence summary in AddTask UI

## Examples

```
Walmart @tom #errand +household
→ title: "Walmart", scheduled: tomorrow, tags: [errand], project: household

Stretch @d
→ title: "Stretch", recurrence: daily, startDate: today

Gym @wMWF
→ title: "Gym", recurrence: weekly MO,WE,FR, startDate: today

Dentist @d4-15
→ title: "Dentist", scheduled: 2026-04-15

Water plants @3d
→ title: "Water plants", recurrence: every 3 days, startDate: today

Pay rent @m1
→ title: "Pay rent", recurrence: monthly on 1st, startDate: today

Haircut @6w
→ title: "Haircut", recurrence: every 6 weeks, startDate: today

Review PR @d22 #work +daylight
→ title: "Review PR", scheduled: 22nd of this month, tags: [work], project: daylight
```
