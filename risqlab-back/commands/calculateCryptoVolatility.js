import Database from '../lib/database.js';
import log from '../lib/log.js';
import { mean, standardDeviation, annualizeVolatility } from '../utils/statistics.js';

const DEFAULT_WINDOW_DAYS = 90;

/**
 * Calculate and store individual cryptocurrency volatility
 * Uses a rolling window approach (default: 90 days)
 */
async function calculateCryptoVolatility() {
  const startTime = Date.now();

  try {
    log.info('Starting cryptocurrency volatility calculation...');

    // Get all cryptocurrencies with sufficient log returns data
    const [cryptos] = await Database.execute(`
      SELECT DISTINCT c.id, c.symbol, c.name
      FROM cryptocurrencies c
      INNER JOIN crypto_log_returns clr ON c.id = clr.crypto_id
      GROUP BY c.id, c.symbol, c.name
      HAVING COUNT(*) >= ?
      ORDER BY c.symbol
    `, [DEFAULT_WINDOW_DAYS]);

    log.info(`Found ${cryptos.length} cryptocurrencies with sufficient data (>= ${DEFAULT_WINDOW_DAYS} log returns)`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const crypto of cryptos) {
      try {
        const calculated = await calculateVolatilityForCrypto(crypto.id, crypto.symbol);
        totalCalculated += calculated.inserted;
        totalSkipped += calculated.skipped;
      } catch (error) {
        log.error(`Error calculating volatility for ${crypto.symbol}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`Volatility calculation completed in ${duration}ms`);
    log.info(`Total calculated: ${totalCalculated}, Skipped: ${totalSkipped}, Errors: ${errors}`);

  } catch (error) {
    log.error(`Error in calculateCryptoVolatility: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate volatility for a single cryptocurrency using rolling window
 * @param {number} cryptoId - Cryptocurrency ID
 * @param {string} symbol - Cryptocurrency symbol (for logging)
 * @returns {Promise<{inserted: number, skipped: number}>}
 */
async function calculateVolatilityForCrypto(cryptoId, symbol) {
  // Get all log returns for this crypto, ordered by date
  const [logReturns] = await Database.execute(`
    SELECT
      date,
      log_return
    FROM crypto_log_returns
    WHERE crypto_id = ?
    ORDER BY date ASC
  `, [cryptoId]);

  if (logReturns.length < DEFAULT_WINDOW_DAYS) {
    log.debug(`${symbol}: Insufficient data (${logReturns.length} returns, need ${DEFAULT_WINDOW_DAYS})`);
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  // Calculate volatility for each possible window
  // Start from the first window that has exactly DEFAULT_WINDOW_DAYS returns
  for (let i = DEFAULT_WINDOW_DAYS - 1; i < logReturns.length; i++) {
    const windowEnd = logReturns[i];
    const currentDate = windowEnd.date;

    // Check if volatility already exists for this date
    const [existing] = await Database.execute(
      'SELECT id FROM crypto_volatility WHERE crypto_id = ? AND date = ? AND window_days = ?',
      [cryptoId, currentDate, DEFAULT_WINDOW_DAYS]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Get the window of returns (last DEFAULT_WINDOW_DAYS)
    const windowReturns = logReturns
      .slice(i - DEFAULT_WINDOW_DAYS + 1, i + 1)
      .map(r => parseFloat(r.log_return));

    // Calculate statistics
    const meanReturn = mean(windowReturns);
    const dailyVol = standardDeviation(windowReturns, meanReturn);
    const annualizedVol = annualizeVolatility(dailyVol);

    // Insert into database
    await Database.execute(`
      INSERT INTO crypto_volatility
      (crypto_id, date, window_days, daily_volatility, annualized_volatility, num_observations, mean_return)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [cryptoId, currentDate, DEFAULT_WINDOW_DAYS, dailyVol, annualizedVol, windowReturns.length, meanReturn]);

    inserted++;
  }

  if (inserted > 0) {
    log.debug(`${symbol}: Calculated ${inserted} volatility points, skipped ${skipped}`);
  }

  return { inserted, skipped };
}

// Run the command
calculateCryptoVolatility()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
