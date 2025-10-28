import Database from '../lib/database.js';
import log from '../lib/log.js';
import {
  buildCovarianceMatrix,
  portfolioVolatility,
  annualizeVolatility,
  validateWeights
} from '../utils/statistics.js';

const DEFAULT_WINDOW_DAYS = 90;
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

    // Get dates where we have index history
    const [indexDates] = await Database.execute(`
      SELECT DISTINCT DATE(timestamp) as date, timestamp
      FROM index_history
      WHERE index_config_id = ?
      ORDER BY timestamp DESC
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

  // Check if already calculated
  const [existing] = await Database.execute(
    'SELECT id FROM portfolio_volatility WHERE index_config_id = ? AND date = ? AND window_days = ?',
    [indexConfigId, date, DEFAULT_WINDOW_DAYS]
  );

  if (existing.length > 0) {
    return { calculated: false };
  }

  // Get constituents for this date
  const constituents = await getConstituentsForDate(indexConfigId, timestamp);

  if (constituents.length === 0) {
    log.debug(`No constituents found for ${date}`);
    return { calculated: false };
  }

  log.debug(`${date}: Processing ${constituents.length} constituents`);

  // Get log returns for all constituents over the window period
  const constituentReturns = await getConstituentReturns(constituents, date);

  // Filter out constituents with insufficient data
  const validConstituents = constituentReturns.filter(
    c => c.returns.length >= DEFAULT_WINDOW_DAYS
  );

  if (validConstituents.length < 10) {
    log.debug(`${date}: Insufficient data - only ${validConstituents.length} constituents with enough returns`);
    return { calculated: false };
  }

  // Calculate total market cap and weights
  const totalMarketCap = validConstituents.reduce((sum, c) => sum + c.marketCap, 0);
  const weights = validConstituents.map(c => c.marketCap / totalMarketCap);

  // Validate weights
  if (!validateWeights(weights)) {
    log.warn(`${date}: Invalid weights (sum = ${weights.reduce((a, b) => a + b, 0)})`);
  }

  // Build covariance matrix
  const assets = validConstituents.map((c, i) => ({
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
    DEFAULT_WINDOW_DAYS,
    dailyVol,
    annualizedVol,
    validConstituents.length,
    totalMarketCap,
    calculationDuration
  ]);

  const portfolioVolatilityId = result.insertId;

  // Store constituent details
  await storeConstituentVolatilities(portfolioVolatilityId, validConstituents, weights);

  log.info(`${date}: Portfolio volatility = ${(annualizedVol * 100).toFixed(2)}% (${validConstituents.length} constituents)`);

  return { calculated: true };
}

/**
 * Get index constituents for a specific date
 */
async function getConstituentsForDate(indexConfigId, timestamp) {
  const [rows] = await Database.execute(`
    SELECT
      ic.crypto_id,
      c.symbol,
      c.name,
      ic.price_usd,
      ic.circulating_supply,
      (ic.price_usd * ic.circulating_supply) as market_cap_usd
    FROM index_constituents ic
    INNER JOIN index_history ih ON ic.index_history_id = ih.id
    INNER JOIN cryptocurrencies c ON ic.crypto_id = c.id
    WHERE ih.index_config_id = ?
      AND ih.timestamp = ?
    ORDER BY ic.rank_position ASC
  `, [indexConfigId, timestamp]);

  return rows.map(row => ({
    crypto_id: row.crypto_id,
    symbol: row.symbol,
    name: row.name,
    marketCap: parseFloat(row.market_cap_usd)
  }));
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
