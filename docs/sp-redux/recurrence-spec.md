# Recurrence Specification

> Data format and implementation details for recurring tasks in SP Redux.

---

## Data Model

### Recurrence Interface

```typescript
interface Recurrence {
  /** Base frequency */
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';

  /** Interval (e.g., every 2 weeks = frequency: weekly, interval: 2) */
  interval: number;

  /** For weekly: which days of the week */
  weekDays?: WeekDay[];

  /** For monthly: day of month (1-31) */
  dayOfMonth?: number;

  /** For monthly nth weekday: which occurrence (1-5, -1 for last) */
  nthWeekday?: number;

  /** For monthly nth weekday: which day */
  weekdayForNth?: WeekDay;

  /** Start date for the recurrence (YYYY-MM-DD) */
  startDate: string;

  /** Optional end date (YYYY-MM-DD) */
  endDate?: string;
}

type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
```

### Storage Location

Recurrence rules are stored on **series templates** only:

```typescript
interface Task {
  // ...
  isSeriesTemplate: boolean;      // true for template tasks
  recurrence: Recurrence | null;  // only populated for templates
  seriesId: string | null;        // instances reference their template
}
```

---

## Supported Patterns

### Daily Recurrence

| Pattern | Data |
|---------|------|
| Every day | `{ frequency: 'daily', interval: 1 }` |
| Every 3 days | `{ frequency: 'daily', interval: 3 }` |

**Display format:** "Every day" or "Every N days"

### Weekly Recurrence

| Pattern | Data |
|---------|------|
| Weekly on Wed | `{ frequency: 'weekly', interval: 1, weekDays: ['wed'] }` |
| Mon-Fri | `{ frequency: 'weekly', interval: 1, weekDays: ['mon','tue','wed','thu','fri'] }` |
| We, Th, Fr | `{ frequency: 'weekly', interval: 1, weekDays: ['wed','thu','fri'] }` |
| Every 2 weeks | `{ frequency: 'weekly', interval: 2, weekDays: ['mon'] }` |

**Display format:**
- Single day: "Weekly on Wed"
- Mon-Fri pattern: "Mon-Fri"
- Multiple days: "We, Th, Fr" (2-letter abbreviations)
- With interval: "Every N weeks"

### Monthly Recurrence (Day of Month)

| Pattern | Data |
|---------|------|
| Monthly on 5th | `{ frequency: 'monthly', interval: 1, dayOfMonth: 5 }` |
| Monthly on 15th | `{ frequency: 'monthly', interval: 1, dayOfMonth: 15 }` |
| Monthly on 31st | `{ frequency: 'monthly', interval: 1, dayOfMonth: 31 }` |

**Display format:** "Monthly on 5th" (with ordinal suffix: st, nd, rd, th)

### Monthly Recurrence (Nth Weekday)

| Pattern | Data |
|---------|------|
| 2nd Tuesday | `{ frequency: 'monthly', interval: 1, nthWeekday: 2, weekdayForNth: 'tue' }` |
| Last Friday | `{ frequency: 'monthly', interval: 1, nthWeekday: -1, weekdayForNth: 'fri' }` |

**Display format:** "Monthly on 2nd Tue" or "Monthly on last Fri"

### Yearly Recurrence

| Pattern | Data |
|---------|------|
| Yearly | `{ frequency: 'yearly', interval: 1, startDate: '2024-03-15' }` |

Occurs on the same month/day each year.

**Display format:** "Yearly"

---

## Display Format Examples

The `formatRecurrenceShort()` function produces these exact outputs:

| Recurrence | Output |
|------------|--------|
| Daily | `Every day` |
| Every 2 days | `Every 2 days` |
| Mon-Fri | `Mon-Fri` |
| Single day weekly | `Weekly on Wed` |
| Multiple days | `We, Th, Fr` |
| Monthly day-of-month | `Monthly on 5th` |
| Monthly nth weekday | `2nd Tue` |
| Yearly | `Yearly` |

---

## Implementation Details

### Series Template vs Instances

1. **Series Template**: A task with `isSeriesTemplate: true` and a `recurrence` object
   - Not displayed in regular task lists
   - Used as the source of truth for recurring pattern

2. **Instances**: Tasks with `seriesId` pointing to a template
   - Have `scheduledDate` set to specific occurrence dates
   - Can be rescheduled independently (doesn't affect series rule)
   - Can be completed independently

### Occurrence Generation

```typescript
generateOccurrences(recurrence, windowStart, windowEnd): string[]
```

- Generates occurrence dates within the specified window
- Returns array of YYYY-MM-DD date strings
- Uses UTC date math internally
- Handles leap years and month boundaries
- Limited to 5000 iterations maximum

### Generation Rules

**Rule B: Generate occurrences regardless of completion**
- A completed instance doesn't prevent future occurrences
- Each instance is independent once created
- Rescheduling affects only that instance

### Rolling Window

When creating a recurring task, instances are generated for:
- **Start:** Today's date
- **End:** 30 days from today

Additional instances can be generated as needed when the window advances.

---

## API Functions

### Creating Recurrences

```typescript
// Daily
createDailyRecurrence(startDate: string, interval?: number): Recurrence

// Weekly
createWeeklyRecurrence(startDate: string, weekDays: WeekDay[], interval?: number): Recurrence

// Monthly (day of month)
createMonthlyRecurrence(startDate: string, dayOfMonth?: number): Recurrence

// Monthly (nth weekday)
createMonthlyNthWeekdayRecurrence(startDate: string, nth: number, weekday: WeekDay): Recurrence

// Yearly
createYearlyRecurrence(startDate: string): Recurrence
```

### Formatting

```typescript
// Human-readable description
describeRecurrence(recurrence: Recurrence): string
// → "Every day", "Mon-Fri", "Weekly on Wed", "Monthly on 5th"

// Short format for task rows
formatRecurrenceShort(recurrence: Recurrence): string
// → Same output, optimized for compact display
```

### Querying

```typescript
// Get all series templates
seriesTemplates(tasks: Task[]): Task[]

// Get instances of a specific series
seriesInstances(tasks: Task[], seriesId: string): Task[]
```

---

## File Location

Recurrence implementation: `src/lib/domain/recurrence.ts`

Selectors for querying: `src/lib/domain/selectors.ts`
