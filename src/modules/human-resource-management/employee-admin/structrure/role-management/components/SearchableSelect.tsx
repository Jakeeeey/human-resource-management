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

  const selectedLabel = React.useMemo(() => {
    return options.find((option) => option.value === value)?.label || placeholder;
  }, [options, value, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal transition-all duration-200",
            "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 shadow-sm",
            open && "ring-2 ring-primary/20 border-primary/50",
            className
          )}
        >
          <span className="truncate text-muted-foreground group-hover:text-foreground">
            {value ? options.find(o => o.value === value)?.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-xl border-muted-foreground/20" align="start">
        <Command className="rounded-lg">
          <CommandInput 
            placeholder={`Search ${placeholder.toLowerCase()}...`} 
            className="h-11 border-none focus:ring-0"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-6 text-sm text-muted-foreground text-center">
              {emptyMessage}
            </CommandEmpty>
            <CommandGroup className="p-1.5">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-colors",
                    "hover:bg-primary/10 aria-selected:bg-primary/5 focus:bg-primary/5",
                    value === option.value && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <div className={cn(
                    "flex-1 transition-transform duration-200",
                    value === option.value && "translate-x-1"
                  )}>
                    {option.label}
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4 transition-all duration-300",
                      value === option.value ? "opacity-100 scale-100" : "opacity-0 scale-50"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
