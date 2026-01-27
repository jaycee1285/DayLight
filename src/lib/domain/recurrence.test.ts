import { describe, it, expect } from 'vitest';
import {
	createDailyRecurrence,
	createWeeklyRecurrence,
	createMonthlyRecurrence,
	createMonthlyNthWeekdayRecurrence,
	createYearlyRecurrence,
	generateOccurrences,
	describeRecurrence,
	type Recurrence
} from './recurrence';

describe('recurrence creation helpers', () => {
	describe('createDailyRecurrence', () => {
		it('creates daily recurrence with interval 1', () => {
			const rec = createDailyRecurrence('2025-01-01');
			expect(rec.frequency).toBe('daily');
			expect(rec.interval).toBe(1);
			expect(rec.startDate).toBe('2025-01-01');
		});

		it('creates daily recurrence with custom interval', () => {
			const rec = createDailyRecurrence('2025-01-01', 3);
			expect(rec.interval).toBe(3);
		});
	});

	describe('createWeeklyRecurrence', () => {
		it('creates weekly recurrence defaulting to start date weekday', () => {
			// 2025-01-01 is a Wednesday
			const rec = createWeeklyRecurrence('2025-01-01');
			expect(rec.frequency).toBe('weekly');
			expect(rec.interval).toBe(1);
			expect(rec.weekDays).toEqual(['wed']);
		});

		it('creates weekly recurrence with specific days', () => {
			const rec = createWeeklyRecurrence('2025-01-01', ['mon', 'fri']);
			expect(rec.weekDays).toEqual(['mon', 'fri']);
		});

		it('creates weekly recurrence with custom interval', () => {
			const rec = createWeeklyRecurrence('2025-01-01', ['mon'], 2);
			expect(rec.interval).toBe(2);
		});
	});

	describe('createMonthlyRecurrence', () => {
		it('creates monthly recurrence defaulting to start date day', () => {
			const rec = createMonthlyRecurrence('2025-01-15');
			expect(rec.frequency).toBe('monthly');
			expect(rec.interval).toBe(1);
			expect(rec.dayOfMonth).toBe(15);
		});

		it('creates monthly recurrence with specific day', () => {
			const rec = createMonthlyRecurrence('2025-01-15', 1);
			expect(rec.dayOfMonth).toBe(1);
		});
	});

	describe('createMonthlyNthWeekdayRecurrence', () => {
		it('creates 2nd Tuesday monthly recurrence', () => {
			const rec = createMonthlyNthWeekdayRecurrence('2025-01-01', 2, 'tue');
			expect(rec.frequency).toBe('monthly');
			expect(rec.nthWeekday).toBe(2);
			expect(rec.weekdayForNth).toBe('tue');
		});

		it('creates last Friday monthly recurrence', () => {
			const rec = createMonthlyNthWeekdayRecurrence('2025-01-01', -1, 'fri');
			expect(rec.nthWeekday).toBe(-1);
			expect(rec.weekdayForNth).toBe('fri');
		});
	});

	describe('createYearlyRecurrence', () => {
		it('creates yearly recurrence', () => {
			const rec = createYearlyRecurrence('2025-03-15');
			expect(rec.frequency).toBe('yearly');
			expect(rec.interval).toBe(1);
			expect(rec.startDate).toBe('2025-03-15');
		});
	});
});

