import { describe, it, expect } from 'vitest';
import {
	createViewTasks,
	groupTasksByDateGroup,
	sortByUrgency,
	sortByScheduledDate,
	getTasksForDate,
	getCompletedTasksForDate,
	getOverdueTasks,
	getAllTags,
	getAllContexts,
	getAllProjects,
	filterByTag,
	filterByContext,
	filterByProject,
	filterIncomplete,
	filterCompleted,
	parseTimeToMinutes,
	minutesToTime,
	snapToGrid,
	getTimeBlocksForDate,
	detectCollisions,
	getUnplannedTasksForDates,
	getBacklogTasks,
	type ViewTask,
	type TimeBlock
} from './ViewService';
import type { TaskFrontmatter } from '$lib/storage/frontmatter';

// Test date
const TODAY = '2026-01-25';

// Helper to create frontmatter
function createFrontmatter(overrides: Partial<TaskFrontmatter> = {}): TaskFrontmatter {
	return {
		status: 'open',
		priority: 'none',
		scheduled: null,
		due: null,
		startTime: null,
		plannedDuration: null,
		tags: ['task'],
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

describe('createViewTasks', () => {
	it('creates view tasks from file map', () => {
		const files = new Map<string, { frontmatter: TaskFrontmatter; body: string }>();
		files.set('Task One.md', {
			frontmatter: createFrontmatter({ scheduled: TODAY }),
			body: 'Description'
		});
		files.set('Task Two.md', {
			frontmatter: createFrontmatter({ scheduled: '2026-01-26' }),
			body: ''
		});

		const tasks = createViewTasks(files, TODAY);

		expect(tasks).toHaveLength(2);
		expect(tasks[0].title).toBe('Task One');
		expect(tasks[0].filename).toBe('Task One.md');
		expect(tasks[0].body).toBe('Description');
	});

	it('filters out files without task tag', () => {
		const files = new Map<string, { frontmatter: TaskFrontmatter; body: string }>();
		files.set('Note.md', {
			frontmatter: createFrontmatter({ tags: [] }), // No task tag
			body: ''
		});
		files.set('Task.md', {
			frontmatter: createFrontmatter({ tags: ['task'] }),
			body: ''
		});

		const tasks = createViewTasks(files, TODAY);

		expect(tasks).toHaveLength(1);
		expect(tasks[0].title).toBe('Task');
	});

	it('computes dateGroup correctly', () => {
		const files = new Map<string, { frontmatter: TaskFrontmatter; body: string }>();

		// Now - scheduled today
		files.set('Today Task.md', {
			frontmatter: createFrontmatter({ scheduled: TODAY }),
			body: ''
		});

		// Past - scheduled in past
		files.set('Past Task.md', {
			frontmatter: createFrontmatter({ scheduled: '2026-01-20' }),
			body: ''
		});

		// Upcoming - scheduled in future
		files.set('Future Task.md', {
			frontmatter: createFrontmatter({ scheduled: '2026-01-30' }),
			body: ''
		});

		// Wrapped - completed
		files.set('Done Task.md', {
			frontmatter: createFrontmatter({
				status: 'done',
				completedAt: '2026-01-25T15:00:00.000Z'
			}),
			body: ''
		});

		const tasks = createViewTasks(files, TODAY);

		expect(tasks.find((t) => t.title === 'Today Task')?.dateGroup).toBe('Now');
		expect(tasks.find((t) => t.title === 'Past Task')?.dateGroup).toBe('Past');
		expect(tasks.find((t) => t.title === 'Future Task')?.dateGroup).toBe('Upcoming');
		expect(tasks.find((t) => t.title === 'Done Task')?.dateGroup).toBe('Wrapped');
	});

	it('computes urgencyScore correctly', () => {
		const files = new Map<string, { frontmatter: TaskFrontmatter; body: string }>();

		files.set('High Priority.md', {
			frontmatter: createFrontmatter({ priority: 'high', scheduled: TODAY }),
			body: ''
		});

		files.set('Low Priority.md', {
			frontmatter: createFrontmatter({ priority: 'low', scheduled: TODAY }),
			body: ''
		});

		const tasks = createViewTasks(files, TODAY);
		const highTask = tasks.find((t) => t.title === 'High Priority')!;
		const lowTask = tasks.find((t) => t.title === 'Low Priority')!;

		expect(highTask.urgencyScore).toBeGreaterThan(lowTask.urgencyScore);
	});
});

describe('groupTasksByDateGroup', () => {
	it('groups tasks correctly', () => {
		const tasks: ViewTask[] = [
			{ filename: 'a.md', title: 'a', dateGroup: 'Past' } as ViewTask,
			{ filename: 'b.md', title: 'b', dateGroup: 'Now' } as ViewTask,
			{ filename: 'c.md', title: 'c', dateGroup: 'Now' } as ViewTask,
			{ filename: 'd.md', title: 'd', dateGroup: 'Upcoming' } as ViewTask,
			{ filename: 'e.md', title: 'e', dateGroup: 'Wrapped' } as ViewTask
		];

		const grouped = groupTasksByDateGroup(tasks);

		expect(grouped.past).toHaveLength(1);
		expect(grouped.now).toHaveLength(2);
		expect(grouped.upcoming).toHaveLength(1);
		expect(grouped.wrapped).toHaveLength(1);
	});
});

describe('sortByUrgency', () => {
	it('sorts by urgency score descending', () => {
		const tasks: ViewTask[] = [
			{ title: 'low', urgencyScore: 1 } as ViewTask,
			{ title: 'high', urgencyScore: 10 } as ViewTask,
			{ title: 'medium', urgencyScore: 5 } as ViewTask
		];

		const sorted = sortByUrgency(tasks);

		expect(sorted[0].title).toBe('high');
		expect(sorted[1].title).toBe('medium');
		expect(sorted[2].title).toBe('low');
	});
});

describe('sortByScheduledDate', () => {
	it('sorts by scheduled date ascending', () => {
		const tasks: ViewTask[] = [
			{ title: 'later', frontmatter: createFrontmatter({ scheduled: '2026-01-30' }) } as ViewTask,
			{ title: 'earlier', frontmatter: createFrontmatter({ scheduled: '2026-01-20' }) } as ViewTask,
			{ title: 'none', frontmatter: createFrontmatter({ scheduled: null }) } as ViewTask
		];

		const sorted = sortByScheduledDate(tasks);

		expect(sorted[0].title).toBe('earlier');
		expect(sorted[1].title).toBe('later');
		expect(sorted[2].title).toBe('none'); // null dates last
	});
});

describe('getTasksForDate', () => {
	it('returns tasks scheduled for the date', () => {
		const tasks: ViewTask[] = [
			{
				filename: 'a.md',
				title: 'a',
				frontmatter: createFrontmatter({ scheduled: TODAY })
			} as ViewTask,
			{
				filename: 'b.md',
				title: 'b',
				frontmatter: createFrontmatter({ scheduled: '2026-01-26' })
			} as ViewTask
		];

		const result = getTasksForDate(tasks, TODAY);

		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('a');
	});

	it('returns tasks due on the date', () => {
		const tasks: ViewTask[] = [
			{
				filename: 'a.md',
				title: 'a',
				frontmatter: createFrontmatter({ due: TODAY })
			} as ViewTask
		];

		const result = getTasksForDate(tasks, TODAY);

		expect(result).toHaveLength(1);
	});

	it('returns recurring tasks active on the date', () => {
		const tasks: ViewTask[] = [
			{
				filename: 'recurring.md',
				title: 'recurring',
				frontmatter: createFrontmatter({
					recurrence: 'DTSTART:20260101;FREQ=DAILY',
					active_instances: [TODAY]
				})
			} as ViewTask
		];

		const result = getTasksForDate(tasks, TODAY);

		expect(result).toHaveLength(1);
	});

	it('excludes completed recurring instances', () => {
		const tasks: ViewTask[] = [
			{
				filename: 'recurring.md',
				title: 'recurring',
				frontmatter: createFrontmatter({
					recurrence: 'DTSTART:20260101;FREQ=DAILY',
					active_instances: [TODAY],
					complete_instances: [TODAY]
				})
			} as ViewTask
		];

		const result = getTasksForDate(tasks, TODAY);

		expect(result).toHaveLength(0);
	});
});

describe('getCompletedTasksForDate', () => {
	it('returns non-recurring tasks completed on the date', () => {
		const tasks: ViewTask[] = [
			{
				filename: 'done.md',
				title: 'done',
				frontmatter: createFrontmatter({
					status: 'done',
					completedAt: `${TODAY}T15:00:00.000Z`
				})
			} as ViewTask,
			{
				filename: 'other.md',
				title: 'other',
				frontmatter: createFrontmatter({
					status: 'done',
					completedAt: '2026-01-24T15:00:00.000Z'
				})
			} as ViewTask
		];

		const result = getCompletedTasksForDate(tasks, TODAY);

		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('done');
	});

	it('returns recurring tasks with completed instance on the date', () => {
		const tasks: ViewTask[] = [
			{
				filename: 'recurring.md',
				title: 'recurring',
				frontmatter: createFrontmatter({
					recurrence: 'DTSTART:20260101;FREQ=DAILY',
					complete_instances: [TODAY]
				})
			} as ViewTask
		];

		const result = getCompletedTasksForDate(tasks, TODAY);

		expect(result).toHaveLength(1);
	});
});

describe('getOverdueTasks', () => {
	it('returns tasks scheduled before today', () => {
		const tasks: ViewTask[] = [
			{
				filename: 'overdue.md',
				title: 'overdue',
				frontmatter: createFrontmatter({ scheduled: '2026-01-20' }),
				hasPastUncompleted: false
			} as ViewTask,
			{
				filename: 'current.md',
				title: 'current',
				frontmatter: createFrontmatter({ scheduled: TODAY }),
				hasPastUncompleted: false
			} as ViewTask
		];

		const result = getOverdueTasks(tasks, TODAY);

		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('overdue');
	});

	it('excludes completed tasks', () => {
		const tasks: ViewTask[] = [
			{
				filename: 'done.md',
				title: 'done',
				frontmatter: createFrontmatter({
					status: 'done',
					scheduled: '2026-01-20'
				}),
				hasPastUncompleted: false
			} as ViewTask
		];

		const result = getOverdueTasks(tasks, TODAY);

		expect(result).toHaveLength(0);
	});

	it('includes tasks with past uncompleted recurring instances', () => {
		const tasks: ViewTask[] = [
			{
				filename: 'recurring.md',
				title: 'recurring',
				frontmatter: createFrontmatter({
					recurrence: 'DTSTART:20260101;FREQ=DAILY'
				}),
				hasPastUncompleted: true
			} as ViewTask
		];

		const result = getOverdueTasks(tasks, TODAY);

		expect(result).toHaveLength(1);
	});
});

describe('tag/context/project functions', () => {
	const tasks: ViewTask[] = [
		{
			filename: 'a.md',
			title: 'a',
			frontmatter: createFrontmatter({
				tags: ['task', 'Work', 'urgent'],
				contexts: ['Office', 'computer'],
				projects: ['Project A', 'Project B']
			})
		} as ViewTask,
		{
			filename: 'b.md',
			title: 'b',
			frontmatter: createFrontmatter({
				tags: ['task', 'personal'],
				contexts: ['home'],
				projects: ['Project A']
			})
		} as ViewTask
	];

	it('getAllTags returns unique lowercase tags without task', () => {
		const tags = getAllTags(tasks);
		expect(tags).toEqual(['personal', 'urgent', 'work']);
	});

	it('getAllContexts returns unique lowercase contexts', () => {
		const contexts = getAllContexts(tasks);
		expect(contexts).toEqual(['computer', 'home', 'office']);
	});

	it('getAllProjects returns unique projects', () => {
		const projects = getAllProjects(tasks);
		expect(projects).toEqual(['Project A', 'Project B']);
	});

	it('filterByTag filters case-insensitively', () => {
		const result = filterByTag(tasks, 'WORK');
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('a');
	});

	it('filterByContext filters case-insensitively', () => {
		const result = filterByContext(tasks, 'HOME');
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('b');
	});

	it('filterByProject filters exactly', () => {
		const result = filterByProject(tasks, 'Project A');
		expect(result).toHaveLength(2);
	});
});

describe('filterIncomplete/filterCompleted', () => {
	const tasks: ViewTask[] = [
		{
			filename: 'open.md',
			title: 'open',
			frontmatter: createFrontmatter({ status: 'open' })
		} as ViewTask,
		{
			filename: 'done.md',
			title: 'done',
			frontmatter: createFrontmatter({ status: 'done' })
		} as ViewTask
	];

	it('filterIncomplete returns only open tasks', () => {
		const result = filterIncomplete(tasks);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('open');
	});

	it('filterCompleted returns only done tasks', () => {
		const result = filterCompleted(tasks);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('done');
	});
});

// =============================================================================
// Time Block (Weekly Planner) Tests
// =============================================================================

function makeViewTask(overrides: Omit<Partial<ViewTask>, 'frontmatter'> & { frontmatter?: Partial<TaskFrontmatter> }): ViewTask {
	const { frontmatter: fmOverrides, ...rest } = overrides;
	return {
		filename: 'Test.md',
		title: 'Test',
		body: '',
		dateGroup: 'Now',
		urgencyScore: 0,
		isActiveToday: false,
		hasPastUncompleted: false,
		totalTimeTracked: 0,
		timeTrackedToday: 0,
		instanceDate: null,
		effectiveDate: null,
		...rest,
		frontmatter: { ...createFrontmatter(), ...fmOverrides }
	};
}

describe('parseTimeToMinutes', () => {
	it('parses 09:00 to 540', () => {
		expect(parseTimeToMinutes('09:00')).toBe(540);
	});

	it('parses 00:00 to 0', () => {
		expect(parseTimeToMinutes('00:00')).toBe(0);
	});

	it('parses 23:59 to 1439', () => {
		expect(parseTimeToMinutes('23:59')).toBe(1439);
	});

	it('parses 14:30 to 870', () => {
		expect(parseTimeToMinutes('14:30')).toBe(870);
	});
});

describe('minutesToTime', () => {
	it('converts 540 to 09:00', () => {
		expect(minutesToTime(540)).toBe('09:00');
	});

	it('converts 0 to 00:00', () => {
		expect(minutesToTime(0)).toBe('00:00');
	});

	it('converts 1439 to 23:59', () => {
		expect(minutesToTime(1439)).toBe('23:59');
	});

	it('clamps negative to 00:00', () => {
		expect(minutesToTime(-10)).toBe('00:00');
	});

	it('clamps above 1439 to 23:59', () => {
		expect(minutesToTime(2000)).toBe('23:59');
	});
});

describe('snapToGrid', () => {
	it('snaps to 15-min increments', () => {
		expect(snapToGrid(7, 15)).toBe(0);
		expect(snapToGrid(8, 15)).toBe(15);
		expect(snapToGrid(22, 15)).toBe(15);
		expect(snapToGrid(23, 15)).toBe(30);
	});

	it('snaps to 30-min increments', () => {
		expect(snapToGrid(14, 30)).toBe(0);
		expect(snapToGrid(15, 30)).toBe(30);
		expect(snapToGrid(45, 30)).toBe(60);
	});
});

describe('getTimeBlocksForDate', () => {
	it('returns blocks for tasks with startTime and plannedDuration', () => {
		const tasks = [
			makeViewTask({
				filename: 'A.md',
				frontmatter: { scheduled: '2026-01-29', startTime: '09:00', plannedDuration: 60 }
			}),
			makeViewTask({
				filename: 'B.md',
				frontmatter: { scheduled: '2026-01-29', startTime: '14:00', plannedDuration: 30 }
			})
		];

		const blocks = getTimeBlocksForDate(tasks, '2026-01-29');
		expect(blocks).toHaveLength(2);
		expect(blocks[0].startMinutes).toBe(540);
		expect(blocks[0].durationMinutes).toBe(60);
		expect(blocks[1].startMinutes).toBe(840);
		expect(blocks[1].durationMinutes).toBe(30);
	});

	it('excludes tasks without startTime or plannedDuration', () => {
		const tasks = [
			makeViewTask({
				filename: 'A.md',
				frontmatter: { scheduled: '2026-01-29', startTime: null, plannedDuration: 60 }
			}),
			makeViewTask({
				filename: 'B.md',
				frontmatter: { scheduled: '2026-01-29', startTime: '09:00', plannedDuration: null }
			})
		];

		expect(getTimeBlocksForDate(tasks, '2026-01-29')).toHaveLength(0);
	});

	it('excludes tasks on a different date', () => {
		const tasks = [
			makeViewTask({
				filename: 'A.md',
				frontmatter: { scheduled: '2026-01-30', startTime: '09:00', plannedDuration: 60 }
			})
		];

		expect(getTimeBlocksForDate(tasks, '2026-01-29')).toHaveLength(0);
	});

	it('matches recurring instance dates', () => {
		const tasks = [
			makeViewTask({
				filename: 'A.md',
				instanceDate: '2026-01-29',
				frontmatter: { scheduled: '2026-01-27', startTime: '10:00', plannedDuration: 45 }
			})
		];

		const blocks = getTimeBlocksForDate(tasks, '2026-01-29');
		expect(blocks).toHaveLength(1);
		expect(blocks[0].startMinutes).toBe(600);
	});
});

describe('detectCollisions', () => {
	it('detects overlapping blocks', () => {
		const blocks: TimeBlock[] = [
			{
				task: makeViewTask({ filename: 'A.md', frontmatter: {} }),
				date: '2026-01-29',
				startMinutes: 540,
				durationMinutes: 60
			},
			{
				task: makeViewTask({ filename: 'B.md', frontmatter: {} }),
				date: '2026-01-29',
				startMinutes: 570,
				durationMinutes: 60
			}
		];

		const collisions = detectCollisions(blocks);
		expect(collisions.has('A.md')).toBe(true);
		expect(collisions.has('B.md')).toBe(true);
	});

	it('does not flag adjacent (non-overlapping) blocks', () => {
		const blocks: TimeBlock[] = [
			{
				task: makeViewTask({ filename: 'A.md', frontmatter: {} }),
				date: '2026-01-29',
				startMinutes: 540,
				durationMinutes: 60
			},
			{
				task: makeViewTask({ filename: 'B.md', frontmatter: {} }),
				date: '2026-01-29',
				startMinutes: 600,
				durationMinutes: 60
			}
		];

		expect(detectCollisions(blocks).size).toBe(0);
	});

	it('returns empty set for no blocks', () => {
		expect(detectCollisions([]).size).toBe(0);
	});
});

describe('getUnplannedTasksForDates', () => {
	it('returns tasks scheduled for dates without time blocks', () => {
		const tasks = [
			makeViewTask({
				filename: 'A.md',
				frontmatter: { scheduled: '2026-01-29', startTime: null, plannedDuration: null }
			}),
			makeViewTask({
				filename: 'B.md',
				frontmatter: { scheduled: '2026-01-29', startTime: '09:00', plannedDuration: 60 }
			})
		];

		const unplanned = getUnplannedTasksForDates(tasks, ['2026-01-29']);
		expect(unplanned).toHaveLength(1);
		expect(unplanned[0].filename).toBe('A.md');
	});
});

describe('getBacklogTasks', () => {
	it('returns open tasks without scheduled date or recurrence', () => {
		const tasks = [
			makeViewTask({ filename: 'A.md', frontmatter: { scheduled: null, recurrence: null } }),
			makeViewTask({ filename: 'B.md', frontmatter: { scheduled: '2026-01-29' } }),
			makeViewTask({ filename: 'C.md', frontmatter: { status: 'done', scheduled: null } })
		];

		const backlog = getBacklogTasks(tasks);
		expect(backlog).toHaveLength(1);
		expect(backlog[0].filename).toBe('A.md');
	});
});
