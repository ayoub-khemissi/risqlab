import Database from '../lib/database.js';
import log from '../lib/log.js';
import {
  buildCovarianceMatrix,
  portfolioVolatility,
  annualizeVolatility,
  validateWeights
} from '../utils/statistics.js';

const DEFAULT_WINDOW_DAYS = 90;
const MINIMUM_WINDOW_DAYS = 7; // Minimum days for statistical validity
const INDEX_NAME = 'RisqLab 80';

/**
 * Calculate and store portfolio volatility for the RisqLab 80 Index
 * Uses market cap weighted approach with full covariance matrix
 */
async function calculatePortfolioVolatility() {
  const startTime = Date.now();

  try {
    log.info('Starting portfolio volatility calculation...');

    // Get active index configuration
    const indexConfig = await getIndexConfig();
    log.info(`Using index config ID: ${indexConfig.id}`);

    // Get dates where we have index history (one row per day, with latest timestamp)
    const [indexDates] = await Database.execute(`
      SELECT snapshot_date as date, MAX(timestamp) as timestamp
      FROM index_history
      WHERE index_config_id = ?
      GROUP BY snapshot_date
      ORDER BY snapshot_date DESC
      LIMIT 100
    `, [indexConfig.id]);

    log.info(`Found ${indexDates.length} index calculation dates`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const dateRow of indexDates) {
      try {
        const result = await calculatePortfolioVolatilityForDate(
          indexConfig.id,
          dateRow.date,
          dateRow.timestamp
        );

        if (result.calculated) {
          totalCalculated++;
        } else {
          totalSkipped++;
        }
      } catch (error) {
        log.error(`Error calculating portfolio volatility for ${dateRow.date}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`Portfolio volatility calculation completed in ${duration}ms`);
    log.info(`Total calculated: ${totalCalculated}, Skipped: ${totalSkipped}, Errors: ${errors}`);

  } catch (error) {
    log.error(`Error in calculatePortfolioVolatility: ${error.message}`);
    throw error;
  }
}

/**
 * Get the active index configuration
 */
async function getIndexConfig() {
  const [rows] = await Database.execute(
    'SELECT * FROM index_config WHERE index_name = ? AND is_active = TRUE LIMIT 1',
    [INDEX_NAME]
  );

  if (rows.length === 0) {
    throw new Error('No active index configuration found');
  }

  return rows[0];
}

/**
 * Calculate portfolio volatility for a specific date
 * @param {number} indexConfigId - Index configuration ID
 * @param {string} date - Date for calculation
 * @param {string} timestamp - Full timestamp from index history
 * @returns {Promise<{calculated: boolean}>}
 */
async function calculatePortfolioVolatilityForDate(indexConfigId, date, timestamp) {
  const calcStartTime = Date.now();

  // We'll determine the actual window days after checking constituent data
  // For now, just check if any calculation exists for this date
  const [existing] = await Database.execute(
    'SELECT id FROM portfolio_volatility WHERE index_config_id = ? AND date = ?',
    [indexConfigId, date]
  );

  if (existing.length > 0) {
    return { calculated: false };
  }

  // Get constituents for this date (uses market_data for price/market cap)
  const constituents = await getConstituentsForDate(indexConfigId, timestamp, date);

  if (constituents.length === 0) {
    log.debug(`No constituents found for ${date}`);
    return { calculated: false };
  }

  log.debug(`${date}: Processing ${constituents.length} constituents`);

  // Get log returns for all constituents over the window period
  const constituentReturns = await getConstituentReturns(constituents, date);

  // Filter out constituents with insufficient data (minimum required)
  const validConstituents = constituentReturns.filter(
    c => c.returns.length >= MINIMUM_WINDOW_DAYS
  );

  if (validConstituents.length < 10) {
    log.debug(`${date}: Insufficient data - only ${validConstituents.length} constituents with at least ${MINIMUM_WINDOW_DAYS} returns`);
    return { calculated: false };
  }

  // Find the minimum number of days available across all constituents
  const minAvailableDays = Math.min(...validConstituents.map(c => c.returns.length));
  const effectiveWindowDays = Math.min(minAvailableDays, DEFAULT_WINDOW_DAYS);

  log.debug(`${date}: Using ${effectiveWindowDays} days window (min available: ${minAvailableDays})`);

  // Truncate all constituents' returns to the same window size
  const normalizedConstituents = validConstituents.map(c => ({
    ...c,
    returns: c.returns.slice(-effectiveWindowDays) // Take last N days
  }));

  // Calculate total market cap and weights
  const totalMarketCap = normalizedConstituents.reduce((sum, c) => sum + c.marketCap, 0);
  const weights = normalizedConstituents.map(c => c.marketCap / totalMarketCap);

  // Validate weights
  if (!validateWeights(weights)) {
    log.warn(`${date}: Invalid weights (sum = ${weights.reduce((a, b) => a + b, 0)})`);
  }

  // Build covariance matrix
  const assets = normalizedConstituents.map((c, i) => ({
    id: c.crypto_id,
    returns: c.returns
  }));

  const covMatrix = buildCovarianceMatrix(assets);

  // Calculate portfolio volatility
  const dailyVol = portfolioVolatility(weights, covMatrix);
  const annualizedVol = annualizeVolatility(dailyVol);

  const calculationDuration = Date.now() - calcStartTime;

  // Store portfolio volatility
  const [result] = await Database.execute(`
    INSERT INTO portfolio_volatility
    (index_config_id, date, window_days, daily_volatility, annualized_volatility,
     num_constituents, total_market_cap_usd, calculation_duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    indexConfigId,
    date,
    effectiveWindowDays,
    dailyVol,
    annualizedVol,
    normalizedConstituents.length,
    totalMarketCap,
    calculationDuration
  ]);

  const portfolioVolatilityId = result.insertId;

  // Store constituent details
  await storeConstituentVolatilities(portfolioVolatilityId, normalizedConstituents, weights);

  log.info(`${date}: Portfolio volatility = ${(annualizedVol * 100).toFixed(2)}% (${normalizedConstituents.length} constituents, ${effectiveWindowDays} days window)`);

  return { calculated: true };
}

/**
 * Get index constituents for a specific date
 * Uses market_data for price/market cap (last price of the day) for consistency
 */
async function getConstituentsForDate(indexConfigId, timestamp, date) {
  // Get the list of constituents from index_constituents
  const [constituents] = await Database.execute(`
    SELECT
      ic.crypto_id,
      c.symbol,
      c.name
    FROM index_constituents ic
    INNER JOIN index_history ih ON ic.index_history_id = ih.id
    INNER JOIN cryptocurrencies c ON ic.crypto_id = c.id
    WHERE ih.index_config_id = ?
      AND ih.timestamp = ?
    ORDER BY ic.rank_position ASC
  `, [indexConfigId, timestamp]);

  if (constituents.length === 0) {
    return [];
  }

  const cryptoIds = constituents.map(c => c.crypto_id);

  // Get the last price of the day from market_data for each constituent
  const [marketData] = await Database.execute(`
    SELECT
      md.crypto_id,
      md.price_usd,
      md.circulating_supply,
      (md.price_usd * md.circulating_supply) as market_cap_usd
    FROM market_data md
    WHERE md.crypto_id IN (${cryptoIds.join(',')})
      AND md.price_date = ?
      AND md.timestamp = (
        SELECT MAX(md2.timestamp)
        FROM market_data md2
        WHERE md2.crypto_id = md.crypto_id
          AND md2.price_date = md.price_date
      )
  `, [date]);

  // Build a map of crypto_id -> market data
  const marketDataMap = new Map();
  for (const row of marketData) {
    marketDataMap.set(row.crypto_id, row);
  }

  // Combine constituents with their market data
  return constituents
    .filter(c => marketDataMap.has(c.crypto_id))
    .map(c => {
      const md = marketDataMap.get(c.crypto_id);
      return {
        crypto_id: c.crypto_id,
        symbol: c.symbol,
        name: c.name,
        marketCap: parseFloat(md.market_cap_usd)
      };
    });
}

/**
 * Get log returns for all constituents over the window period
 */
async function getConstituentReturns(constituents, endDate) {
  const results = [];

  for (const constituent of constituents) {
    // Get log returns for the last DEFAULT_WINDOW_DAYS before endDate
    const [returns] = await Database.execute(`
      SELECT log_return
      FROM crypto_log_returns
      WHERE crypto_id = ?
        AND date <= ?
      ORDER BY date DESC
      LIMIT ${DEFAULT_WINDOW_DAYS}
    `, [constituent.crypto_id, endDate]);

    // Reverse to get chronological order
    const returnsArray = returns.map(r => parseFloat(r.log_return)).reverse();

    results.push({
      crypto_id: constituent.crypto_id,
      symbol: constituent.symbol,
      marketCap: constituent.marketCap,
      returns: returnsArray
    });
  }

  return results;
}

/**
 * Store individual constituent volatilities
 */
async function storeConstituentVolatilities(portfolioVolatilityId, constituents, weights) {
  for (let i = 0; i < constituents.length; i++) {
    const constituent = constituents[i];
    const weight = weights[i];

    // Calculate individual volatility from returns
    const returns = constituent.returns;
    const variance = returns.reduce((sum, r) => {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      return sum + Math.pow(r - mean, 2);
    }, 0) / returns.length;

    const dailyVol = Math.sqrt(variance);
    const annualizedVol = annualizeVolatility(dailyVol);

    await Database.execute(`
      INSERT INTO portfolio_volatility_constituents
      (portfolio_volatility_id, crypto_id, weight, daily_volatility,
       annualized_volatility, market_cap_usd)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      portfolioVolatilityId,
      constituent.crypto_id,
      weight,
      dailyVol,
      annualizedVol,
      constituent.marketCap
    ]);
  }
}

// Run the command
calculatePortfolioVolatility()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
