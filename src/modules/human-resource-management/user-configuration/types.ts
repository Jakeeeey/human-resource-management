export interface UserSubsystemAccess {
    user_id: string;
    email: string;
    full_name: string;
    avatar_url?: string | null;
    authorized_subsystems: string[]; // Contains ALL authorized slugs for UI logic
    authorized_subsystem_ids: number[]; // Contains ALL authorized subsystem primary keys
    authorized_module_ids: number[]; // Contains ALL authorized module primary keys
    subsystemAccessIds: Record<number, number>; // subsystemID -> junction record ID
    moduleAccessIds: Record<number, number>;    // moduleID -> junction record ID
}
