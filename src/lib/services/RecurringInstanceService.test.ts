import { describe, it, expect } from 'vitest';
import {
	processRecurringInstances,
	isActiveToday,
	hasPastUncompletedInstances,
	completeInstance,
	skipInstance,
	uncompleteInstance,
	getTaskDateGroup,
	calculateUrgencyScore
} from './RecurringInstanceService';
import type { TaskFrontmatter } from '$lib/storage/frontmatter';

// Test date constant
const TODAY = '2026-01-25';

// Helper to create a minimal frontmatter object for testing
function createTestFrontmatter(overrides: Partial<TaskFrontmatter> = {}): TaskFrontmatter {
	return {
		status: 'open',
		priority: 'none',
		scheduled: null,
		due: null,
		startTime: null,
		plannedDuration: null,
		tags: [],
		contexts: [],
		projects: [],
		recurrence: null,
		recurrence_anchor: 'scheduled',
		active_instances: [],
		complete_instances: [],
		skipped_instances: [],
		rescheduled_instances: {},
		seriesId: null,
		isSeriesTemplate: false,
		parentId: null,
		timeEntries: [],
		dateCreated: '2026-01-24T12:00:00.000Z',
		dateModified: '2026-01-25T10:00:00.000Z',
		completedAt: null,
		...overrides
	};
}

describe('isActiveToday', () => {
	it('returns true when today is in active_instances', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-24', '2026-01-25'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		expect(isActiveToday(frontmatter, TODAY)).toBe(true);
	});

	it('returns false when today is not in active_instances', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-24', '2026-01-26'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		expect(isActiveToday(frontmatter, TODAY)).toBe(false);
	});

	it('returns false when today is completed', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-25'],
			complete_instances: ['2026-01-25'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		expect(isActiveToday(frontmatter, TODAY)).toBe(false);
	});

	it('returns false when today is skipped', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-25'],
			skipped_instances: ['2026-01-25'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		expect(isActiveToday(frontmatter, TODAY)).toBe(false);
	});
});

describe('hasPastUncompletedInstances', () => {
	it('returns true when there are past active instances not completed', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-23', '2026-01-24', '2026-01-25'],
			complete_instances: ['2026-01-23'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		// 2026-01-24 is past and not completed
		expect(hasPastUncompletedInstances(frontmatter, TODAY)).toBe(true);
	});

	it('returns false when all past instances are completed', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-23', '2026-01-24', '2026-01-25'],
			complete_instances: ['2026-01-23', '2026-01-24'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		expect(hasPastUncompletedInstances(frontmatter, TODAY)).toBe(false);
	});

	it('returns false when past instances are skipped', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-23', '2026-01-24', '2026-01-25'],
			complete_instances: ['2026-01-23'],
			skipped_instances: ['2026-01-24'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		expect(hasPastUncompletedInstances(frontmatter, TODAY)).toBe(false);
	});

	it('returns false when no past instances exist', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-25', '2026-01-26'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		expect(hasPastUncompletedInstances(frontmatter, TODAY)).toBe(false);
	});
});

describe('completeInstance', () => {
	it('adds date to complete_instances', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-25'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		const result = completeInstance(frontmatter, TODAY);

		expect(result).toBe(true);
		expect(frontmatter.complete_instances).toContain('2026-01-25');
	});

	it('removes from skipped_instances if present', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-25'],
			skipped_instances: ['2026-01-25'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		completeInstance(frontmatter, TODAY);

		expect(frontmatter.skipped_instances).not.toContain('2026-01-25');
		expect(frontmatter.complete_instances).toContain('2026-01-25');
	});

	it('returns false if date is not active', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-24'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		const result = completeInstance(frontmatter, TODAY);

		expect(result).toBe(false);
	});

	it('returns false if already completed', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-25'],
			complete_instances: ['2026-01-25'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		const result = completeInstance(frontmatter, TODAY);

		expect(result).toBe(false);
	});

	it('sorts complete_instances chronologically', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-23', '2026-01-25'],
			complete_instances: ['2026-01-23'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		completeInstance(frontmatter, TODAY);

		expect(frontmatter.complete_instances).toEqual(['2026-01-23', '2026-01-25']);
	});
});

describe('skipInstance', () => {
	it('adds date to skipped_instances', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-25'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		const result = skipInstance(frontmatter, TODAY);

		expect(result).toBe(true);
		expect(frontmatter.skipped_instances).toContain('2026-01-25');
	});

	it('removes from complete_instances if present', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-25'],
			complete_instances: ['2026-01-25'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		skipInstance(frontmatter, TODAY);

		expect(frontmatter.complete_instances).not.toContain('2026-01-25');
		expect(frontmatter.skipped_instances).toContain('2026-01-25');
	});
});

