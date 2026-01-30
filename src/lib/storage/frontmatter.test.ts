import { describe, it, expect } from 'vitest';
import {
	parseMarkdown,
	serializeMarkdown,
	taskToFrontmatter,
	frontmatterToTask,
	recurrenceToRRule,
	rruleToRecurrence,
	type TaskFrontmatter
} from './frontmatter';
import { createTask, type Task } from '$lib/domain/task';
import { createDailyRecurrence, createWeeklyRecurrence, createMonthlyRecurrence } from '$lib/domain/recurrence';

describe('parseMarkdown', () => {
	it('parses valid markdown with frontmatter', () => {
		const content = `---
status: open
priority: normal
scheduled: 2026-01-25
tags:
  - task
  - work
contexts:
  - computer
dateCreated: 2026-01-24T12:00:00.000Z
dateModified: 2026-01-25T10:00:00.000Z
---

Task description here.
`;

		const result = parseMarkdown(content);
		expect(result).not.toBeNull();
		expect(result!.frontmatter.status).toBe('open');
		expect(result!.frontmatter.priority).toBe('normal');
		expect(result!.frontmatter.scheduled).toBe('2026-01-25');
		expect(result!.frontmatter.tags).toEqual(['task', 'work']);
		expect(result!.frontmatter.contexts).toEqual(['computer']);
		expect(result!.body).toBe('Task description here.');
	});

	it('returns null for invalid frontmatter', () => {
		const content = `No frontmatter here
Just regular markdown.`;

		const result = parseMarkdown(content);
		expect(result).toBeNull();
	});

	it('handles empty body', () => {
		const content = `---
status: open
dateCreated: 2026-01-24T12:00:00.000Z
dateModified: 2026-01-25T10:00:00.000Z
---
`;

		const result = parseMarkdown(content);
		expect(result).not.toBeNull();
		expect(result!.body).toBe('');
	});

	it('normalizes status with default', () => {
		const content = `---
status: invalid_status
dateCreated: 2026-01-24T12:00:00.000Z
dateModified: 2026-01-25T10:00:00.000Z
---
`;

		const result = parseMarkdown(content);
		expect(result!.frontmatter.status).toBe('open');
	});

	it('normalizes priority with default', () => {
		const content = `---
priority: invalid
dateCreated: 2026-01-24T12:00:00.000Z
dateModified: 2026-01-25T10:00:00.000Z
---
`;

		const result = parseMarkdown(content);
		expect(result!.frontmatter.priority).toBe('none');
	});

	it('handles Date objects from YAML parser', () => {
		// When YAML parses dates without quotes, they may be Date objects
		const content = `---
scheduled: 2026-01-25
dateCreated: 2026-01-24T12:00:00.000Z
dateModified: 2026-01-25T10:00:00.000Z
---
`;

		const result = parseMarkdown(content);
		expect(result!.frontmatter.scheduled).toBe('2026-01-25');
	});

	it('handles legacy single project field', () => {
		const content = `---
project: My Project
dateCreated: 2026-01-24T12:00:00.000Z
dateModified: 2026-01-25T10:00:00.000Z
---
`;

		const result = parseMarkdown(content);
		expect(result!.frontmatter.projects).toEqual(['My Project']);
	});

	it('prefers projects array over legacy project field', () => {
		const content = `---
project: Old Project
projects:
  - New Project 1
  - New Project 2
dateCreated: 2026-01-24T12:00:00.000Z
dateModified: 2026-01-25T10:00:00.000Z
---
`;

		const result = parseMarkdown(content);
		expect(result!.frontmatter.projects).toEqual(['New Project 1', 'New Project 2']);
	});

	it('parses time entries', () => {
		const content = `---
timeEntries:
  - date: 2026-01-25
    minutes: 30
    note: Worked on feature
    createdAt: 2026-01-25T10:00:00.000Z
  - date: 2026-01-24
    minutes: 45
    createdAt: 2026-01-24T09:00:00.000Z
dateCreated: 2026-01-24T12:00:00.000Z
dateModified: 2026-01-25T10:00:00.000Z
---
`;

		const result = parseMarkdown(content);
		expect(result!.frontmatter.timeEntries).toHaveLength(2);
		expect(result!.frontmatter.timeEntries[0].minutes).toBe(30);
		expect(result!.frontmatter.timeEntries[0].note).toBe('Worked on feature');
		expect(result!.frontmatter.timeEntries[1].note).toBeNull();
	});

	it('parses instance tracking arrays', () => {
		const content = `---
active_instances:
  - 2026-01-24
  - 2026-01-25
complete_instances:
  - 2026-01-24
skipped_instances: []
dateCreated: 2026-01-24T12:00:00.000Z
dateModified: 2026-01-25T10:00:00.000Z
---
`;

		const result = parseMarkdown(content);
		expect(result!.frontmatter.active_instances).toEqual(['2026-01-24', '2026-01-25']);
		expect(result!.frontmatter.complete_instances).toEqual(['2026-01-24']);
		expect(result!.frontmatter.skipped_instances).toEqual([]);
	});
});

