import { NextRequest, NextResponse } from "next/server";
import { toISODate } from "@/lib/utils";

const ENV_SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL?.trim() || "";
const LOGISTICS_REPORT_API_BASE_URL =
	process.env.LOGISTICS_REPORT_API_BASE_URL?.trim() || "";
const LOGISTICS_REPORT_STATIC_TOKEN =
	process.env.LOGISTICS_REPORT_STATIC_TOKEN?.trim() || "";
const LOGISTICS_REPORT_PATH =
	process.env.LOGISTICS_REPORT_PATH?.trim() || "/api/view-post-dispatch-plan-staff-attendance/all";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface LogisticsAttendanceRow {
	dispatchPlanId?: number;
	dispatchDocNo?: string;
	dispatchStatus?: string;
	driverId?: number;
	vehicleId?: number;
	timeOfDispatch?: string;
	timeOfArrival?: string;
	staffUserId?: number;
	staffName?: string;
	staffRole?: string;
	isPresentRaw?: boolean;
	staffAttendanceStatus?: string;
	deliveryStatus?: string;
	invoiceId?: number;
	invoiceNo?: string;
	totalAmount?: number;
	salesOrderNo?: string;
	customerCode?: string;
	customerName?: string;
	storeName?: string;
	brgy?: string;
	city?: string;
	province?: string;
}

interface DispatchStaffAttendance {
	staffUserId: number | null;
	staffName: string;
	staffRole: string;
	status: string;
	isPresent: boolean | null;
}

interface DispatchAttendanceGroup {
	dispatchPlanId: number | null;
	dispatchDocNo: string;
	dispatchStatus: string;
	deliveryStatus: string;
	timeOfDispatch: string;
	timeOfArrival: string;
	driverId: number | null;
	vehicleId: number | null;
	invoiceId: number | null;
	invoiceNo: string;
	totalAmount: number | null;
	salesOrderNo: string;
	customerCode: string;
	customerName: string;
	storeName: string;
	brgy: string;
	city: string;
	province: string;
	staff: DispatchStaffAttendance[];
}

function getDefaultDateRange() {
	const now = new Date();
	const year = now.getFullYear();

	return {
		startDate: `${year}-01-01`,
		endDate: `${year}-12-31`,
	};
}

function isDateString(value: string | null): value is string {
	if (!value) return false;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

	return toISODate(new Date(`${value}T00:00:00`)) === value;
}

function getString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function normalizeAttendanceStatus(
	row: LogisticsAttendanceRow
): { status: string; isPresent: boolean | null } {
	const explicitStatus = getString(row.staffAttendanceStatus);
	const isPresent = getBoolean(row.isPresentRaw);

	if (explicitStatus) {
		const lowered = explicitStatus.toLowerCase();
		if (lowered === "present") {
			return { status: "Present", isPresent: true };
		}

		if (lowered === "absent") {
			return { status: "Absent", isPresent: false };
		}

		return { status: explicitStatus, isPresent };
	}

	if (isPresent === true) {
		return { status: "Present", isPresent: true };
	}

	if (isPresent === false) {
		return { status: "Absent", isPresent: false };
	}

	return { status: "Unknown", isPresent: null };
}

function extractRows(payload: unknown): LogisticsAttendanceRow[] {
	if (Array.isArray(payload)) {
		return payload as LogisticsAttendanceRow[];
	}

	if (!payload || typeof payload !== "object") {
		return [];
	}

	const objectPayload = payload as Record<string, unknown>;
	const candidateKeys = ["data", "items", "results", "rows"];

	for (const key of candidateKeys) {
		const candidate = objectPayload[key];
		if (Array.isArray(candidate)) {
			return candidate as LogisticsAttendanceRow[];
		}
	}

	return [];
}

function buildDispatchGroups(
	rows: LogisticsAttendanceRow[]
): DispatchAttendanceGroup[] {
	const groups = new Map<string, DispatchAttendanceGroup>();

	for (const row of rows) {
		const dispatchPlanId = getNumber(row.dispatchPlanId);
		const dispatchDocNo = getString(row.dispatchDocNo);
		const timeOfDispatch = getString(row.timeOfDispatch);
		const groupKey = String(
			dispatchPlanId ?? `${dispatchDocNo || "unknown"}-${timeOfDispatch || "na"}`
		);

		const current = groups.get(groupKey);

		if (!current) {
			groups.set(groupKey, {
				dispatchPlanId,
				dispatchDocNo,
				dispatchStatus: getString(row.dispatchStatus),
				deliveryStatus: getString(row.deliveryStatus),
				timeOfDispatch,
				timeOfArrival: getString(row.timeOfArrival),
				driverId: getNumber(row.driverId),
				vehicleId: getNumber(row.vehicleId),
				invoiceId: getNumber(row.invoiceId),
				invoiceNo: getString(row.invoiceNo),
				totalAmount: getNumber(row.totalAmount),
				salesOrderNo: getString(row.salesOrderNo),
				customerCode: getString(row.customerCode),
				customerName: getString(row.customerName),
				storeName: getString(row.storeName),
				brgy: getString(row.brgy),
				city: getString(row.city),
				province: getString(row.province),
				staff: [],
			});
		}

		const target = groups.get(groupKey);

		if (!target) {
			continue;
		}

		const attendance = normalizeAttendanceStatus(row);
		target.staff.push({
			staffUserId: getNumber(row.staffUserId),
			staffName: getString(row.staffName) || "Unknown staff",
			staffRole: getString(row.staffRole) || "Unassigned",
			status: attendance.status,
			isPresent: attendance.isPresent,
		});
	}

	return Array.from(groups.values()).sort((left, right) => {
		return right.timeOfDispatch.localeCompare(left.timeOfDispatch);
	});
}

