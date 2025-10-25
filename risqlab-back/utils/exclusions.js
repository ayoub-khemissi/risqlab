import Database from '../lib/database.js';

/**
 * Fallback list of cryptocurrency symbols to exclude from the RisqLab 80 Index
 * Used when metadata is not available in the database
 */

// Stablecoins - Cryptocurrencies pegged to fiat currencies
export const STABLECOINS = [
  'USDT',  // Tether
  'USDC',  // USD Coin
  'DAI',   // Dai
  'BUSD',  // Binance USD
  'TUSD',  // TrueUSD
  'USDP',  // Pax Dollar
  'USDD',  // USDD
  'GUSD',  // Gemini Dollar
  'PYUSD', // PayPal USD
  'FDUSD', // First Digital USD
  'USDE',  // Ethena USDe
  'FRAX',  // Frax
  'LUSD',  // Liquity USD
  'SUSD',  // sUSD
  'CUSD',  // Celo Dollar
  'USDJ',  // USDJ
  'RSR',   // Reserve Rights (related to RSV stablecoin)
  'USDN',  // Neutrino USD
  'FEI',   // Fei USD
  'TRIBE', // Tribe (related to FEI)
];

// Asset-backed wrapper tokens - Tokens representing ownership of other cryptocurrencies
export const WRAPPER_TOKENS = [
  'WBTC',  // Wrapped Bitcoin
  'STETH', // Staked Ether (Lido)
  'WETH',  // Wrapped Ether
  'WBNB',  // Wrapped BNB
  'RETH',  // Rocket Pool ETH
  'CBETH', // Coinbase Wrapped Staked ETH
  'WSTETH',// Wrapped stETH
  'BETH',  // Binance Staked ETH
  'SFRXETH', // Staked Frax Ether
  'FRXETH',  // Frax Ether
  'RENBTC',  // renBTC
  'HBTC',    // Huobi BTC
  'TBTC',    // tBTC
  'WMATIC',  // Wrapped MATIC
  'WAVAX',   // Wrapped AVAX
  'WSOL',    // Wrapped SOL
  'WFTM',    // Wrapped FTM
  'WETH2',   // Wrapped ETH 2.0
  'ANKRETH', // Ankr Staked ETH
  'SWETH',   // Swell Staked ETH
];

// Combined exclusion list for fallback
export const EXCLUDED_SYMBOLS = [...STABLECOINS, ...WRAPPER_TOKENS];

/**
 * Check if a cryptocurrency should be excluded from the index based on metadata
 * Falls back to static list if metadata is not available
 *
 * @param {Object} crypto - Cryptocurrency object with metadata
 * @param {string} crypto.symbol - Cryptocurrency symbol
 * @param {boolean} [crypto.is_stablecoin] - From metadata table
 * @param {boolean} [crypto.is_wrapped] - From metadata table
 * @param {boolean} [crypto.is_liquid_staking] - From metadata table
 * @returns {boolean} True if the symbol should be excluded
 */
export function isExcluded(crypto) {
  // If metadata is available, use it (primary method)
  if (typeof crypto.is_stablecoin === 'number' ||
      typeof crypto.is_wrapped === 'number' ||
      typeof crypto.is_liquid_staking === 'number') {
    return Boolean(crypto.is_stablecoin || crypto.is_wrapped || crypto.is_liquid_staking);
  }

  // Fallback to static list if metadata is not available
  return EXCLUDED_SYMBOLS.includes(crypto.symbol?.toUpperCase());
}

/**
 * Get exclusion reason for a cryptocurrency
 * @param {Object} crypto - Cryptocurrency object with metadata
 * @returns {string|null} Exclusion reason or null if not excluded
 */
export function getExclusionReason(crypto) {
  const reasons = [];

  if (crypto.is_stablecoin) reasons.push('Stablecoin');
  if (crypto.is_wrapped) reasons.push('Wrapped Token');
  if (crypto.is_liquid_staking) reasons.push('Liquid Staking');

  if (reasons.length === 0 && EXCLUDED_SYMBOLS.includes(crypto.symbol?.toUpperCase())) {
    reasons.push('Static List');
  }

  return reasons.length > 0 ? reasons.join(', ') : null;
}
