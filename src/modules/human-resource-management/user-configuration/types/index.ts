export interface UserSubsystemAccess {
    user_id: string;
    email: string;
    full_name: string;
    authorized_subsystems: string[]; // Contains slugs of subsystems, modules, and sub-modules
}
