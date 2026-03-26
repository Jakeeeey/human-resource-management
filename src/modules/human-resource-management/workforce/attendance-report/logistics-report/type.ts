export interface StaffAttendance {
	staffUserId: number | null;
	staffName: string;
	staffRole: string;
	status: string;
	isPresent: boolean | null;
}

export interface DispatchAttendance {
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
	staff: StaffAttendance[];
}

export interface LogisticsReportMeta {
	startDate: string;
	endDate: string;
	totalDispatches: number;
	totalStaff: number;
	presentCount: number;
	absentCount: number;
}

export interface LogisticsReportResponse {
	data: DispatchAttendance[];
	meta: LogisticsReportMeta;
	error?: string;
	details?: string;
}

export interface LogisticsReportDateRange {
	startDate: string;
	endDate: string;
}
