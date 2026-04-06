export interface UserSubsystemAccess {
    user_id: string;
    email: string;
    full_name: string;
    avatar_url?: string | null;
    authorized_subsystems: string[]; // Contains ALL authorized slugs for UI logic
    subsystemAccessIds: Record<string, number>; // slug -> junction record ID
    moduleAccessIds: Record<string, number>;    // slug -> junction record ID
}
