import { formatCurrency, toISODate } from "@/lib/utils";
import { DispatchAttendance } from "../type";

export function getDefaultDateRange() {
	return {
		startDate: toISODate(new Date(2025, 0, 1)),
		endDate: toISODate(new Date(2025, 11, 30)),
	};
}

export function formatDateTimeValue(value: string) {
	return value || "N/A";
}

export function buildLocationSummary(dispatch: DispatchAttendance) {
	return [dispatch.storeName, dispatch.brgy, dispatch.city, dispatch.province]
		.filter(Boolean)
		.join(", ");
}

export function buildDeliverySummary(dispatch: DispatchAttendance) {
	return [
		dispatch.deliveryStatus,
		dispatch.totalAmount !== null ? formatCurrency(dispatch.totalAmount) : "",
	]
		.filter(Boolean)
		.join(" / ");
}

export function getAttendanceBadgeClass(isPresent: boolean | null) {
	if (isPresent === true) {
		return "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
	}

	if (isPresent === false) {
		return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
	}

	return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300";
}

export function getAttendanceRowClass(isPresent: boolean | null) {
	if (isPresent === true) {
		return "bg-emerald-50/55 text-emerald-900 hover:bg-emerald-100/70 [&>td]:text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200 dark:hover:bg-emerald-950/35 dark:[&>td]:text-emerald-200";
	}

	if (isPresent === false) {
		return "bg-red-50/55 text-red-900 hover:bg-red-100/70 [&>td]:text-red-900 dark:bg-red-950/20 dark:text-red-200 dark:hover:bg-red-950/35 dark:[&>td]:text-red-200";
	}

	return "";
}