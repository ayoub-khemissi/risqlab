export default {
    JWT_EXPIRATION_TIME: "30d",
    JWT_ALGORITHM: "HS512",

    APP_ID: 1,

    LOG_LEVEL_DEBUG: 1,
    LOG_LEVEL_INFO: 2,
    LOG_LEVEL_WARN: 3,
    LOG_LEVEL_ERROR: 4,

    // CoinMarketCap API
    get COINMARKETCAP_BASE_URL() {
        return 'https://pro-api.coinmarketcap.com';
    },
    get COINMARKETCAP_LISTINGS_LATEST() {
        return `${this.COINMARKETCAP_BASE_URL}/v1/cryptocurrency/listings/latest`;
    },
    get COINMARKETCAP_GLOBAL_METRICS() {
        return `${this.COINMARKETCAP_BASE_URL}/v1/global-metrics/quotes/latest`;
    },
    get COINMARKETCAP_FEAR_AND_GREED() {
        return `${this.COINMARKETCAP_BASE_URL}/v3/fear-and-greed/historical`;
    },
    get COINMARKETCAP_CRYPTO_INFO() {
        return `${this.COINMARKETCAP_BASE_URL}/v2/cryptocurrency/info`;
    },

    // CoinDesk Data API
    get COINDESK_BASE_URL() {
        return 'https://data-api.coindesk.com';
    },
    get COINDESK_OHLCV_DAILY() {
        return `${this.COINDESK_BASE_URL}/index/cc/v1/historical/days`;
    },
    get COINDESK_OHLCV_HOURLY() {
        return `${this.COINDESK_BASE_URL}/index/cc/v1/historical/hours`;
    },
}
