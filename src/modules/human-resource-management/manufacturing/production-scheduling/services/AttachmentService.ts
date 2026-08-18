import { ScheduleAttachment } from "../types";

export class AttachmentService {
    static async getAttachments(scheduleId: number): Promise<ScheduleAttachment[]> {
        const response = await fetch(`/api/hrm/manufacturing/schedules/${scheduleId}/attachments`);
        if (!response.ok) {
            throw new Error(`Error fetching attachments: ${response.statusText}`);
        }
        const result = await response.json();
        return result.data || [];
    }

    static async uploadAttachment(scheduleId: number, file: File, userId: number | null): Promise<ScheduleAttachment> {
        const formData = new FormData();
        formData.append("file", file);
        if (userId) {
            formData.append("userId", userId.toString());
        }

        const response = await fetch(`/api/hrm/manufacturing/schedules/${scheduleId}/attachments`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error uploading attachment: ${response.statusText}`);
        }
        const result = await response.json();
        return result.data;
    }

    static async deleteAttachment(attachmentId: number): Promise<boolean> {
        const response = await fetch(`/api/hrm/manufacturing/schedules/attachments/${attachmentId}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            throw new Error(`Error deleting attachment: ${response.statusText}`);
        }
        return true;
    }
}