describe('generateOccurrences', () => {
	describe('daily recurrence', () => {
		it('generates daily occurrences within window', () => {
			const rec = createDailyRecurrence('2025-01-01');
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-01-05');
			expect(occurrences).toEqual([
				'2025-01-01',
				'2025-01-02',
				'2025-01-03',
				'2025-01-04',
				'2025-01-05'
			]);
		});

		it('generates every-3-days occurrences', () => {
			const rec = createDailyRecurrence('2025-01-01', 3);
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-01-10');
			expect(occurrences).toEqual(['2025-01-01', '2025-01-04', '2025-01-07', '2025-01-10']);
		});

		it('respects window start after recurrence start', () => {
			const rec = createDailyRecurrence('2025-01-01');
			const occurrences = generateOccurrences(rec, '2025-01-03', '2025-01-05');
			expect(occurrences).toEqual(['2025-01-03', '2025-01-04', '2025-01-05']);
		});

		it('respects recurrence start after window start', () => {
			const rec = createDailyRecurrence('2025-01-03');
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-01-05');
			expect(occurrences).toEqual(['2025-01-03', '2025-01-04', '2025-01-05']);
		});

		it('respects end date', () => {
			const rec: Recurrence = {
				...createDailyRecurrence('2025-01-01'),
				endDate: '2025-01-03'
			};
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-01-10');
			expect(occurrences).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
		});
	});

	describe('weekly recurrence', () => {
		it('generates weekly occurrences on single day', () => {
			// Every Wednesday starting 2025-01-01
			const rec = createWeeklyRecurrence('2025-01-01', ['wed']);
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-01-31');
			expect(occurrences).toEqual(['2025-01-01', '2025-01-08', '2025-01-15', '2025-01-22', '2025-01-29']);
		});

		it('generates weekly occurrences on multiple days', () => {
			// Mon and Fri starting 2025-01-01 (Wed)
			const rec = createWeeklyRecurrence('2025-01-01', ['mon', 'fri']);
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-01-14');
			// 2025-01-01 is Wed, first Mon is 2025-01-06, first Fri is 2025-01-03
			expect(occurrences).toEqual(['2025-01-03', '2025-01-06', '2025-01-10', '2025-01-13']);
		});

		it('generates bi-weekly occurrences', () => {
			const rec = createWeeklyRecurrence('2025-01-01', ['wed'], 2);
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-01-31');
			expect(occurrences).toEqual(['2025-01-01', '2025-01-15', '2025-01-29']);
		});
	});

	describe('monthly recurrence (day of month)', () => {
		it('generates monthly occurrences on specific day', () => {
			const rec = createMonthlyRecurrence('2025-01-15', 15);
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-04-30');
			expect(occurrences).toEqual(['2025-01-15', '2025-02-15', '2025-03-15', '2025-04-15']);
		});

		it('generates monthly occurrences on 1st of month', () => {
			const rec = createMonthlyRecurrence('2025-01-01', 1);
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-03-31');
			expect(occurrences).toEqual(['2025-01-01', '2025-02-01', '2025-03-01']);
		});

		it('handles end of month correctly', () => {
			const rec = createMonthlyRecurrence('2025-01-31', 31);
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-05-31');
			// Feb has no 31st, March has 31, April has no 31, May has 31
			expect(occurrences).toEqual(['2025-01-31', '2025-03-31', '2025-05-31']);
		});
	});

	describe('monthly recurrence (nth weekday)', () => {
		it('generates 2nd Tuesday of each month', () => {
			const rec = createMonthlyNthWeekdayRecurrence('2025-01-01', 2, 'tue');
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-03-31');
			// 2nd Tue: Jan 14, Feb 11, Mar 11
			expect(occurrences).toEqual(['2025-01-14', '2025-02-11', '2025-03-11']);
		});

		it('generates 1st Monday of each month', () => {
			const rec = createMonthlyNthWeekdayRecurrence('2025-01-01', 1, 'mon');
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-03-31');
			// 1st Mon: Jan 6, Feb 3, Mar 3
			expect(occurrences).toEqual(['2025-01-06', '2025-02-03', '2025-03-03']);
		});

		it('generates last Friday of each month', () => {
			const rec = createMonthlyNthWeekdayRecurrence('2025-01-01', -1, 'fri');
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-03-31');
			// Last Fri: Jan 31, Feb 28, Mar 28
			expect(occurrences).toEqual(['2025-01-31', '2025-02-28', '2025-03-28']);
		});

		it('generates 4th Thursday (US Thanksgiving pattern)', () => {
			const rec = createMonthlyNthWeekdayRecurrence('2025-11-01', 4, 'thu');
			const occurrences = generateOccurrences(rec, '2025-11-01', '2025-11-30');
			// 4th Thursday of November 2025 is the 27th
			expect(occurrences).toEqual(['2025-11-27']);
		});
	});

	describe('yearly recurrence', () => {
		it('generates yearly occurrences', () => {
			const rec = createYearlyRecurrence('2025-03-15');
			const occurrences = generateOccurrences(rec, '2025-01-01', '2028-12-31');
			expect(occurrences).toEqual(['2025-03-15', '2026-03-15', '2027-03-15', '2028-03-15']);
		});

		it('generates leap year birthday correctly', () => {
			const rec = createYearlyRecurrence('2024-02-29');
			const occurrences = generateOccurrences(rec, '2024-01-01', '2032-12-31');
			// Feb 29 only exists in leap years: 2024, 2028, 2032
			expect(occurrences).toEqual(['2024-02-29', '2028-02-29', '2032-02-29']);
		});
	});

	describe('edge cases', () => {
		it('returns empty array when window ends before recurrence starts', () => {
			const rec = createDailyRecurrence('2025-06-01');
			const occurrences = generateOccurrences(rec, '2025-01-01', '2025-01-31');
			expect(occurrences).toEqual([]);
		});

		it('returns empty array when end date is before window', () => {
			const rec: Recurrence = {
				...createDailyRecurrence('2025-01-01'),
				endDate: '2025-01-10'
			};
			const occurrences = generateOccurrences(rec, '2025-02-01', '2025-02-28');
			expect(occurrences).toEqual([]);
		});

		it('handles single-day window', () => {
			const rec = createDailyRecurrence('2025-01-01');
			const occurrences = generateOccurrences(rec, '2025-01-05', '2025-01-05');
			expect(occurrences).toEqual(['2025-01-05']);
		});
	});
});

