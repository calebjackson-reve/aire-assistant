/**
 * AIRE Intelligence — Louisiana Real Estate Deadline Calculator
 * Based on Louisiana Residential Agreement to Buy or Sell (LREC standard form)
 *
 * Key Louisiana-specific rules:
 * - Inspection period: typically 14 days from acceptance
 * - Appraisal contingency: typically 14 days from acceptance
 * - Financing contingency: typically 21-30 days from acceptance
 * - Title examination: 20 days before closing
 * - Act of sale (closing): per contract date
 * - Louisiana uses "calendar days" unless specified
 * - Weekends count, but if deadline falls on weekend/holiday, moves to next business day
 */

export interface TransactionDates {
  contractDate: Date;
  closingDate?: Date;
  inspectionDays?: number;
  appraisalDays?: number;
  financingDays?: number;
  titleDays?: number;
}

export interface CalculatedDeadline {
  name: string;
  dueDate: Date;
  daysFromContract: number;
  category: "inspection" | "appraisal" | "financing" | "title" | "closing" | "custom";
  priority: "high" | "medium" | "low";
  description: string;
}

// Louisiana state holidays (2026)
const LA_HOLIDAYS_2026 = [
  "2026-01-01", // New Year's Day
  "2026-01-19", // Martin Luther King Jr.
  "2026-02-17", // Mardi Gras (state holiday in LA)
  "2026-05-25", // Memorial Day
  "2026-07-04", // Independence Day
  "2026-09-07", // Labor Day
  "2026-11-11", // Veterans Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
];

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split("T")[0];
  return LA_HOLIDAYS_2026.includes(dateStr);
}

function nextBusinessDay(date: Date): Date {
  const result = new Date(date);
  while (isWeekend(result) || isHoliday(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

function addCalendarDays(start: Date, days: number): Date {
  const result = new Date(start);
  result.setDate(result.getDate() + days);
  return nextBusinessDay(result);
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

/**
 * Calculate all Louisiana real estate transaction deadlines
 */
export function calculateDeadlines(
  input: TransactionDates
): CalculatedDeadline[] {
  const {
    contractDate,
    closingDate,
    inspectionDays = 14,
    appraisalDays = 14,
    financingDays = 25,
    titleDays = 20,
  } = input;

  const deadlines: CalculatedDeadline[] = [];

  // 1. Inspection deadline
  const inspectionDate = addCalendarDays(contractDate, inspectionDays);
  deadlines.push({
    name: "Inspection Deadline",
    dueDate: inspectionDate,
    daysFromContract: inspectionDays,
    category: "inspection",
    priority: "high",
    description: `Buyer must complete property inspection within ${inspectionDays} calendar days of contract acceptance. Request repairs or terminate.`,
  });

  // 2. Inspection repair response (3 days after inspection report)
  const repairResponseDate = addCalendarDays(inspectionDate, 3);
  deadlines.push({
    name: "Seller Repair Response",
    dueDate: repairResponseDate,
    daysFromContract: daysBetween(contractDate, repairResponseDate),
    category: "inspection",
    priority: "medium",
    description: "Seller must respond to buyer's inspection repair requests within 3 days.",
  });

  // 3. Appraisal deadline
  const appraisalDate = addCalendarDays(contractDate, appraisalDays);
  deadlines.push({
    name: "Appraisal Deadline",
    dueDate: appraisalDate,
    daysFromContract: appraisalDays,
    category: "appraisal",
    priority: "high",
    description: `Appraisal must be completed within ${appraisalDays} calendar days. If value is below offer, buyer can negotiate or terminate.`,
  });

  // 4. Financing contingency
  const financingDate = addCalendarDays(contractDate, financingDays);
  deadlines.push({
    name: "Financing Contingency Deadline",
    dueDate: financingDate,
    daysFromContract: financingDays,
    category: "financing",
    priority: "high",
    description: `Buyer must secure loan commitment within ${financingDays} days. Failure allows termination with earnest money return.`,
  });

  // 5. Title examination (20 days before closing)
  if (closingDate) {
    const titleDate = addCalendarDays(closingDate, -titleDays);
    deadlines.push({
      name: "Title Examination Due",
      dueDate: titleDate,
      daysFromContract: daysBetween(contractDate, titleDate),
      category: "title",
      priority: "medium",
      description: `Title company must complete title search ${titleDays} days before closing. Clears liens and encumbrances.`,
    });

    // 6. Final walkthrough (24-48 hours before closing)
    const walkthroughDate = addCalendarDays(closingDate, -2);
    deadlines.push({
      name: "Final Walkthrough",
      dueDate: walkthroughDate,
      daysFromContract: daysBetween(contractDate, walkthroughDate),
      category: "closing",
      priority: "medium",
      description: "Buyer's final walkthrough to verify property condition and completed repairs.",
    });

    // 7. Closing / Act of Sale
    const closingBusinessDay = nextBusinessDay(closingDate);
    deadlines.push({
      name: "Closing / Act of Sale",
      dueDate: closingBusinessDay,
      daysFromContract: daysBetween(contractDate, closingBusinessDay),
      category: "closing",
      priority: "high",
      description: "Act of Sale — all parties sign closing documents at title company.",
    });
  }

  // 8. Earnest money deposit (typically 24-48 hours after acceptance in LA)
  const earnestDate = addCalendarDays(contractDate, 2);
  deadlines.push({
    name: "Earnest Money Deposit Due",
    dueDate: earnestDate,
    daysFromContract: 2,
    category: "financing",
    priority: "high",
    description: "Buyer must deliver earnest money deposit to escrow within 2 business days of acceptance.",
  });

  // Sort by due date
  deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return deadlines;
}

/**
 * Get upcoming deadlines within N days for alert system
 */
export function getUpcomingDeadlines(
  deadlines: CalculatedDeadline[],
  withinDays: number = 3
): CalculatedDeadline[] {
  const now = new Date();
  const cutoff = addCalendarDays(now, withinDays);

  return deadlines.filter(
    (d) => d.dueDate >= now && d.dueDate <= cutoff
  );
}

/**
 * Format deadline for SMS alert
 */
export function formatDeadlineAlert(deadline: CalculatedDeadline, propertyAddress: string): string {
  const dateStr = deadline.dueDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return `🏠 AIRE ALERT: ${deadline.name} for ${propertyAddress} is due ${dateStr}. ${deadline.description}`;
}
