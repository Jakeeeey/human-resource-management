// src/app/(human-resource-management)/hrm/employee-admin/administrator/salesman-management/page.tsx
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
import { NavUser } from "../../../_components/nav-user";

import { cookies } from "next/headers";

// ✅ Wire the module you asked for
import { SalesmanManagementModule } from "@/modules/human-resource-management/salesman-management/SalesmanManagementModule";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const p = parts[1];
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function pickString(obj: any, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function buildHeaderUserFromToken(token: string | null | undefined) {
  const payload = token ? decodeJwtPayload(token) : null;

  const first = pickString(payload, [
    "Firstname",
    "FirstName",
    "firstName",
    "firstname",
    "first_name",
  ]);
  const last = pickString(payload, [
    "LastName",
    "Lastname",
    "lastName",
    "lastname",
    "last_name",
  ]);
  const email = pickString(payload, ["email", "Email"]);

  const name = [first, last].filter(Boolean).join(" ") || email || "User";

  return {
    name,
    email: email || "",
    avatar: "/avatars/shadcn.jpg",
  };
}

export default async function Page() {
  // ✅ Next.js 16: cookies() is async
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

  const headerUser = buildHeaderUserFromToken(token);

  return (
    // ✅ UI ONLY: avoid page-level scroll container; prevent horizontal overflow
    <div className="flex min-h-0 flex-col">
      <header
        className="
          sticky top-2 z-50 relative
          flex h-16 shrink-0 items-center justify-between
          border-b bg-background shadow-sm
          before:content-[''] before:absolute before:inset-x-0 before:-top-2 before:h-2 before:bg-background
        "
      >
        <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />

          <div className="min-w-0">
            <Breadcrumb>
              <BreadcrumbList className="min-w-0">
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Employee Admin</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="truncate">
                    Salesman Management
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <div className="flex h-full items-center px-3 sm:px-4 shrink-0">
          <NavUser user={headerUser} />
        </div>
      </header>

      {/* ✅ UI ONLY: remove ScrollArea so the page doesn't scroll; the table card handles scrolling */}
      <main className="min-h-0 flex-1 p-3 sm:p-4 overflow-x-hidden">
        <SalesmanManagementModule />
      </main>
    </div>
  );
}
