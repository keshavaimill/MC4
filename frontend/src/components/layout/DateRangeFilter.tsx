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
        }
        setIsOpen(false)
    }

    const handleCalendarSelect = (range: any) => {
        // If range is cleared or partial, just update state temporarily?
        // Actually we need to set filter to custom immediately if we want to see it reflect
        // BUT typically date range pickers wait for complete selection or update live.
        // Let's update live.
        setCustomDateRange(range)
        if (range?.from) {
            setPeriodFilter("custom")
        }
    }

    const presets: { value: PeriodFilter; label: string }[] = [
        { value: "7days", label: "Next 7 Days" },
        { value: "30days", label: "Next 30 Days" },
        { value: "quarter", label: "Next Quarter" },
        { value: "year", label: "Next Year" },
    ]

    const getButtonLabel = () => {
        if (periodFilter === "custom" && dateRange.from && dateRange.to) {
            return `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`
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
                            "w-[240px] justify-start text-left font-normal border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-primary/50 transition-colors",
                            !dateRange && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-600" />
                        <span className="truncate">{getButtonLabel()}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="flex">
                        <div className="flex flex-col gap-1 p-2 min-w-[140px] border-r border-border bg-gray-50/50">
                            <span className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">Presets</span>
                            {presets.map((preset) => (
                                <Button
                                    key={preset.value}
                                    variant="ghost"
                                    className={cn(
                                        "justify-start h-8 text-sm font-normal px-2",
                                        periodFilter === preset.value && "bg-white border border-gray-200 shadow-sm font-medium text-primary"
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
                                    periodFilter === "custom" && "bg-white border border-gray-200 shadow-sm font-medium text-primary"
                                )}
                                onClick={() => {
                                    setPeriodFilter("custom");
                                    // Keep open to let them pick
                                }}
                            >
                                {periodFilter === "custom" && <Check className="mr-2 h-3 w-3" />}
                                Custom Range
                            </Button>
                        </div>
                        <div className="p-2">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange.from}
                                selected={periodFilter === 'custom' ? customDateRange : dateRange}
                                onSelect={handleCalendarSelect}
                                numberOfMonths={2}
                                disabled={(date) => {
                                    // Optional: disable dates if needed, e.g., far past or far future?
                                    // For now, allow all as per requirements (historical + future)
                                    return false;
                                }}
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
