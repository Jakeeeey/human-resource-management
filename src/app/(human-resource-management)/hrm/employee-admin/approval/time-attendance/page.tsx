import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import TAApprovalModule from "@/modules/human-resource-management/employee-admin/approval/time-attendance/TAApprovalModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickString(
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): string {
  for (const k of keys) {
    const v = obj ? obj[k] : undefined;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function buildNavUser(token: string | null | undefined) {
  const payload = token ? decodeJwtPayload(token) : null;

  const first = pickString(payload as Record<string, unknown>, [
    "Firstname", "FirstName", "firstName", "firstname", "first_name",
  ]);
  const last = pickString(payload as Record<string, unknown>, [
    "LastName", "Lastname", "lastName", "lastname", "last_name",
  ]);
  const email = pickString(payload as Record<string, unknown>, ["email", "Email"]);
  const name = [first, last].filter(Boolean).join(" ") || email || "User";

  return { name, email: email || "", avatar: "/avatars/shadcn.jpg" };
}

export default async function TimeAttendanceApprovalPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerUser = buildNavUser(token);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b shadow-sm bg-background sm:h-16 overflow-hidden">
        <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4 overflow-hidden">
          <SidebarTrigger className="-ml-1 shrink-0" />

          <Separator
            orientation="vertical"
            className="hidden sm:block mr-2 data-[orientation=vertical]:h-4 shrink-0"
          />

          <div className="min-w-0 overflow-hidden">
            <Breadcrumb>
              <BreadcrumbList className="min-w-0 overflow-hidden">
                <BreadcrumbItem className="hidden md:block shrink-0">
                  <BreadcrumbLink href="/hrm">HRM</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                <BreadcrumbItem className="hidden md:block shrink-0">
                  <BreadcrumbLink href="#">Employee Admin</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                <BreadcrumbItem className="hidden md:block shrink-0">
                  <BreadcrumbLink href="#">Approval</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                <BreadcrumbItem className="min-w-0 overflow-hidden">
                  <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                    Time &amp; Attendance
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <div className="flex h-full items-center px-2 sm:px-4 shrink-0 max-w-[48vw] sm:max-w-none overflow-hidden">
          <NavUser user={headerUser} />
        </div>
      </header>

      {/* ── Page Content ───────────────────────────────────────────────── */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <TAApprovalModule />
      </main>
    </div>
  );
}
