/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { z } from "zod";

export interface DispatchDetail {
  dispatchPlanId: number;
  dispatchDocNo: string;
  role: string;
  amount: number;
  location: string;
  vehiclePlate?: string;
  vehicleType?: string;
  timeOfDispatch: string | null;
  isApproved: boolean;
  approvedAmount?: number;
}

export interface StaffPayrollSummary {
  staffId: number;
  staffName: string;
  totalAmount: number;
  dispatches: DispatchDetail[];
}

export interface LogisticsPayrollDataResponse {
  data: StaffPayrollSummary[];
  meta?: any;
}

export interface ApprovePayrollPayload {
  user_id: number;
  amount: number;
  cutoff_start: string;
  cutoff_end: string;
  description?: string;
  dispatchDocNo: string;
}

