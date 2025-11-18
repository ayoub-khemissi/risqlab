import config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Main function to fetch cryptocurrency market data from CoinMarketCap
 * and store it in the database.
 */
async function fetchCryptoMarketData() {
  try {
    log.info('Starting cryptocurrency market data fetch...');

    // Generate a single timestamp for this entire fetch batch
    const fetchTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    log.info(`Fetch timestamp: ${fetchTimestamp}`);

    // 1. Fetch data from CoinMarketCap API
    const response = await fetch(`${Constants.COINMARKETCAP_LISTINGS_LATEST}?limit=${config.COINMARKETCAP_CRYPTO_FETCH_LIMIT}&convert=USD`, {
      headers: {
        'X-CMC_PRO_API_KEY': config.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from CoinMarketCap API');
    }

    const cryptos = data.data;
    log.info(`Fetched ${cryptos.length} cryptocurrencies`);

    // 2. Process each cryptocurrency
    let successCount = 0;
    let errorCount = 0;

    for (const crypto of cryptos) {
      try {
        await processCrypto(crypto, fetchTimestamp);
        successCount++;
      } catch (error) {
        errorCount++;
        log.error(`Error processing ${crypto.symbol}: ${error.message}`);
      }
    }

    log.info(`Processing complete: ${successCount} successful, ${errorCount} errors`);
  } catch (error) {
    log.error(`Error fetching crypto market data: ${error.message}`);
    throw error;
  }
}

/**
 * Process a single cryptocurrency: ensure it exists in the database
 * and insert its market data.
 * @param {Object} crypto - Cryptocurrency data from CoinMarketCap
 * @param {string} fetchTimestamp - Timestamp for this fetch batch
 */
async function processCrypto(crypto, fetchTimestamp) {
  // Get or create cryptocurrency record
  const cryptoId = await getCryptoId(crypto.symbol, crypto.name, crypto.id);

  // Insert market data
  await insertMarketData(cryptoId, crypto, fetchTimestamp);
}

/**
 * Get the cryptocurrency ID from the database, or create a new record if it doesn't exist.
 * @param {string} symbol - Cryptocurrency symbol (e.g., BTC, ETH)
 * @param {string} name - Cryptocurrency name (e.g., Bitcoin, Ethereum)
 * @param {number} cmcId - CoinMarketCap ID
 * @returns {number} The cryptocurrency ID
 */
async function getCryptoId(symbol, name, cmcId) {
  // Check if cryptocurrency exists by symbol
  const [rows] = await Database.execute(
    'SELECT id FROM cryptocurrencies WHERE symbol = ?',
    [symbol]
  );

  if (rows.length > 0) {
    // Update cmc_id if not set
    await Database.execute(
      'UPDATE cryptocurrencies SET cmc_id = ? WHERE id = ? AND cmc_id IS NULL',
      [cmcId, rows[0].id]
    );
    return rows[0].id;
  }

  // Insert new cryptocurrency with cmc_id
  log.info(`Creating new cryptocurrency record: ${symbol} (${name}) - CMC ID: ${cmcId}`);
  const [result] = await Database.execute(
    'INSERT INTO cryptocurrencies (symbol, name, cmc_id) VALUES (?, ?, ?)',
    [symbol, name, cmcId]
  );

  return result.insertId;
}

/**
 * Insert market data for a cryptocurrency.
 * @param {number} cryptoId - The cryptocurrency ID
 * @param {Object} crypto - Cryptocurrency data from CoinMarketCap
 * @param {string} fetchTimestamp - Timestamp for this fetch batch
 */
async function insertMarketData(cryptoId, crypto, fetchTimestamp) {
  const quote = crypto.quote?.USD;

  if (!quote) {
    throw new Error(`No USD quote data available for ${crypto.symbol}`);
  }

  await Database.execute(
    `INSERT INTO market_data
    (crypto_id, price_usd, circulating_supply, volume_24h_usd, percent_change_1h, percent_change_24h,
     percent_change_7d, percent_change_30d, percent_change_60d, percent_change_90d, cmc_rank,
     total_supply, max_supply, fully_diluted_valuation, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    price_usd = VALUES(price_usd),
    circulating_supply = VALUES(circulating_supply),
    volume_24h_usd = VALUES(volume_24h_usd),
    percent_change_1h = VALUES(percent_change_1h),
    percent_change_24h = VALUES(percent_change_24h),
    percent_change_7d = VALUES(percent_change_7d),
    percent_change_30d = VALUES(percent_change_30d),
    percent_change_60d = VALUES(percent_change_60d),
    percent_change_90d = VALUES(percent_change_90d),
    cmc_rank = VALUES(cmc_rank),
    total_supply = VALUES(total_supply),
    max_supply = VALUES(max_supply),
    fully_diluted_valuation = VALUES(fully_diluted_valuation)`,
    [
      cryptoId,
      quote.price || 0,
      crypto.circulating_supply || 0,
      quote.volume_24h || 0,
      quote.percent_change_1h,
      quote.percent_change_24h,
      quote.percent_change_7d,
      quote.percent_change_30d,
      quote.percent_change_60d,
      quote.percent_change_90d,
      crypto.cmc_rank || null,
      crypto.total_supply || null,
      crypto.max_supply || null,
      quote.fully_diluted_market_cap || null,
      fetchTimestamp,
    ]
  );

  log.debug(`Inserted/updated market data for ${crypto.symbol} at ${fetchTimestamp}`);
}

// Run the command
fetchCryptoMarketData()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
