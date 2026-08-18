import { AttendanceSettings, GeneralSetting } from "../types";

export class AttendanceSettingService {
    /**
     * Fetches the rfid_attendance and face_attendance settings.
     */
    static async fetchSettings(): Promise<AttendanceSettings> {
        try {
            const response = await fetch('/api/hrm/system-management/attendance-setting');
            if (!response.ok) {
                console.error("Failed to fetch attendance settings");
                return { rfid_attendance: null, face_attendance: null };
            }

            const result = await response.json();
            const data: GeneralSetting[] = result.data || result;

            const rfidSetting = data.find((s) => s.setting_key === "rfid_attendance") || null;
            const faceSetting = data.find((s) => s.setting_key === "face_attendance") || null;

            return {
                rfid_attendance: rfidSetting,
                face_attendance: faceSetting,
            };
        } catch (error) {
            console.error("Error fetching attendance settings:", error);
            return { rfid_attendance: null, face_attendance: null };
        }
    }

    /**
     * Updates a specific general setting by its ID.
     */
    static async updateSetting(id: number, value: string): Promise<boolean> {
        try {
            const response = await fetch(`/api/hrm/system-management/attendance-setting/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ setting_value: value }),
            });

            return response.ok;
        } catch (error) {
            console.error(`Error updating setting ${id}:`, error);
            return false;
        }
    }
}