describe('serializeMarkdown', () => {
	it('serializes frontmatter and body', () => {
		const frontmatter: TaskFrontmatter = {
			status: 'open',
			priority: 'normal',
			scheduled: '2026-01-25',
			due: null,
			startTime: null,
			plannedDuration: null,
			tags: ['task', 'work'],
			contexts: ['computer'],
			projects: ['Project A'],
			recurrence: null,
			recurrence_anchor: 'scheduled',
			active_instances: [],
			complete_instances: [],
			skipped_instances: [],
			seriesId: null,
			isSeriesTemplate: false,
			parentId: null,
			timeEntries: [],
			dateCreated: '2026-01-24T12:00:00.000Z',
			dateModified: '2026-01-25T10:00:00.000Z',
			completedAt: null
		};

		const result = serializeMarkdown(frontmatter, 'Task description here.');

		expect(result).toContain('---');
		expect(result).toContain('status: open');
		expect(result).toContain('priority: normal');
		expect(result).toContain('scheduled: 2026-01-25');
		expect(result).toContain('tags:');
		expect(result).toContain('  - task');
		expect(result).toContain('Task description here.');
	});

	it('omits empty arrays and null values', () => {
		const frontmatter: TaskFrontmatter = {
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
			seriesId: null,
			isSeriesTemplate: false,
			parentId: null,
			timeEntries: [],
			dateCreated: '2026-01-24T12:00:00.000Z',
			dateModified: '2026-01-25T10:00:00.000Z',
			completedAt: null
		};

		const result = serializeMarkdown(frontmatter, '');

		expect(result).not.toContain('scheduled:');
		expect(result).not.toContain('tags:');
		expect(result).not.toContain('active_instances:');
		expect(result).not.toContain('seriesId:');
	});

	it('includes recurrence with anchor', () => {
		const frontmatter: TaskFrontmatter = {
			status: 'open',
			priority: 'none',
			scheduled: '2026-01-25',
			due: null,
			startTime: null,
			plannedDuration: null,
			tags: [],
			contexts: [],
			projects: [],
			recurrence: 'DTSTART:20260125;FREQ=DAILY',
			recurrence_anchor: 'scheduled',
			active_instances: ['2026-01-25'],
			complete_instances: [],
			skipped_instances: [],
			seriesId: null,
			isSeriesTemplate: true,
			parentId: null,
			timeEntries: [],
			dateCreated: '2026-01-24T12:00:00.000Z',
			dateModified: '2026-01-25T10:00:00.000Z',
			completedAt: null
		};

		const result = serializeMarkdown(frontmatter, '');

		expect(result).toContain('recurrence: DTSTART:20260125;FREQ=DAILY');
		expect(result).toContain('recurrence_anchor: scheduled');
		expect(result).toContain('isSeriesTemplate: true');
	});
});

