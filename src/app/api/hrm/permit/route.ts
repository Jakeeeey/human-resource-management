import { NextRequest, NextResponse } from "next/server";
import {
  fetchCompanyPermitData,
  createCompanyPermit,
} from "@/modules/human-resource-management/permit/services/permit.service";

export async function GET() {
  try {
    const data = await fetchCompanyPermitData();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      permit_type_id,
      permit_number,
      issue_date,
      expiry_date,
      file_url,
      issuing_agency,
      status,
      notes,
      renew_from_id,
    } = body;

    if (!permit_type_id || !permit_number || !issue_date || !expiry_date) {
      return NextResponse.json(
        {
          success: false,
          message: "Please fill out all required fields (Permit Type, Permit Number, Date Issued, Expiration Date).",
        },
        { status: 400 }
      );
    }

    const payload = {
      permit_type_id,
      permit_number: String(permit_number).trim(),
      issue_date: String(issue_date).trim(),
      expiry_date: String(expiry_date).trim(),
      file_url: file_url ? String(file_url).trim() : "",
      issuing_agency: issuing_agency ? String(issuing_agency).trim() : "Government Agency",
      status: status || "Active",
      notes: notes ? String(notes).trim() : undefined,
      renew_from_id,
    };

    const result = await createCompanyPermit(payload);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
