import { User, Department } from "../employee-masterlist/types";

export interface FaceBiometricRecord {
  id: number;
  user_id: number;
  face_encoding: string;
  image_reference_path?: string | null;
  is_active: boolean | number;
  registered_by?: number | null;
  registered_at?: string;
}

export type { User, Department };
