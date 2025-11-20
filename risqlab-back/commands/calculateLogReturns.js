import Database from '../lib/database.js';
import log from '../lib/log.js';
import { logReturn } from '../utils/statistics.js';

/**
 * Calculate and store logarithmic returns for all cryptocurrencies
 * This command should be run daily after market data is fetched
 */
async function calculateLogReturns() {
  const startTime = Date.now();

  try {
    log.info('Starting logarithmic returns calculation...');

    // Get all cryptocurrencies with at least 2 days of market data
    const [cryptos] = await Database.execute(`
      SELECT DISTINCT c.id, c.symbol, c.name
      FROM cryptocurrencies c
      INNER JOIN market_data md ON c.id = md.crypto_id
      GROUP BY c.id, c.symbol, c.name
      HAVING COUNT(DISTINCT DATE(md.timestamp)) >= 2
      ORDER BY c.symbol
    `);

    log.info(`Found ${cryptos.length} cryptocurrencies with sufficient data`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const crypto of cryptos) {
      try {
        const calculated = await calculateLogReturnsForCrypto(crypto.id, crypto.symbol);
        totalCalculated += calculated.inserted;
        totalSkipped += calculated.skipped;
      } catch (error) {
        log.error(`Error calculating log returns for ${crypto.symbol}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`Log returns calculation completed in ${duration}ms`);
    log.info(`Total calculated: ${totalCalculated}, Skipped: ${totalSkipped}, Errors: ${errors}`);

  } catch (error) {
    log.error(`Error in calculateLogReturns: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate log returns for a single cryptocurrency
 * @param {number} cryptoId - Cryptocurrency ID
 * @param {string} symbol - Cryptocurrency symbol (for logging)
 * @returns {Promise<{inserted: number, skipped: number}>}
 */
async function calculateLogReturnsForCrypto(cryptoId, symbol) {
  // Get daily closing prices ordered by date
  // We use the latest price for each day (at 23:59)
  const [prices] = await Database.execute(`
    SELECT
      DATE(md.timestamp) as date,
      md.price_usd,
      md.timestamp
    FROM market_data md
    WHERE md.crypto_id = ?
      AND md.price_usd > 0
      AND md.timestamp = (
        SELECT MAX(timestamp)
        FROM market_data md2
        WHERE md2.crypto_id = md.crypto_id
          AND DATE(md2.timestamp) = DATE(md.timestamp)
          AND md2.price_usd > 0
      )
    ORDER BY DATE(md.timestamp) ASC
  `, [cryptoId]);

  if (prices.length < 2) {
    log.debug(`${symbol}: Insufficient data (${prices.length} days)`);
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  // Calculate log returns for each consecutive pair of days
  for (let i = 1; i < prices.length; i++) {
    const currentPrice = parseFloat(prices[i].price_usd);
    const previousPrice = parseFloat(prices[i - 1].price_usd);
    const currentDate = prices[i].date;

    // Check if this log return already exists
    const [existing] = await Database.execute(
      'SELECT id FROM crypto_log_returns WHERE crypto_id = ? AND date = ?',
      [cryptoId, currentDate]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Calculate logarithmic return
    const logRet = logReturn(currentPrice, previousPrice);

    // Insert into database
    await Database.execute(`
      INSERT INTO crypto_log_returns
      (crypto_id, date, log_return, price_current, price_previous)
      VALUES (?, ?, ?, ?, ?)
    `, [cryptoId, currentDate, logRet, currentPrice, previousPrice]);

    inserted++;
  }

  if (inserted > 0) {
    log.debug(`${symbol}: Calculated ${inserted} log returns, skipped ${skipped}`);
  }

  return { inserted, skipped };
}

// Run the command
calculateLogReturns()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
