import { z } from "zod";

export const GeneralSettingSchema = z.object({
  id: z.number().or(z.string().transform(Number)),
  setting_key: z.string(),
  setting_value: z.string(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
});

export type GeneralSetting = z.infer<typeof GeneralSettingSchema>;

export interface AttendanceSettings {
  rfid_attendance: GeneralSetting | null;
  face_attendance: GeneralSetting | null;
}
