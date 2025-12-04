/**
 * LocalStorage keys used throughout the application
 * Centralized to avoid typos and make it easier to manage
 */
export const STORAGE_KEYS = {
  /**
   * Stores the return path when navigating from crypto table to crypto detail page
   */
  CRYPTO_RETURN_PATH: "cryptoReturnPath",

  /**
   * Stores whether the user has dismissed the "Limited Historical Data" warning
   * Value: "true" if dismissed
   */
  PORTFOLIO_RISK_WARNING_DISMISSED: "portfolioRiskWarningDismissed",
} as const;

/**
 * Type-safe localStorage helper functions
 */
export const storage = {
  /**
   * Get a value from localStorage
   */
  get: (key: keyof typeof STORAGE_KEYS): string | null => {
    if (typeof window === "undefined") return null;

    return localStorage.getItem(STORAGE_KEYS[key]);
  },

  /**
   * Set a value in localStorage
   */
  set: (key: keyof typeof STORAGE_KEYS, value: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS[key], value);
  },

  /**
   * Remove a value from localStorage
   */
  remove: (key: keyof typeof STORAGE_KEYS): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEYS[key]);
  },

  /**
   * Clear all localStorage
   */
  clear: (): void => {
    if (typeof window === "undefined") return;
    localStorage.clear();
  },
};
