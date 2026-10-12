"use client";

import { useMemo } from "react";
import type { JSX } from "react";

import type { DirectoryDepartment, DirectoryEmployee } from "../providers/clearanceDirectoryClient";
import { OptionCombobox } from "./OptionCombobox";

const NONE_VALUE = "none";

export function DepartmentSelect(props: {
    departments: readonly DirectoryDepartment[];
    value: number | null;
    onValueChange: (value: number | null) => void;
    noneLabel: string;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    id?: string;
}): JSX.Element {
    const { departments, value, onValueChange, noneLabel, placeholder, searchPlaceholder, disabled, id } = props;

    const options = useMemo(
        () => [
            { value: NONE_VALUE, label: noneLabel },
            ...departments.map((department) => ({ value: String(department.id), label: department.name })),
        ],
        [departments, noneLabel]
    );

    return (
        <OptionCombobox
            options={options}
            value={value === null ? NONE_VALUE : String(value)}
            onValueChange={(next) => {
                if (next === NONE_VALUE || next.trim() === "") {
                    onValueChange(null);
                    return;
                }
                const parsed = Number(next);
                onValueChange(Number.isInteger(parsed) && parsed > 0 ? parsed : null);
            }}
            placeholder={placeholder ?? "Select a department"}
            searchPlaceholder={searchPlaceholder ?? "Search departments…"}
            disabled={disabled}
            id={id}
            emptyMessage="No department matches the search."
        />
    );
}

export function EmployeeSelect(props: {
    employees: readonly DirectoryEmployee[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    id?: string;
    emptyMessage?: string;
}): JSX.Element {
    const { employees, value, onValueChange, placeholder, searchPlaceholder, disabled, id, emptyMessage } = props;

    const options = useMemo(
        () => employees.map((employee) => ({ value: String(employee.id), label: employee.fullName })),
        [employees]
    );

    return (
        <OptionCombobox
            options={options}
            value={value}
            onValueChange={onValueChange}
            placeholder={placeholder ?? "Select an employee"}
            searchPlaceholder={searchPlaceholder ?? "Search employees…"}
            disabled={disabled}
            id={id}
            emptyMessage={emptyMessage ?? "No employee matches the search."}
        />
    );
}
