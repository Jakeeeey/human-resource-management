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

export interface SuperiorOption {
  value: string;
  label: string;
}

export function SuperiorCombobox(props: {
  options: SuperiorOption[];
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
    placeholder = "Select a superior",
    disabled = false,
    id,
  } = props;

  const labelByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) {
      map.set(option.value, option.label);
    }
    return map;
  }, [options]);

  const normalizedValue = value.trim() === "" ? null : value.trim();

  return (
    <Combobox
      items={options.map((option) => option.value)}
      value={normalizedValue}
      onValueChange={(next) => onValueChange(next ?? "")}
      itemToStringLabel={(itemValue) => labelByValue.get(itemValue) ?? itemValue}
      filter={(itemValue, query, itemToString) => {
        const label = (itemToString ? itemToString(itemValue) : itemValue).toLowerCase();
        return label.includes(query.trim().toLowerCase());
      }}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        showClear={normalizedValue != null}
      />
      <ComboboxContent>
        <ComboboxEmpty>No superior matches the search.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item === "" ? "none" : item} value={item}>
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
