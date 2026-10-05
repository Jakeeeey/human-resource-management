"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";

import { useClearanceTemplatesFetch } from "../providers/clearanceTemplatesProvider";
import { CategoriesPanel } from "./CategoriesPanel";
import { TemplatesPanel } from "./TemplatesPanel";

export function TemplatesWorkspace(): JSX.Element {
    const { templates } = useClearanceTemplatesFetch();
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [search, setSearch] = useState("");

    const query = search.trim().toLowerCase();
    const visible = useMemo(() => {
        if (query === "") {
            return templates.data;
        }
        return templates.data.filter((row) => row.title.toLowerCase().includes(query));
    }, [templates.data, query]);

    const selected =
        templates.data.find((row) => row.id === selectedId) ?? templates.data[0] ?? null;

    const hiddenBySearch =
        selected !== null && query !== "" && !visible.some((row) => row.id === selected.id);

    return (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
            <TemplatesPanel
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
                search={search}
                onSearchChange={setSearch}
            />
            <CategoriesPanel
                template={selected}
                hiddenBySearch={hiddenBySearch}
                onClearSearch={() => setSearch("")}
            />
        </div>
    );
}
