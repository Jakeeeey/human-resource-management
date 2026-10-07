"use client";

import { useMemo } from "react";
import type { JSX } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

const ALL_VALUE = "all";
const ALL_LABEL = "All departments";

export function DepartmentCombobox(props: {
  options: readonly string[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}): JSX.Element {
  const {
    options,
    value,
    onValueChange,
    placeholder = ALL_LABEL,
    disabled = false,
    id,
  } = props;

  const labelByValue = useMemo(() => {
    const map = new Map<string, string>();
    map.set(ALL_VALUE, ALL_LABEL);
    for (const name of options) {
      map.set(name, name);
    }
    return map;
  }, [options]);

  const items = useMemo(() => [ALL_VALUE, ...options], [options]);

  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={(next) => onValueChange(next ?? ALL_VALUE)}
      itemToStringLabel={(itemValue) => labelByValue.get(itemValue) ?? itemValue}
      filter={(itemValue, query, itemToString) => {
        if (itemValue === ALL_VALUE) return true;
        const label = (itemToString ? itemToString(itemValue) : itemValue).toLowerCase();
        return label.includes(query.trim().toLowerCase());
      }}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        aria-label="Filter by department"
        placeholder={placeholder}
        disabled={disabled}
        showClear={value !== ALL_VALUE}
        className="h-10 bg-background sm:w-52"
      />
      <ComboboxContent>
        <ComboboxEmpty>No department matches the search.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              <span
                className="min-w-0 flex-1 truncate"
                title={labelByValue.get(item) ?? item}
              >
                {labelByValue.get(item) ?? item}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
