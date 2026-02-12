"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { Calendar as CalendarIcon, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useFilters, type PeriodFilter } from "@/context/FilterContext"
import { Separator } from "@/components/ui/separator"

export function DateRangeFilter({ className }: { className?: string }) {
  const {
    fromDate,
    toDate,
    periodFilter,
    setPeriodFilter,
    setCustomDateRange,
    customDateRange
  } = useFilters()

  const [isOpen, setIsOpen] = React.useState(false)

  // Convert ISO strings to Date objects for the calendar
  const dateRange = React.useMemo(() => ({
    from: fromDate ? parseISO(fromDate) : undefined,
    to: toDate ? parseISO(toDate) : undefined,
  }), [fromDate, toDate])

  const handlePresetSelect = (preset: PeriodFilter) => {
    setPeriodFilter(preset)
    if (preset !== "custom") {
      setCustomDateRange(undefined)
      setIsOpen(false)
    }
    // If "custom", keep popover open so calendar is visible
  }

  const handleCustomRangeClick = () => {
    setPeriodFilter("custom")
    // Pre-fill with current range when switching from a preset so user can adjust
    if (!customDateRange?.from && !customDateRange?.to && dateRange.from && dateRange.to) {
      setCustomDateRange({ from: dateRange.from, to: dateRange.to })
    }
  }

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    setCustomDateRange(range)
    if (range?.from) {
      setPeriodFilter("custom")
    }
    // Close when range is complete so user doesn't have to click outside
    if (range?.from && range?.to) {
      setIsOpen(false)
    }
  }

  const presets: { value: PeriodFilter; label: string }[] = [
    { value: "7days", label: "Next 7 Days" },
    { value: "15days", label: "Next 15 Days" },
    { value: "30days", label: "Next 30 Days" },
    { value: "quarter", label: "Next Quarter" },
    { value: "year", label: "Next Year" },
  ]

  const getButtonLabel = () => {
    if (periodFilter === "custom") {
      const from = customDateRange?.from ?? dateRange.from
      const to = customDateRange?.to ?? dateRange.to
      if (from && to) return `${format(from, "LLL dd, y")} - ${format(to, "LLL dd, y")}`
      if (from) return `${format(from, "LLL dd, y")} - Select end`
      return "Custom Range"
    }
    const preset = presets.find(p => p.value === periodFilter)
    return preset ? preset.label : "Select Date"
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[240px] justify-start text-left font-normal border border-border bg-background hover:bg-accent/40 hover:border-primary/40 transition-colors",
              !dateRange.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="truncate">{getButtonLabel()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className={cn(
              "flex flex-col gap-1 p-2 min-w-[140px] bg-muted/30",
              periodFilter === "custom" ? "border-r border-border" : ""
            )}>
              <span className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">Presets</span>
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  variant="ghost"
                  className={cn(
                    "justify-start h-8 text-sm font-normal px-2",
                    periodFilter === preset.value && "bg-card border border-border shadow-sm font-medium text-primary"
                  )}
                  onClick={() => handlePresetSelect(preset.value)}
                >
                  {periodFilter === preset.value && <Check className="mr-2 h-3 w-3" />}
                  {preset.label}
                </Button>
              ))}
              <Separator className="my-1" />
              <Button
                variant="ghost"
                className={cn(
                  "justify-start h-8 text-sm font-normal px-2",
                  periodFilter === "custom" && "bg-card border border-border shadow-sm font-medium text-primary"
                )}
                onClick={handleCustomRangeClick}
              >
                {periodFilter === "custom" && <Check className="mr-2 h-3 w-3" />}
                Custom Range
              </Button>
            </div>
            {periodFilter === "custom" && (
              <div className="p-2">
                <Calendar
                  mode="range"
                  defaultMonth={(customDateRange?.from ?? customDateRange?.to ?? dateRange.from ?? dateRange.to) ?? new Date()}
                  selected={customDateRange}
                  onSelect={handleCalendarSelect}
                  numberOfMonths={2}
                  disabled={() => false}
                />
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
