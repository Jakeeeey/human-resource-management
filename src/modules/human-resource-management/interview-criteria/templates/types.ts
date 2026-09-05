export type Stage = "Initial" | "Final";
export type TemplateStatus = "draft" | "active" | "archived";

export interface Criterion {
    id?: number;
    name: string;
    weight_percentage: number;
    is_quiz_criterion: boolean;
    sort: number;
}

export interface Template {
    id: number;
    stage: Stage;
    name: string;
    status: TemplateStatus;
    is_default_for_stage: boolean;
    criteria: Criterion[];
    created_at: string;
}

export interface TemplateFilters {
    search: string;
    stage: Stage | null;
    status: TemplateStatus | null;
}

export interface TemplateFormData {
    stage: Stage;
    name: string;
    status: TemplateStatus;
    is_default_for_stage: boolean;
    criteria: Criterion[];
}
