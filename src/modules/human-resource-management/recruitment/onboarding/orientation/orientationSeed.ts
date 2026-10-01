// orientationSeed.ts — SEED DATA for orientation topics (the ONLY place
// topic titles appear in code).
//
// Source: onboarding.pdf §7 FIRST-DAY ONBOARDING (Responsible: HR /
// Department). Company Orientation (8 topics, HR-owned) + Department
// Orientation (6 topics, department-owned: intro + team + responsibilities
// + KRA/KPI + reporting + procedures). No invented topics.
//
// Admin-editable: the topics routes (GET/POST/PATCH under
// `/api/hrm/onboarding/orientation/topics`) overlay this seed at runtime —
// every consumer reads through `orientationStore.listTopics()`, never this
// array directly and never inline literals.

import type { OrientationTopic } from "./types/orientation.schema";

export const DEFAULT_ORIENTATION_TOPICS: readonly OrientationTopic[] = [
  { id: "company-background", track: "company", title: "Company background", required: true, sort: 1 },
  { id: "company-vision-mission-values", track: "company", title: "Vision, Mission & Values", required: true, sort: 2 },
  { id: "company-org-structure", track: "company", title: "Organizational structure", required: true, sort: 3 },
  { id: "company-policies", track: "company", title: "Company policies", required: true, sort: 4 },
  { id: "company-code-of-conduct", track: "company", title: "Code of Conduct", required: true, sort: 5 },
  { id: "company-attendance-rules", track: "company", title: "Attendance rules", required: true, sort: 6 },
  { id: "company-benefits", track: "company", title: "Benefits", required: true, sort: 7 },
  { id: "company-workplace-rules", track: "company", title: "Workplace rules", required: true, sort: 8 },
  { id: "dept-introduction", track: "department", title: "Department introduction", required: true, sort: 1 },
  { id: "dept-team-intro", track: "department", title: "Team introduction", required: true, sort: 2 },
  { id: "dept-job-responsibilities", track: "department", title: "Job responsibilities", required: true, sort: 3 },
  { id: "dept-kra-kpi", track: "department", title: "KRA/KPI", required: true, sort: 4 },
  { id: "dept-reporting-structure", track: "department", title: "Reporting structure", required: true, sort: 5 },
  { id: "dept-work-procedures", track: "department", title: "Work procedures", required: true, sort: 6 },
];
