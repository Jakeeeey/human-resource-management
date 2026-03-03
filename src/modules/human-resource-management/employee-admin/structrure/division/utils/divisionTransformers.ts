export function attachDivisionRelations(
    divisions: Record<string, unknown>[],
    users: Record<string, unknown>[],
    departments: Record<string, unknown>[],
    dpd: Record<string, unknown>[]
) {
    const uMap = new Map(users.map(u => [u.user_id, u]));
    const dMap = new Map(departments.map(d => [d.department_id, d]));

    return divisions.map(div => {
        const deps = dpd
            .filter(x => x.division_id === div.division_id)
            .map(x => dMap.get(x.department_id))
            .filter(Boolean);

        return {
            ...div,
            division_head_user: uMap.get(div.division_head) || null,
            departments: deps,
        };
    });
}