export async function GET(request: NextRequest) {
	const defaults = getDefaultDateRange();
	const searchParams = request.nextUrl.searchParams;
	const vosToken = request.cookies.get("vos_access_token")?.value;
	const authHeader = request.headers.get("authorization") || "";
	const rawStartDate = searchParams.get("startDate");
	const startDate = isDateString(rawStartDate)
		? rawStartDate
		: defaults.startDate;
	
	const rawEndDate = searchParams.get("endDate");
	const endDate = isDateString(rawEndDate)
		? rawEndDate
		: defaults.endDate;
	const debug = searchParams.get("debug") === "1";

	const springApiBaseUrl =
		LOGISTICS_REPORT_API_BASE_URL || ENV_SPRING_API_BASE_URL;

	if (!springApiBaseUrl) {
		return NextResponse.json(
			{
				error: "Upstream configuration missing",
				details:
					"Set LOGISTICS_REPORT_API_BASE_URL or SPRING_API_BASE_URL environment variable",
			},
			{ status: 500 }
		);
	}
	const authorizationCandidates = [
		vosToken ? `Bearer ${vosToken}` : "",
		authHeader.startsWith("Bearer ") ? authHeader : "",
		LOGISTICS_REPORT_STATIC_TOKEN
			? `Bearer ${LOGISTICS_REPORT_STATIC_TOKEN}`
			: "",
	].filter((value, index, array) => value && array.indexOf(value) === index);
	const authorization = authorizationCandidates[0] || "";

	if (!authorization) {
		return NextResponse.json(
			{
				error: "Unauthorized",
				details:
					"Missing vos_access_token cookie, Authorization header, or LOGISTICS_REPORT_STATIC_TOKEN",
				...(debug
					? {
						debug: {
							hasVosToken: Boolean(vosToken),
							hasAuthorizationHeader: authHeader.startsWith("Bearer "),
							hasStaticToken: Boolean(LOGISTICS_REPORT_STATIC_TOKEN),
							authorizationCandidates,
						},
					}
					: {}),
			},
			{ status: 401 }
		);
	}

	try {
		const upstreamUrl = new URL(
			`${springApiBaseUrl.replace(/\/+$/, "")}${LOGISTICS_REPORT_PATH}`
		);
		upstreamUrl.searchParams.set("startDate", startDate);
		upstreamUrl.searchParams.set("endDate", endDate);

		let response: Response | null = null;

		for (const candidateAuthorization of authorizationCandidates) {
			response = await fetch(upstreamUrl.toString(), {
				method: "GET",
				cache: "no-store",
				headers: {
					Accept: "application/json",
					Authorization: candidateAuthorization,
				},
			});

			if (response.status !== 401) {
				break;
			}
		}

		if (!response) {
			return NextResponse.json(
				{
					error: "Failed to fetch logistics report from upstream service",
					details: "No upstream response received",
				},
				{ status: 502 }
			);
		}

		if (!response.ok) {
			const message = await response.text();
			return NextResponse.json(
				{
					error: "Failed to fetch logistics report from upstream service",
					details:
						message ||
						`Upstream returned HTTP ${response.status}${response.status === 401 ? " Unauthorized. The forwarded login token was rejected or missing permission for this endpoint." : ""}`,
					...(debug
						? {
							debug: {
								hasVosToken: Boolean(vosToken),
								hasAuthorizationHeader: authHeader.startsWith("Bearer "),
								hasStaticToken: Boolean(LOGISTICS_REPORT_STATIC_TOKEN),
								authorizationCandidates,
								upstreamUrl: upstreamUrl.toString(),
								upstreamStatus: response.status,
							},
						}
						: {}),
				},
				{ status: response.status }
			);
		}

		const payload = await response.json();
		const rows = extractRows(payload);
		const data = buildDispatchGroups(rows);

		let presentCount = 0;
		let absentCount = 0;

		for (const dispatch of data) {
			for (const staff of dispatch.staff) {
				if (staff.isPresent === true) {
					presentCount += 1;
				}

				if (staff.isPresent === false) {
					absentCount += 1;
				}
			}
		}

		return NextResponse.json({
			data,
			meta: {
				startDate,
				endDate,
				totalDispatches: data.length,
				totalStaff: rows.length,
				presentCount,
				absentCount,
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";

		return NextResponse.json(
			{
				error: "Failed to load logistics attendance report",
				details: message,
			},
			{ status: 500 }
		);
	}
}
