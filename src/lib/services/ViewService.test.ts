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
	type ViewTask
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
		tags: ['task'],
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