describe('roundtrip: parse -> serialize -> parse', () => {
	it('preserves all data through roundtrip', () => {
		const original: TaskFrontmatter = {
			status: 'done',
			priority: 'high',
			scheduled: '2026-01-25',
			due: '2026-01-30',
			startTime: '09:00',
			plannedDuration: 60,
			tags: ['task', 'urgent'],
			contexts: ['work', 'phone'],
			projects: ['Big Project'],
			recurrence: 'DTSTART:20260125;FREQ=WEEKLY;BYDAY=MO,WE,FR',
			recurrence_anchor: 'scheduled',
			active_instances: ['2026-01-25', '2026-01-27'],
			complete_instances: ['2026-01-25'],
			skipped_instances: [],
			seriesId: null,
			isSeriesTemplate: true,
			parentId: null,
			timeEntries: [
				{ date: '2026-01-25', minutes: 30, note: 'Did work', createdAt: '2026-01-25T10:00:00.000Z' }
			],
			dateCreated: '2026-01-24T12:00:00.000Z',
			dateModified: '2026-01-25T10:00:00.000Z',
			completedAt: '2026-01-25T15:00:00.000Z'
		};

		const body = 'Task notes go here.\n\nMultiple paragraphs.';
		const serialized = serializeMarkdown(original, body);
		const parsed = parseMarkdown(serialized);

		expect(parsed).not.toBeNull();
		expect(parsed!.frontmatter.status).toBe(original.status);
		expect(parsed!.frontmatter.priority).toBe(original.priority);
		expect(parsed!.frontmatter.scheduled).toBe(original.scheduled);
		expect(parsed!.frontmatter.due).toBe(original.due);
		expect(parsed!.frontmatter.startTime).toBe(original.startTime);
		expect(parsed!.frontmatter.tags).toEqual(original.tags);
		expect(parsed!.frontmatter.contexts).toEqual(original.contexts);
		expect(parsed!.frontmatter.projects).toEqual(original.projects);
		expect(parsed!.frontmatter.recurrence).toBe(original.recurrence);
		expect(parsed!.frontmatter.active_instances).toEqual(original.active_instances);
		expect(parsed!.frontmatter.complete_instances).toEqual(original.complete_instances);
		expect(parsed!.frontmatter.isSeriesTemplate).toBe(original.isSeriesTemplate);
		expect(parsed!.frontmatter.timeEntries).toHaveLength(1);
		expect(parsed!.frontmatter.completedAt).toBe(original.completedAt);
		expect(parsed!.body).toBe(body);
	});
});

describe('taskToFrontmatter', () => {
	it('converts completed task to done status', () => {
		const task = createTask({
			title: 'Test Task',
			completed: true,
			completedAt: '2026-01-25T15:00:00.000Z'
		});

		const frontmatter = taskToFrontmatter(task);

		expect(frontmatter.status).toBe('done');
		expect(frontmatter.completedAt).toBe('2026-01-25T15:00:00.000Z');
	});

	it('converts incomplete task to open status', () => {
		const task = createTask({
			title: 'Test Task',
			completed: false
		});

		const frontmatter = taskToFrontmatter(task);

		expect(frontmatter.status).toBe('open');
	});

	it('converts single project to projects array', () => {
		const task = createTask({
			title: 'Test Task',
			project: 'My Project'
		});

		const frontmatter = taskToFrontmatter(task);

		expect(frontmatter.projects).toEqual(['My Project']);
	});

	it('converts recurrence object to RRULE string', () => {
		const task = createTask({
			title: 'Test Task',
			recurrence: createDailyRecurrence('2026-01-25', 1),
			isSeriesTemplate: true
		});

		const frontmatter = taskToFrontmatter(task);

		expect(frontmatter.recurrence).toContain('FREQ=DAILY');
		expect(frontmatter.recurrence).toContain('DTSTART:20260125');
	});

	it('preserves all task fields', () => {
		const task = createTask({
			title: 'Test Task',
			tags: ['work', 'urgent'],
			contexts: ['computer'],
			project: 'Big Project',
			scheduledDate: '2026-01-25',
			startTime: '09:00',
			seriesId: 'series-123',
			parentId: 'parent-456'
		});

		const frontmatter = taskToFrontmatter(task);

		expect(frontmatter.tags).toEqual(['work', 'urgent']);
		expect(frontmatter.contexts).toEqual(['computer']);
		expect(frontmatter.projects).toEqual(['Big Project']);
		expect(frontmatter.scheduled).toBe('2026-01-25');
		expect(frontmatter.startTime).toBe('09:00');
		expect(frontmatter.seriesId).toBe('series-123');
		expect(frontmatter.parentId).toBe('parent-456');
	});
});

