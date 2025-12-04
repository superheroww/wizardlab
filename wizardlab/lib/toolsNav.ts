export type ToolNavItem = {
  id: string;
  title: string;
  description: string;
  href: string;
};

export const TOOL_NAV_ITEMS: ToolNavItem[] = [
  {
    id: "mix-events",
    title: "Mix events analytics",
    description: "View ETF mix events, top symbols, and popular combinations.",
    href: "/admin/mix-events",
  },
  {
    id: "social-metrics",
    title: "Social metrics",
    description: "Track Reddit triggers and social engagement performance.",
    href: "/admin/social-metrics",
  },
  {
    id: "etf-holdings",
    title: "ETF holdings explorer",
    description: "Inspect normalized ETF holdings by fund and symbol.",
    href: "/admin/etf-holdings",
  },
];