describe('describeRecurrence', () => {
	it('describes daily recurrence', () => {
		expect(describeRecurrence(createDailyRecurrence('2025-01-01'))).toBe('Every day');
		expect(describeRecurrence(createDailyRecurrence('2025-01-01', 3))).toBe('Every 3 days');
	});

	it('describes weekly recurrence', () => {
		expect(describeRecurrence(createWeeklyRecurrence('2025-01-01', ['mon']))).toBe(
			'Weekly on Mon'
		);
		// Multiple days use abbreviated format
		expect(describeRecurrence(createWeeklyRecurrence('2025-01-01', ['mon', 'wed', 'fri']))).toBe(
			'Mo, We, Fr'
		);
		expect(describeRecurrence(createWeeklyRecurrence('2025-01-01', ['mon'], 2))).toBe(
			'Every 2 weeks'
		);
	});

	it('describes monthly recurrence (day of month)', () => {
		expect(describeRecurrence(createMonthlyRecurrence('2025-01-15', 15))).toBe(
			'Monthly on 15th'
		);
		expect(describeRecurrence(createMonthlyRecurrence('2025-01-01', 1))).toBe(
			'Monthly on 1st'
		);
		expect(describeRecurrence(createMonthlyRecurrence('2025-01-02', 2))).toBe(
			'Monthly on 2nd'
		);
		expect(describeRecurrence(createMonthlyRecurrence('2025-01-03', 3))).toBe(
			'Monthly on 3rd'
		);
	});

	it('describes monthly recurrence (nth weekday)', () => {
		expect(describeRecurrence(createMonthlyNthWeekdayRecurrence('2025-01-01', 2, 'tue'))).toBe(
			'Monthly on 2nd Tue'
		);
		expect(describeRecurrence(createMonthlyNthWeekdayRecurrence('2025-01-01', -1, 'fri'))).toBe(
			'Monthly on last Fri'
		);
	});

	it('describes yearly recurrence', () => {
		expect(describeRecurrence(createYearlyRecurrence('2025-03-15'))).toBe('Yearly');
	});
});