describe('frontmatterToTask', () => {
	it('converts done status to completed true', () => {
		const frontmatter: TaskFrontmatter = {
			status: 'done',
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
			seriesId: null,
			isSeriesTemplate: false,
			parentId: null,
			timeEntries: [],
			dateCreated: '2026-01-24T12:00:00.000Z',
			dateModified: '2026-01-25T10:00:00.000Z',
			completedAt: '2026-01-25T15:00:00.000Z'
		};

		const task = frontmatterToTask(frontmatter, 'Test Task.md', '');

		expect(task.completed).toBe(true);
		expect(task.completedAt).toBe('2026-01-25T15:00:00.000Z');
	});

	it('uses filename as title', () => {
		const frontmatter: TaskFrontmatter = {
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
			seriesId: null,
			isSeriesTemplate: false,
			parentId: null,
			timeEntries: [],
			dateCreated: '2026-01-24T12:00:00.000Z',
			dateModified: '2026-01-25T10:00:00.000Z',
			completedAt: null
		};

		const task = frontmatterToTask(frontmatter, 'My Task Title.md', '');

		expect(task.title).toBe('My Task Title');
	});

	it('uses first project from array', () => {
		const frontmatter: TaskFrontmatter = {
			status: 'open',
			priority: 'none',
			scheduled: null,
			due: null,
			startTime: null,
			plannedDuration: null,
			tags: [],
			contexts: [],
			projects: ['Project 1', 'Project 2'],
			recurrence: null,
			recurrence_anchor: 'scheduled',
			active_instances: [],
			complete_instances: [],
			skipped_instances: [],
			seriesId: null,
			isSeriesTemplate: false,
			parentId: null,
			timeEntries: [],
			dateCreated: '2026-01-24T12:00:00.000Z',
			dateModified: '2026-01-25T10:00:00.000Z',
			completedAt: null
		};

		const task = frontmatterToTask(frontmatter, 'Test.md', '');

		expect(task.project).toBe('Project 1');
	});

	it('converts RRULE to recurrence object', () => {
		const frontmatter: TaskFrontmatter = {
			status: 'open',
			priority: 'none',
			scheduled: '2026-01-25',
			due: null,
			startTime: null,
			plannedDuration: null,
			tags: [],
			contexts: [],
			projects: [],
			recurrence: 'DTSTART:20260125;FREQ=WEEKLY;BYDAY=MO,WE,FR',
			recurrence_anchor: 'scheduled',
			active_instances: [],
			complete_instances: [],
			skipped_instances: [],
			seriesId: null,
			isSeriesTemplate: true,
			parentId: null,
			timeEntries: [],
			dateCreated: '2026-01-24T12:00:00.000Z',
			dateModified: '2026-01-25T10:00:00.000Z',
			completedAt: null
		};

		const task = frontmatterToTask(frontmatter, 'Test.md', '');

		expect(task.recurrence).not.toBeNull();
		expect(task.recurrence!.frequency).toBe('weekly');
		expect(task.recurrence!.weekDays).toEqual(['mon', 'wed', 'fri']);
	});
});

