export type EtfHolding = {
  id: number;
  etf_symbol: string;
  holding_symbol: string;
  holding_name: string;
  weight_pct: number;
  country: string | null;
  sector: string | null;
  asset_class: string | null;
  nav_date: string;
  provider: string | null;
  fund_url: string | null;
  created_at: string;
};
