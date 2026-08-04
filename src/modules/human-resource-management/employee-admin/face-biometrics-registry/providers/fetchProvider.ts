"use server";

import { FaceBiometricRecord } from "../types";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function fetchAllFaceBiometrics(): Promise<FaceBiometricRecord[]> {
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) return [];
  const res = await fetch(`${DIRECTUS_URL}/items/user_face_biometrics?limit=-1`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    next: { revalidate: 0 }
  });
  if (!res.ok) {
    console.error("Failed to fetch user_face_biometrics", await res.text());
    return [];
  }
  const json = await res.json();
  return json.data || [];
}

export async function createFaceBiometric(payload: Partial<FaceBiometricRecord>): Promise<FaceBiometricRecord> {
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) throw new Error("API not configured");
  
  const res = await fetch(`${DIRECTUS_URL}/items/user_face_biometrics`, {
    method: "POST",
    headers: { 
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create face biometric: ${err}`);
  }
  const json = await res.json();
  return json.data;
}

export async function uploadImageToDirectus(formData: FormData): Promise<string> {
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) throw new Error("API not configured");
  
  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    body: formData
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload image: ${err}`);
  }
  
  const json = await res.json();
  return json.data.id;
}

export async function invalidateUserBiometrics(userId: number): Promise<void> {
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) throw new Error("API not configured");
  
  const fetchRes = await fetch(`${DIRECTUS_URL}/items/user_face_biometrics?filter[user_id][_eq]=${userId}&filter[is_active][_eq]=true`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }
  });
  
  if (!fetchRes.ok) return;
  const data = await fetchRes.json();
  const existingRecords = data.data || [];
  
  for (const record of existingRecords) {
    await fetch(`${DIRECTUS_URL}/items/user_face_biometrics/${record.id}`, {
      method: "PATCH",
      headers: { 
          Authorization: `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json"
      },
      body: JSON.stringify({ is_active: false })
    });
  }
}

export async function checkDuplicateFace(newDescriptorArray: number[]): Promise<{ isDuplicate: boolean; matchedUserId?: number }> {
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) throw new Error("API not configured");

  // Fetch all active biometrics
  const fetchRes = await fetch(`${DIRECTUS_URL}/items/user_face_biometrics?filter[is_active][_eq]=true&limit=-1`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    next: { revalidate: 0 }
  });
  
  if (!fetchRes.ok) return { isDuplicate: false };
  const data = await fetchRes.json();
  const existingRecords: FaceBiometricRecord[] = data.data || [];

  for (const record of existingRecords) {
    if (!record.face_encoding) continue;
    try {
      const existingDescriptor = JSON.parse(record.face_encoding) as number[];
      if (existingDescriptor.length !== 128) continue;
      
      // Calculate Euclidean distance
      let sum = 0;
      for (let i = 0; i < 128; i++) {
        const diff = existingDescriptor[i] - newDescriptorArray[i];
        sum += diff * diff;
      }
      const distance = Math.sqrt(sum);
      
      // face-api.js default distance threshold is 0.6
      if (distance < 0.55) {
        return { isDuplicate: true, matchedUserId: record.user_id };
      }
    } catch {
      // Ignore invalid encodings
    }
  }

  return { isDuplicate: false };
}

export async function verifyFaceMatch(liveDescriptorArray: number[]): Promise<{ success: boolean; matchedUserId?: number }> {
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) throw new Error("API not configured");

  // Fetch all active biometrics
  const fetchRes = await fetch(`${DIRECTUS_URL}/items/user_face_biometrics?filter[is_active][_eq]=true&limit=-1`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    next: { revalidate: 0 }
  });
  
  if (!fetchRes.ok) return { success: false };
  const data = await fetchRes.json();
  const existingRecords: FaceBiometricRecord[] = data.data || [];

  let bestMatchId: number | undefined;
  let lowestDistance = 0.55; // Threshold for face-api.js

  for (const record of existingRecords) {
    if (!record.face_encoding) continue;
    try {
      const existingDescriptor = JSON.parse(record.face_encoding) as number[];
      if (existingDescriptor.length !== 128) continue;
      
      let sum = 0;
      for (let i = 0; i < 128; i++) {
        const diff = existingDescriptor[i] - liveDescriptorArray[i];
        sum += diff * diff;
      }
      const distance = Math.sqrt(sum);
      
      if (distance < lowestDistance) {
        lowestDistance = distance;
        bestMatchId = record.user_id;
      }
    } catch {
      // Ignore
    }
  }

  if (bestMatchId !== undefined) {
    // Log success
    await fetch(`${DIRECTUS_URL}/items/user_face_scan_logs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: bestMatchId, scan_status: "SUCCESS", confidence_score: lowestDistance })
    }).catch(console.error);

    return { success: true, matchedUserId: bestMatchId };
  }

  // Log failure
  await fetch(`${DIRECTUS_URL}/items/user_face_scan_logs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: null, scan_status: "FAILED", confidence_score: lowestDistance === 0.55 ? null : lowestDistance })
  }).catch(console.error);

  return { success: false };
}
