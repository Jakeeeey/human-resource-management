"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchableDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SearchableDropdownProps {
  options: SearchableDropdownOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  allOptionLabel?: string;
  className?: string;
  popoverWidth?: string;
  disabled?: boolean;
}

export function SearchableDropdown({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  icon,
  allOptionLabel,
  className,
  popoverWidth = "w-[280px]",
  disabled = false,
}: SearchableDropdownProps) {
  const [open, setOpen] = React.useState(false);

  // Determine current display label
  const selectedLabel = React.useMemo(() => {
    if (value === "all" && allOptionLabel) {
      return allOptionLabel;
    }
    const match = options.find((opt) => opt.value === value);
    if (match) return match.label;
    if (value === "all") return allOptionLabel || placeholder;
    return placeholder;
  }, [options, value, allOptionLabel, placeholder]);

  const isCustomSelection = value && value !== "all";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 px-3 justify-between text-xs sm:text-sm font-normal bg-background hover:bg-muted/40 transition-colors border-input",
            !isCustomSelection && "text-foreground",
            isCustomSelection && "font-medium text-primary border-primary/40 bg-primary/5",
            className
          )}
        >
          <div className="flex items-center min-w-0 mr-1.5 overflow-hidden">
            {icon && <span className="shrink-0 mr-2">{icon}</span>}
            <span className="truncate text-left">{selectedLabel}</span>
          </div>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={cn("p-0 shadow-lg border-border", popoverWidth)}
        align="start"
      >
        <Command className="rounded-lg border-0">
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9 text-xs sm:text-sm"
          />
          <CommandList className="max-h-60 overflow-y-auto py-1">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              No results found.
            </CommandEmpty>

            <CommandGroup>
              {allOptionLabel && (
                <CommandItem
                  value={allOptionLabel}
                  onSelect={() => {
                    onValueChange("all");
                    setOpen(false);
                  }}
                  className="text-xs sm:text-sm py-2 px-2.5 cursor-pointer font-medium"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0 text-primary",
                      value === "all" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate flex-1">{allOptionLabel}</span>
                </CommandItem>
              )}

              {options.map((opt) => {
                const isSelected = value === opt.value;
                const searchKeywords = `${opt.label} ${opt.sublabel || ""}`.trim();

                return (
                  <CommandItem
                    key={opt.value}
                    value={searchKeywords}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                    className="text-xs sm:text-sm py-2 px-2.5 cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0 text-primary",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className={cn(
                          "truncate text-left",
                          isSelected ? "font-semibold text-primary" : "font-normal text-foreground"
                        )}
                      >
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span className="text-[10px] text-muted-foreground truncate leading-tight">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