describe('recurrenceToRRule', () => {
	it('converts daily recurrence', () => {
		const rec = createDailyRecurrence('2026-01-25', 1);
		const rrule = recurrenceToRRule(rec);

		expect(rrule).toBe('DTSTART:20260125;FREQ=DAILY');
	});

	it('converts daily recurrence with interval', () => {
		const rec = createDailyRecurrence('2026-01-25', 3);
		const rrule = recurrenceToRRule(rec);

		expect(rrule).toContain('FREQ=DAILY');
		expect(rrule).toContain('INTERVAL=3');
	});

	it('converts weekly recurrence with days', () => {
		const rec = createWeeklyRecurrence('2026-01-25', ['mon', 'wed', 'fri']);
		const rrule = recurrenceToRRule(rec);

		expect(rrule).toContain('FREQ=WEEKLY');
		expect(rrule).toContain('BYDAY=MO,WE,FR');
	});

	it('converts monthly day-of-month recurrence', () => {
		const rec = createMonthlyRecurrence('2026-01-15', 15);
		const rrule = recurrenceToRRule(rec);

		expect(rrule).toContain('FREQ=MONTHLY');
		expect(rrule).toContain('BYMONTHDAY=15');
	});

	it('converts recurrence with end date', () => {
		const rec = createDailyRecurrence('2026-01-25');
		rec.endDate = '2026-12-31';
		const rrule = recurrenceToRRule(rec);

		expect(rrule).toContain('UNTIL=20261231');
	});
});

describe('rruleToRecurrence', () => {
	it('parses daily RRULE', () => {
		const rrule = 'DTSTART:20260125;FREQ=DAILY';
		const rec = rruleToRecurrence(rrule);

		expect(rec).not.toBeNull();
		expect(rec!.frequency).toBe('daily');
		expect(rec!.startDate).toBe('2026-01-25');
		expect(rec!.interval).toBe(1);
	});

	it('parses daily RRULE with interval', () => {
		const rrule = 'DTSTART:20260125;FREQ=DAILY;INTERVAL=3';
		const rec = rruleToRecurrence(rrule);

		expect(rec!.interval).toBe(3);
	});

	it('parses weekly RRULE with BYDAY', () => {
		const rrule = 'DTSTART:20260125;FREQ=WEEKLY;BYDAY=MO,WE,FR';
		const rec = rruleToRecurrence(rrule);

		expect(rec!.frequency).toBe('weekly');
		expect(rec!.weekDays).toEqual(['mon', 'wed', 'fri']);
	});

	it('parses monthly RRULE with BYMONTHDAY', () => {
		const rrule = 'DTSTART:20260115;FREQ=MONTHLY;BYMONTHDAY=15';
		const rec = rruleToRecurrence(rrule);

		expect(rec!.frequency).toBe('monthly');
		expect(rec!.dayOfMonth).toBe(15);
	});

	it('parses monthly nth weekday RRULE', () => {
		const rrule = 'DTSTART:20260101;FREQ=MONTHLY;BYDAY=2TU';
		const rec = rruleToRecurrence(rrule);

		expect(rec!.frequency).toBe('monthly');
		expect(rec!.nthWeekday).toBe(2);
		expect(rec!.weekdayForNth).toBe('tue');
	});

	it('parses monthly last weekday RRULE', () => {
		const rrule = 'DTSTART:20260101;FREQ=MONTHLY;BYDAY=-1FR';
		const rec = rruleToRecurrence(rrule);

		expect(rec!.nthWeekday).toBe(-1);
		expect(rec!.weekdayForNth).toBe('fri');
	});

	it('parses RRULE with UNTIL', () => {
		const rrule = 'DTSTART:20260125;FREQ=DAILY;UNTIL=20261231';
		const rec = rruleToRecurrence(rrule);

		expect(rec!.endDate).toBe('2026-12-31');
	});
});

