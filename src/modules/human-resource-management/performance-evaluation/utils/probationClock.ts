import { addMonths, format } from "date-fns";

export function addMonthsClamped(date: Date, months: number): Date {
  return addMonths(date, months);
}

export function parseLocalDate(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) return null;
  if (match[1] === undefined || match[2] === undefined || match[3] === undefined) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function computeDueDates(
  dateHired: string | null | undefined
): { third: string; fifth: string; sixth: string } | null {
  const hired = parseLocalDate(dateHired);
  if (hired === null) return null;
  return {
    third: format(addMonthsClamped(hired, 3), "yyyy-MM-dd"),
    fifth: format(addMonthsClamped(hired, 5), "yyyy-MM-dd"),
    sixth: format(addMonthsClamped(hired, 6), "yyyy-MM-dd"),
  };
}

export function isDateOverdue(
  value: string | null | undefined,
  now: Date = new Date()
): boolean {
  const target = parseLocalDate(value);
  if (target === null) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target.getTime() < today.getTime();
}

export function formatHiredDate(value: string | null | undefined): string {
  const date = parseLocalDate(value);
  if (date === null) return "—";
  return format(date, "MMM d, yyyy");
}

export function todayPH(): string {
  const wall = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
  return wall.slice(0, 10);
}
