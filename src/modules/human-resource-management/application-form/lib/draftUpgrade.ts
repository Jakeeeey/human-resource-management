import {
    EMPTY_FAMILY_DEPENDENT,
    EMPTY_FAMILY_MEMBER,
    EMPTY_WORK_EXPERIENCE,
    type FamilyDependentRow,
    type FamilyMemberFields,
    type WorkExperienceRow,
} from "../types";

export function upgradeDraftValues<T extends object>(
    saved: T & {
        father?: Partial<FamilyMemberFields>;
        mother?: Partial<FamilyMemberFields>;
        spouse?: Partial<FamilyMemberFields>;
        family_dependents?: Partial<FamilyDependentRow>[];
        work_experience?: Partial<WorkExperienceRow>[];
    }
) {
    return {
        ...saved,
        father: { ...EMPTY_FAMILY_MEMBER, ...saved.father },
        mother: { ...EMPTY_FAMILY_MEMBER, ...saved.mother },
        spouse: { ...EMPTY_FAMILY_MEMBER, ...saved.spouse },
        family_dependents: (saved.family_dependents ?? []).map((d) => ({ ...EMPTY_FAMILY_DEPENDENT, ...d })),
        work_experience: (saved.work_experience ?? []).map((w) => ({ ...EMPTY_WORK_EXPERIENCE, ...w })),
    };
}
