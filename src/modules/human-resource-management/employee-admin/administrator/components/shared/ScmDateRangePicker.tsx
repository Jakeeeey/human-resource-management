"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ScmDateRangePickerProps {
  className?: string;
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
}

export function ScmDateRangePicker({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  className,
  date: externalDate,
  onDateChange,
}: ScmDateRangePickerProps) {
  const [internalDate, setInternalDate] = React.useState<DateRange | undefined>(
    externalDate,
  );
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setInternalDate(externalDate);
    }
  }, [isOpen, externalDate]);

  const handleApply = () => {
    onDateChange(internalDate);
    setIsOpen(false);
  };

  const handleClear = () => {
    setInternalDate(undefined);
    onDateChange(undefined);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button id="date" variant={"outline"} className="font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span>Date Range</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <div className="p-4 space-y-4">
          {/* From Date Section */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">From Date</h4>
            <Calendar
              mode="single"
              selected={internalDate?.from}
              onSelect={(day) =>
                setInternalDate((prev) => ({ ...prev, from: day }))
              }
              initialFocus
              className="p-3"
            />
          </div>

          {/* To Date Section */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">To Date</h4>
            <Calendar
              mode="single"
              selected={internalDate?.to}
              onSelect={(day) =>
                setInternalDate((prev) => ({
                  from: prev?.from,
                  to: day,
                }))
              }
              className="p-3"
              disabled={(date) =>
                internalDate?.from ? date < internalDate.from : false
              }
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="default" className="flex-1 " onClick={handleApply}>
              Apply
            </Button>
            <Button variant="outline" className="flex-1 " onClick={handleClear}>
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
