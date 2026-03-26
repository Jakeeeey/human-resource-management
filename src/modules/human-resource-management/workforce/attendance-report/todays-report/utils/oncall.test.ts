/// <reference types="jest" />
// utils/oncall.test.ts
import { getActiveOncall, extractScheduleFields } from './oncall';

const mockOncallList = [
  { id: 15, dept_sched_id: 15, user_id: 24 },
  { id: 17, dept_sched_id: 18, user_id: 24 },
];

const mockOncallScheds = [
  { id: 15, department_id: 14, work_start: '06:00:00', work_end: '20:25:00', schedule_date: '2025-09-25', group: '1224' },
  { id: 18, department_id: 14, work_start: '08:00:00', work_end: '22:00:00', schedule_date: '2025-09-25', group: '1225' },
];

test('returns oncall schedule for user 24', () => {
  const result = getActiveOncall(24, '2025-09-25', mockOncallList, mockOncallScheds);
  expect(result).not.toBeNull();
  expect(result?.work_start).toBe('06:00:00');
});

test('returns null for user with no oncall entry', () => {
  const result = getActiveOncall(99, '2025-09-25', mockOncallList, mockOncallScheds);
  expect(result).toBeNull();
});

test('extractScheduleFields prefers oncall over dept', () => {
  const oncall = { work_start: '06:00:00', work_end: '20:25:00', grace_period: 5 };
  const dept   = { work_start: '08:00:00', work_end: '17:00:00', grace_period: 10 };
  const fields = extractScheduleFields(oncall, dept);
  expect(fields.is_oncall).toBe(true);
  expect(fields.work_start).toBe('06:00:00');
});