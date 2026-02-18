"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  emptyMessage = "No option found.",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className={cn(
          "w-full flex items-center justify-between px-3 font-normal transition-all duration-200",
          "border border-muted-foreground/20 rounded-md bg-background shadow-sm",
          "hover:border-primary/50 hover:bg-primary/5",
          open && "ring-2 ring-primary/20 border-primary/50",
          className
        )}
      >
        <span className={cn("truncate text-sm", selectedLabel ? "text-foreground" : "text-muted-foreground")}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
      </button>

      {/* Inline dropdown — rendered in normal flow, no portal/overflow conflict */}
      {open && (
        <div className="absolute z-[9999] left-0 right-0 mt-1 rounded-lg border border-muted-foreground/20 bg-popover shadow-xl">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-muted-foreground/10 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Scrollable list */}
          <div
            className="max-h-[220px] overflow-y-auto overscroll-contain p-1.5"
            onWheel={(e) => e.stopPropagation()}
          >
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onValueChange(option.value === value ? "" : option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                    "hover:bg-primary/10",
                    value === option.value && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <span className={cn("flex-1 transition-transform duration-150", value === option.value && "translate-x-1")}>
                    {option.label}
                  </span>
                  <Check
                    className={cn(
                      "h-4 w-4 transition-all duration-200",
                      value === option.value ? "opacity-100 scale-100" : "opacity-0 scale-50"
                    )}
                  />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
