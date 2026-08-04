import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { AttendanceSettings } from "../types";
import { AttendanceSettingService } from "../services/AttendanceSettingService";

export function useAttendanceSetting() {
    const [settings, setSettings] = useState<AttendanceSettings>({
        rfid_attendance: null,
        face_attendance: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await AttendanceSettingService.fetchSettings();
            setSettings(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load settings.");
            toast.error("Failed to load attendance settings");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateSetting = async (key: keyof AttendanceSettings, value: boolean) => {
        const setting = settings[key];
        if (!setting) {
            toast.error("Setting not found. Please refresh the page.");
            return;
        }

        setIsUpdating(true);
        try {
            const success = await AttendanceSettingService.updateSetting(
                Number(setting.id),
                value ? "1" : "0"
            );

            if (success) {
                setSettings((prev) => ({
                    ...prev,
                    [key]: {
                        ...prev[key]!,
                        setting_value: value ? "1" : "0",
                    },
                }));
                toast.success(`${key === 'rfid_attendance' ? 'RFID Tap' : 'Face Recognition'} updated successfully.`);
            } else {
                throw new Error("Update failed");
            }
        } catch (err) {
            toast.error("Failed to update setting");
            console.error(err);
        } finally {
            setIsUpdating(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    return {
        settings,
        isLoading,
        isUpdating,
        error,
        updateSetting,
        refresh: fetchSettings,
    };
}
