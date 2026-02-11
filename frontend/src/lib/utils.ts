import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates dynamic font size class for KPI values based on the value's magnitude and format.
 * Larger values (millions, long numbers) get smaller font sizes to fit better in tiles.
 * 
 * @param value - The KPI value string (e.g., "1.5M", "250k", "1500k tons", "1234567", "45%")
 * @returns Tailwind CSS class string for font size
 */
export function getKpiFontSize(value: string): string {
  const valueLower = value.toLowerCase();
  const numericPart = value.replace(/[^\d.]/g, ''); // Extract numeric part
  const numValue = parseFloat(numericPart) || 0;
  
  // Check for explicit millions (M, million)
  if (valueLower.includes('m') && !valueLower.includes('km') && !valueLower.includes('mill')) {
    return 'text-base'; // Smaller for millions
  }
  
  // Check for thousands with 'k' suffix
  // If the numeric value before 'k' is >= 1000, it's actually representing millions
  // e.g., "1500k" = 1.5 million, "2500k" = 2.5 million
  if (valueLower.includes('k')) {
    if (numValue >= 1000) {
      // This is actually in millions (e.g., 1500k = 1.5M)
      return 'text-base';
    } else {
      // This is in thousands (e.g., 250k)
      return 'text-lg';
    }
  }
  
  // Check numeric value length (number of digits)
  const digitCount = numericPart.replace('.', '').length;
  
  if (digitCount >= 7) {
    // 7+ digits (millions range)
    return 'text-base';
  } else if (digitCount >= 5) {
    // 5-6 digits (hundreds of thousands)
    return 'text-lg';
  } else if (digitCount >= 4) {
    // 4 digits (thousands)
    return 'text-xl';
  } else {
    // 1-3 digits (small numbers, percentages)
    return 'text-2xl';
  }
}
