// Shared mock data for /aire/ui-lab/concepts/* — Q2 2026 placeholder set.

export const HERO_STATS = {
  pipelineMillions: 3.38,
  active: 18,
  closingThisWeek: 4,
  overdue: 3,
  closedYTD: 7,
}

export const MOVES_TODAY = [
  { id: 1, label: "Approve 5834 Guice counter-offer", actor: "J. Smith", urgency: "today" },
  { id: 2, label: "Send inspection update — 1420 Perkins to buyer", actor: "L. Nuñez", urgency: "today" },
  { id: 3, label: "Review Coursey closing docs", actor: "R. Davis", urgency: "≤ 2d" },
] as const

export const TRANSACTIONS = [
  { id: "t1", address: "5834 Guice Dr",       party: "J. Smith",       status: "Inspection",        statusTone: "active",  next: "Counter due", dueIn: "today",   value: 160, pinned: true,  closing: "Apr 24" },
  { id: "t2", address: "1420 Perkins Rd",     party: "L. Nuñez",       status: "Pending Appraisal", statusTone: "pending", next: "Appraisal",   dueIn: "2d",      value: 285, pinned: false, closing: "Apr 19" },
  { id: "t3", address: "7822 Coursey Blvd",   party: "R. Davis",       status: "Pending Financing", statusTone: "overdue", next: "Financing",   dueIn: "overdue", value: 312, pinned: false, closing: "May 02" },
  { id: "t4", address: "2104 Highland Rd",    party: "M. Thibodaux",   status: "Under Contract",    statusTone: "active",  next: "Inspection",  dueIn: "5d",      value: 425, pinned: false, closing: "May 08" },
  { id: "t5", address: "9145 Jefferson Hwy",  party: "K. Boudreaux",   status: "Listing Active",    statusTone: "info",    next: "Showings",    dueIn: "—",       value: 198, pinned: false, closing: "—"      },
  { id: "t6", address: "3340 College Dr",     party: "A. Robichaux",   status: "Closing",           statusTone: "closing", next: "Settlement",  dueIn: "3d",      value: 245, pinned: false, closing: "Apr 15" },
  { id: "t7", address: "6018 Government St",  party: "D. Landry",      status: "Inspection Pending",statusTone: "pending", next: "Schedule",    dueIn: "4d",      value: 179, pinned: false, closing: "Apr 22" },
] as const

export const ACTIVITY = [
  { time: "10:11", actor: "AirSign",     verb: "J. Smith signed counter-offer",       tone: "ok"   },
  { time: "09:23", actor: "Voice",       verb: "Caleb: \u201CShow overdue\u201D",     tone: "info" },
  { time: "09:01", actor: "Auto-file",   verb: "5834_inspection_report.pdf",          tone: "ok"   },
  { time: "08:45", actor: "Compliance",  verb: "Scan clean — 0 violations",           tone: "ok"   },
  { time: "08:14", actor: "Inbox",       verb: "4 new leads triaged",                 tone: "info" },
  { time: "08:02", actor: "Brief",       verb: "Morning Brief synthesized",           tone: "ok"   },
] as const

export const VIEW_TABS = [
  { id: "all",      label: "All",          count: 18, active: true  },
  { id: "mine",     label: "Mine",         count: 14, active: false },
  { id: "closing",  label: "Closing ≤ 7d", count: 4,  active: false },
  { id: "overdue",  label: "Overdue",      count: 3,  active: false },
  { id: "closed",   label: "Closed YTD",   count: 7,  active: false },
] as const

export const RAIL_ITEMS = [
  { id: "01", icon: "sun",   label: "Brief",    badge: null,  active: true  },
  { id: "02", icon: "deals", label: "Deals",    badge: "23",  active: false },
  { id: "03", icon: "inbox", label: "Inbox",    badge: "4",   active: false },
  { id: "04", icon: "sign",  label: "AirSign",  badge: "2",   active: false },
  { id: "05", icon: "users", label: "Contacts", badge: null,  active: false },
  { id: "06", icon: "chart", label: "Market",   badge: null,  active: false },
  { id: "07", icon: "tools", label: "Tools",    badge: null,  active: false },
] as const
