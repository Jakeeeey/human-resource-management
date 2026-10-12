export interface SpringUserCreatePayload {
  email: string;
  personalEmail?: string;
  hashPassword: string;
  userPassword: string;
  password: string;
  user_password: string;
  newPassword: string;
  plainPassword: string;
  rawPassword: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  nickname?: string;
  contact: string;
  province: string;
  city: string;
  brgy: string;
  position?: string;
  department?: string;
  position_id?: number;
  dateOfHire: string;
  role: string;
  admin: boolean;
  tags: string;
  birthday?: string;
  placeOfBirth?: string;
  gender?: string;
  civilStatus?: string;
  religion?: string;
  sssNumber?: string;
  philHealthNumber?: string;
  tinNumber?: string;
  pagibigNumber?: string;
  signature?: string | null;
}

export interface SpringUserCreateOutcome {
    status: number;
    data: unknown;
    userId: number | null;
    duplicateEmail: boolean;
}

const NOT_CONFIGURED_MESSAGE = "Spring Boot API base not configured";

export function extractSpringUserId(body: unknown): number | null {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return null;
    }
    const record = body as Record<string, unknown>;
    const nested = (key: string): Record<string, unknown> | null => {
        const value = record[key];
        return value !== null && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
    };
    const raw =
        record["id"] ??
        record["user_id"] ??
        nested("data")?.["id"] ??
        nested("data")?.["user_id"] ??
        nested("user")?.["id"];
    const parsed =
        typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isDuplicateEmailRejection(status: number, bodyText: string): boolean {
    if (status !== 400 && status !== 409) return false;
    return /already registered|already exists|duplicate|has to be unique/i.test(
        bodyText
    );
}

export async function createSpringUser(
    payload: object,
    authToken?: string
): Promise<SpringUserCreateOutcome> {
  const springBase = process.env.SPRING_API_BASE_URL;
  if (!springBase) {
    return {
      status: 500,
      data: { error: NOT_CONFIGURED_MESSAGE },
      userId: null,
      duplicateEmail: false,
    };
  }

  const response = await fetch(
    `${springBase.replace(/\/+$/, "")}/users/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(payload),
    }
  );

  const rawText = await response.text().catch(() => "");
  let data: unknown = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { error: rawText.slice(0, 500) };
  }

  return {
    status: response.status,
    data,
    userId: response.ok ? extractSpringUserId(data) : null,
    duplicateEmail: isDuplicateEmailRejection(response.status, rawText),
  };
}
