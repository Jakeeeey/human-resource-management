import { TravelRequest, TravelRequestApprovalPayload } from "../types/schema";

export async function fetchPendingTravelRequests(): Promise<TravelRequest[]> {
  const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/travel_request?filter[status][_eq]=pending`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMessage = "Failed to fetch pending travel requests";
    try {
      const err = JSON.parse(errText);
      errMessage = err.errors?.[0]?.message || err.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }

  const { data } = await response.json();
  return (data || []).map((item: Record<string, unknown>) => ({
    ...item,
    id: item.travel_id || item.id,
  }));
}

export async function updateTravelRequestStatus(id: number | string, payload: TravelRequestApprovalPayload): Promise<TravelRequest> {
  const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/travel_request/${id}`;
  
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMessage = "Failed to update travel request status";
    try {
      const err = JSON.parse(errText);
      errMessage = err.errors?.[0]?.message || err.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }

  const { data } = await response.json();
  return data;
}
