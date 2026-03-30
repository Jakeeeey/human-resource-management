import { NextResponse } from "next/server";
import { directusFetch } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      employees,
      companies,
      suppliers,
      divisions,
      operations,
      branches,
      qrPaymentTypes,
    ] = await Promise.all([
      directusFetch(`/items/user?limit=-1`),
      directusFetch(`/items/company?limit=-1`),
      directusFetch(`/items/suppliers?limit=-1`),
      directusFetch(`/items/division?limit=-1`),
      directusFetch(`/items/operation?limit=-1`),
      directusFetch(`/items/branches?limit=-1`),
      directusFetch(
        `/items/qr_payment_type?limit=-1&filter[is_active][_eq]=1&sort=sort_order`,
      ),
    ]);

    return NextResponse.json({
      data: {
        employees: employees?.data ?? [],
        companies: companies?.data ?? [],
        suppliers: suppliers?.data ?? [],
        divisions: divisions?.data ?? [],
        operations: operations?.data ?? [],
        branches: branches?.data ?? [],
        qrPaymentTypes: qrPaymentTypes?.data ?? [],
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load lookups.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