describe('RRULE roundtrip', () => {
	it('daily recurrence survives roundtrip', () => {
		const original = createDailyRecurrence('2026-01-25', 2);
		const rrule = recurrenceToRRule(original);
		const parsed = rruleToRecurrence(rrule);

		expect(parsed!.frequency).toBe(original.frequency);
		expect(parsed!.interval).toBe(original.interval);
		expect(parsed!.startDate).toBe(original.startDate);
	});

	it('weekly recurrence survives roundtrip', () => {
		const original = createWeeklyRecurrence('2026-01-25', ['mon', 'wed', 'fri'], 2);
		const rrule = recurrenceToRRule(original);
		const parsed = rruleToRecurrence(rrule);

		expect(parsed!.frequency).toBe(original.frequency);
		expect(parsed!.interval).toBe(original.interval);
		expect(parsed!.weekDays).toEqual(original.weekDays);
	});

	it('monthly day-of-month recurrence survives roundtrip', () => {
		const original = createMonthlyRecurrence('2026-01-15', 15);
		const rrule = recurrenceToRRule(original);
		const parsed = rruleToRecurrence(rrule);

		expect(parsed!.frequency).toBe(original.frequency);
		expect(parsed!.dayOfMonth).toBe(original.dayOfMonth);
	});
});

describe('plannedDuration', () => {
	it('parses plannedDuration from frontmatter', () => {
		const content = `---
status: open
scheduled: 2026-01-29
startTime: "09:00"
plannedDuration: 90
tags:
  - task
dateCreated: 2026-01-29T00:00:00.000Z
dateModified: 2026-01-29T00:00:00.000Z
---
`;
		const result = parseMarkdown(content);
		expect(result).not.toBeNull();
		expect(result!.frontmatter.plannedDuration).toBe(90);
		expect(result!.frontmatter.startTime).toBe('09:00');
	});

	it('defaults to null when not present', () => {
		const content = `---
status: open
dateCreated: 2026-01-29T00:00:00.000Z
dateModified: 2026-01-29T00:00:00.000Z
---
`;
		const result = parseMarkdown(content);
		expect(result!.frontmatter.plannedDuration).toBeNull();
	});

	it('ignores zero and negative values', () => {
		const content = `---
status: open
plannedDuration: 0
dateCreated: 2026-01-29T00:00:00.000Z
dateModified: 2026-01-29T00:00:00.000Z
---
`;
		const result = parseMarkdown(content);
		expect(result!.frontmatter.plannedDuration).toBeNull();
	});

	it('coerces string values to numbers', () => {
		const content = `---
status: open
plannedDuration: "60"
dateCreated: 2026-01-29T00:00:00.000Z
dateModified: 2026-01-29T00:00:00.000Z
---
`;
		const result = parseMarkdown(content);
		expect(result!.frontmatter.plannedDuration).toBe(60);
	});

	it('roundtrips through serialize/parse', () => {
		const content = `---
status: open
scheduled: 2026-01-29
startTime: "09:00"
plannedDuration: 45
tags:
  - task
dateCreated: 2026-01-29T00:00:00.000Z
dateModified: 2026-01-29T00:00:00.000Z
---

Plan the sprint.
`;
		const parsed = parseMarkdown(content);
		const serialized = serializeMarkdown(parsed!.frontmatter, parsed!.body);
		const reparsed = parseMarkdown(serialized);

		expect(reparsed!.frontmatter.plannedDuration).toBe(45);
		expect(reparsed!.frontmatter.startTime).toBe('09:00');
		expect(reparsed!.frontmatter.scheduled).toBe('2026-01-29');
	});

	it('omits plannedDuration from serialization when null', () => {
		const content = `---
status: open
dateCreated: 2026-01-29T00:00:00.000Z
dateModified: 2026-01-29T00:00:00.000Z
---
`;
		const parsed = parseMarkdown(content);
		const serialized = serializeMarkdown(parsed!.frontmatter, parsed!.body);

		expect(serialized).not.toContain('plannedDuration');
	});
});