describe('uncompleteInstance', () => {
	it('removes date from complete_instances', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-25'],
			complete_instances: ['2026-01-25'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		const result = uncompleteInstance(frontmatter, TODAY);

		expect(result).toBe(true);
		expect(frontmatter.complete_instances).not.toContain('2026-01-25');
	});

	it('returns false if not completed', () => {
		const frontmatter = createTestFrontmatter({
			active_instances: ['2026-01-25'],
			recurrence: 'DTSTART:20260101;FREQ=DAILY'
		});

		const result = uncompleteInstance(frontmatter, TODAY);

		expect(result).toBe(false);
	});
});

describe('getTaskDateGroup', () => {
	it('returns Wrapped for done status', () => {
		const frontmatter = createTestFrontmatter({
			status: 'done'
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Wrapped');
	});

	it('returns Wrapped for recurring task completed today', () => {
		const frontmatter = createTestFrontmatter({
			recurrence: 'DTSTART:20260101;FREQ=DAILY',
			active_instances: ['2026-01-25'],
			complete_instances: ['2026-01-25']
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Wrapped');
	});

	it('returns Past for recurring task with past uncompleted instances', () => {
		const frontmatter = createTestFrontmatter({
			recurrence: 'DTSTART:20260101;FREQ=DAILY',
			active_instances: ['2026-01-24', '2026-01-25']
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Past');
	});

	it('returns Now for recurring task active today', () => {
		const frontmatter = createTestFrontmatter({
			recurrence: 'DTSTART:20260101;FREQ=DAILY',
			active_instances: ['2026-01-25']
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Now');
	});

	it('returns Now for task scheduled today', () => {
		const frontmatter = createTestFrontmatter({
			scheduled: '2026-01-25'
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Now');
	});

	it('returns Now for task due today', () => {
		const frontmatter = createTestFrontmatter({
			due: '2026-01-25'
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Now');
	});

	it('returns Past for task scheduled in past', () => {
		const frontmatter = createTestFrontmatter({
			scheduled: '2026-01-20'
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Past');
	});

	it('returns Past for task due in past', () => {
		const frontmatter = createTestFrontmatter({
			due: '2026-01-20'
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Past');
	});

	it('returns Upcoming for task scheduled in future', () => {
		const frontmatter = createTestFrontmatter({
			scheduled: '2026-01-30'
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Upcoming');
	});

	it('returns Wrapped for task with no dates (unscheduled backlog)', () => {
		const frontmatter = createTestFrontmatter({});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Wrapped');
	});

	it('returns Wrapped for past scheduled task that was completed on that date', () => {
		const frontmatter = createTestFrontmatter({
			scheduled: '2026-01-20',
			complete_instances: ['2026-01-20']
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Wrapped');
	});

	it('returns Wrapped for past due task that was completed on that date', () => {
		const frontmatter = createTestFrontmatter({
			due: '2026-01-20',
			complete_instances: ['2026-01-20']
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Wrapped');
	});

	it('returns Upcoming for task due in future', () => {
		const frontmatter = createTestFrontmatter({
			due: '2026-01-30'
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Upcoming');
	});

	it('returns Wrapped for task with completion history but no scheduled date', () => {
		const frontmatter = createTestFrontmatter({
			complete_instances: ['2026-01-15', '2026-01-10']
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Wrapped');
	});

	it('returns Now for non-recurring task completed today but re-scheduled for today (activity ledger)', () => {
		const frontmatter = createTestFrontmatter({
			scheduled: TODAY,
			complete_instances: [TODAY]
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Now');
	});

	it('returns Now for recurring task manually scheduled for today even without matching RRULE instance', () => {
		const frontmatter = createTestFrontmatter({
			recurrence: 'DTSTART:20260120;FREQ=WEEKLY;BYDAY=FR',
			scheduled: TODAY, // TODAY is not a Friday
			active_instances: ['2026-01-24', '2026-01-31'],
			complete_instances: ['2026-01-24', '2026-01-31']
		});

		expect(getTaskDateGroup(frontmatter, TODAY)).toBe('Now');
	});
});

describe('calculateUrgencyScore', () => {
	it('returns priority weight for task with no dates', () => {
		expect(calculateUrgencyScore(createTestFrontmatter({ priority: 'high' }), TODAY)).toBe(3);
		expect(calculateUrgencyScore(createTestFrontmatter({ priority: 'normal' }), TODAY)).toBe(2);
		expect(calculateUrgencyScore(createTestFrontmatter({ priority: 'low' }), TODAY)).toBe(1);
		expect(calculateUrgencyScore(createTestFrontmatter({ priority: 'none' }), TODAY)).toBe(0);
	});

	it('adds urgency for closer scheduled date', () => {
		const taskToday = createTestFrontmatter({
			priority: 'normal',
			scheduled: '2026-01-25'
		});
		const taskNextWeek = createTestFrontmatter({
			priority: 'normal',
			scheduled: '2026-02-01'
		});

		// Today: priority(2) + max(0, 10 - 0) = 12
		expect(calculateUrgencyScore(taskToday, TODAY)).toBe(12);
		// 7 days away: priority(2) + max(0, 10 - 7) = 5
		expect(calculateUrgencyScore(taskNextWeek, TODAY)).toBe(5);
	});

	it('uses earlier of scheduled or due date', () => {
		const task = createTestFrontmatter({
			priority: 'normal',
			scheduled: '2026-02-01',
			due: '2026-01-26' // Due date is sooner
		});

		// Due in 1 day: priority(2) + max(0, 10 - 1) = 11
		expect(calculateUrgencyScore(task, TODAY)).toBe(11);
	});

	it('caps urgency bonus at 10', () => {
		const task = createTestFrontmatter({
			priority: 'none',
			scheduled: '2026-01-25'
		});

		// Today: priority(0) + max(0, 10 - 0) = 10
		expect(calculateUrgencyScore(task, TODAY)).toBe(10);
	});

	it('does not add negative urgency for far future dates', () => {
		const task = createTestFrontmatter({
			priority: 'normal',
			scheduled: '2026-03-01' // 35 days away
		});

		// priority(2) + max(0, 10 - 35) = 2
		expect(calculateUrgencyScore(task, TODAY)).toBe(2);
	});
});

describe('processRecurringInstances', () => {
	it('adds today to active_instances for daily recurring task', () => {
		const tasks = new Map<string, TaskFrontmatter>();
		const task = createTestFrontmatter({
			isSeriesTemplate: true,
			recurrence: 'DTSTART:20260120;FREQ=DAILY',
			active_instances: []
		});
		tasks.set('Daily Task.md', task);

		const result = processRecurringInstances(tasks, undefined, TODAY);

		expect(result.updated).toBe(1);
		expect(result.updatedFiles).toContain('Daily Task.md');
		expect(task.active_instances).toContain('2026-01-25');
	});

	it('skips non-recurring tasks', () => {
		const tasks = new Map<string, TaskFrontmatter>();
		const task = createTestFrontmatter({
			isSeriesTemplate: false,
			recurrence: null
		});
		tasks.set('Regular Task.md', task);

		const result = processRecurringInstances(tasks, undefined, TODAY);

		expect(result.updated).toBe(0);
	});

	it('processes recurring tasks regardless of isSeriesTemplate flag', () => {
		const tasks = new Map<string, TaskFrontmatter>();
		const task = createTestFrontmatter({
			isSeriesTemplate: false,
			recurrence: 'DTSTART:20260120;FREQ=DAILY'
		});
		tasks.set('Instance Task.md', task);

		const result = processRecurringInstances(tasks, undefined, TODAY);

		expect(result.updated).toBe(1);
		expect(task.active_instances.length).toBeGreaterThan(0);
	});

	it('does not duplicate existing active_instances', () => {
		const tasks = new Map<string, TaskFrontmatter>();
		const task = createTestFrontmatter({
			isSeriesTemplate: true,
			recurrence: 'DTSTART:20260120;FREQ=DAILY',
			active_instances: ['2026-01-25']
		});
		tasks.set('Daily Task.md', task);

		const result = processRecurringInstances(tasks, undefined, TODAY);

		// May still update due to adding other dates in the window
		expect(task.active_instances.filter((d) => d === '2026-01-25')).toHaveLength(1);
	});

	it('adds instances within look-behind window', () => {
		const tasks = new Map<string, TaskFrontmatter>();
		const task = createTestFrontmatter({
			isSeriesTemplate: true,
			recurrence: 'DTSTART:20260120;FREQ=DAILY',
			active_instances: []
		});
		tasks.set('Daily Task.md', task);

		// Default look-behind is 7 days
		processRecurringInstances(
			tasks,
			{ lookAheadDays: 30, lookBehindDays: 7 },
			TODAY
		);

		// Should include dates from 2026-01-18 through today
		expect(task.active_instances).toContain('2026-01-20');
		expect(task.active_instances).toContain('2026-01-25');
	});

	it('sorts active_instances chronologically', () => {
		const tasks = new Map<string, TaskFrontmatter>();
		const task = createTestFrontmatter({
			isSeriesTemplate: true,
			recurrence: 'DTSTART:20260120;FREQ=DAILY',
			active_instances: ['2026-01-22']
		});
		tasks.set('Daily Task.md', task);

		processRecurringInstances(tasks, undefined, TODAY);

		// Should be sorted
		const sorted = [...task.active_instances].sort();
		expect(task.active_instances).toEqual(sorted);
	});

	it('handles weekly recurrence correctly', () => {
		const tasks = new Map<string, TaskFrontmatter>();
		const task = createTestFrontmatter({
			isSeriesTemplate: true,
			// Monday only - 2026-01-19 was a Monday, next is 2026-01-26
			// 2026-01-25 (TODAY) is a Sunday
			recurrence: 'DTSTART:20260119;FREQ=WEEKLY;BYDAY=MO',
			active_instances: []
		});
		tasks.set('Weekly Task.md', task);

		processRecurringInstances(tasks, undefined, TODAY);

		// Should contain 2026-01-19 (past Monday in lookBehind) and 2026-01-26 (next Monday)
		expect(task.active_instances).toContain('2026-01-19');
		expect(task.active_instances).toContain('2026-01-26');
		expect(task.active_instances).not.toContain('2026-01-25'); // Sunday
	});
});
