export interface PortfolioVolatility {
  id: number;
  index_config_id: number;
  date: string;
  window_days: number;
  daily_volatility: string;
  annualized_volatility: string;
  num_constituents: number;
  total_market_cap_usd: string;
  calculation_duration_ms: number;
  created_at: string;
  index_name?: string;
}

export interface PortfolioVolatilityResponse {
  data: {
    current: PortfolioVolatility | null;
    history: Array<{
      date: string;
      daily_volatility: string;
      annualized_volatility: string;
      num_constituents: number;
      total_market_cap_usd: string;
    }>;
  };
}
