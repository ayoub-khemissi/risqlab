import Database from '../lib/database.js';
import log from '../lib/log.js';
import { isExcluded } from '../utils/exclusions.js';

const INDEX_NAME = 'RisqLab 80';
const BASE_LEVEL = 100;
const MAX_CONSTITUENTS = 80;

/**
 * Main function to calculate the RisqLab 80 Index
 * Now supports retroactive calculation for all missing timestamps
 */
async function calculateRisqLab80() {
  const globalStartTime = Date.now();

  try {
    log.info('Starting RisqLab 80 Index calculation...');

    // 1. Get or create index configuration
    const indexConfig = await getOrCreateIndexConfig();
    log.info(`Using index config ID: ${indexConfig.id}, Divisor: ${indexConfig.divisor}`);

    // 2. Find all market data timestamps that don't have an index calculation
    const missingTimestamps = await getMissingIndexTimestamps(indexConfig.id);

    if (missingTimestamps.length === 0) {
      log.info('All market data timestamps already have index calculations. Nothing to do.');
      return;
    }

    log.info(`Found ${missingTimestamps.length} timestamp(s) without index calculation`);

    // 3. Calculate index for each missing timestamp (oldest first)
    let successCount = 0;
    let errorCount = 0;
    const total = missingTimestamps.length;

    for (let i = 0; i < total; i++) {
      const timestamp = missingTimestamps[i];
      const isLast = i === total - 1;
      // Be verbose only for the last calculation (or if single timestamp)
      const verbose = isLast;

      try {
        await calculateIndexForTimestamp(indexConfig, timestamp, verbose);
        successCount++;
      } catch (error) {
        log.error(`Error calculating index for timestamp ${timestamp}: ${error.message}`);
        errorCount++;
      }
    }

    const totalDuration = Date.now() - globalStartTime;
    log.info(`Index calculation completed in ${totalDuration}ms`);
    log.info(`Results: ${successCount} successful, ${errorCount} failed out of ${missingTimestamps.length} timestamps`);

  } catch (error) {
    log.error(`Error calculating RisqLab 80 Index: ${error.message}`);
    throw error;
  }
}

/**
 * Get all market data timestamps that don't have a corresponding index calculation
 */
async function getMissingIndexTimestamps(indexConfigId) {
  const [rows] = await Database.execute(`
    SELECT DISTINCT md.timestamp
    FROM market_data md
    WHERE md.timestamp NOT IN (
      SELECT ih.timestamp
      FROM index_history ih
      WHERE ih.index_config_id = ?
    )
    ORDER BY md.timestamp ASC
  `, [indexConfigId]);

  return rows.map(row => row.timestamp);
}

/**
 * Calculate the index for a specific timestamp
 * @param {boolean} verbose - Whether to log detailed information
 */
async function calculateIndexForTimestamp(indexConfig, timestamp, verbose = false) {
  const startTime = Date.now();

  log.info(`Calculating index for timestamp: ${timestamp}`);

  // Get market data for this specific timestamp
  const marketData = await getMarketDataForTimestamp(timestamp);

  if (marketData.length === 0) {
    throw new Error(`No market data found for timestamp ${timestamp}`);
  }

  // Filter out excluded symbols and select top 80 by market cap
  const constituents = selectConstituents(marketData, verbose);

  if (constituents.length === 0) {
    throw new Error(`No valid constituents found for timestamp ${timestamp}`);
  }

  // Calculate total market capitalization
  const totalMarketCap = constituents.reduce(
    (sum, c) => sum + (parseFloat(c.price_usd) * parseFloat(c.circulating_supply)),
    0
  );

  // Calculate index level
  const indexLevel = totalMarketCap / parseFloat(indexConfig.divisor);

  // Calculate duration
  const calculationDuration = Date.now() - startTime;

  // Store index history
  const indexHistoryId = await storeIndexHistory(
    indexConfig.id,
    timestamp,
    totalMarketCap,
    indexLevel,
    indexConfig.divisor,
    constituents.length,
    calculationDuration
  );

  // Store constituents
  await storeConstituents(indexHistoryId, constituents, totalMarketCap, verbose);

  log.info(`  -> Index Level: ${indexLevel.toFixed(8)} | Constituents: ${constituents.length} | Market Cap: $${(totalMarketCap / 1e9).toFixed(2)}B (${calculationDuration}ms)`);
}

/**
 * Get existing index configuration or calculate divisor if needed
 */
async function getOrCreateIndexConfig() {
  // Try to get active index config
  const [rows] = await Database.execute(
    'SELECT * FROM index_config WHERE index_name = ? AND is_active = TRUE LIMIT 1',
    [INDEX_NAME]
  );

  // Get initial market data to calculate divisor
  const marketData = await getMostRecentMarketData();
  const constituents = selectConstituents(marketData, true);

  if (constituents.length === 0) {
    throw new Error('Cannot initialize index: no valid constituents found. Please run fetch-crypto-data first.');
  }

  const currentMarketCap = constituents.reduce((sum, c) => sum + (parseFloat(c.price_usd) * parseFloat(c.circulating_supply)), 0);
  const calculatedDivisor = currentMarketCap / BASE_LEVEL;

  // If index config exists
  if (rows.length > 0) {
    const config = rows[0];

    // Check if divisor needs to be initialized (still at default value of 1.0)
    if (parseFloat(config.divisor) === 1.0) {
      log.info('Divisor not yet calculated, initializing with current market data...');

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await Database.execute(
        `UPDATE index_config
         SET divisor = ?, base_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [calculatedDivisor, now, config.id]
      );

      log.info(`Initialized divisor: ${calculatedDivisor}`);
      log.info(`Base market cap: $${(currentMarketCap / 1e9).toFixed(2)}B`);
      log.info(`Base date: ${now}`);

      return {
        ...config,
        divisor: calculatedDivisor,
        base_date: now,
      };
    }

    return config;
  }

  // Create new index config if doesn't exist
  log.info('No active index config found, creating new one...');

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const [result] = await Database.execute(
    `INSERT INTO index_config
    (index_name, base_level, divisor, base_date, max_constituents, is_active)
    VALUES (?, ?, ?, ?, ?, TRUE)`,
    [INDEX_NAME, BASE_LEVEL, calculatedDivisor, now, MAX_CONSTITUENTS]
  );

  log.info(`Created new index config with divisor: ${calculatedDivisor}`);
  log.info(`Initial market cap: $${(currentMarketCap / 1e9).toFixed(2)}B`);

  return {
    id: result.insertId,
    index_name: INDEX_NAME,
    base_level: BASE_LEVEL,
    divisor: calculatedDivisor,
    base_date: now,
    max_constituents: MAX_CONSTITUENTS,
    is_active: true,
  };
}

/**
 * Get market data for a specific timestamp with metadata
 */
async function getMarketDataForTimestamp(timestamp) {
  const [rows] = await Database.execute(`
    SELECT
      md.id as market_data_id,
      md.crypto_id,
      c.symbol,
      c.name,
      md.price_usd,
      md.circulating_supply,
      md.volume_24h_usd,
      (md.price_usd * md.circulating_supply) as market_cap_usd,
      md.percent_change_24h,
      md.percent_change_7d,
      md.timestamp,
      COALESCE(cm.is_stablecoin, 0) as is_stablecoin,
      COALESCE(cm.is_wrapped, 0) as is_wrapped,
      COALESCE(cm.is_liquid_staking, 0) as is_liquid_staking
    FROM market_data md
    INNER JOIN cryptocurrencies c ON md.crypto_id = c.id
    LEFT JOIN cryptocurrency_metadata cm ON c.id = cm.crypto_id
    WHERE md.timestamp = ?
      AND (md.price_usd * md.circulating_supply) > 0
    ORDER BY (md.price_usd * md.circulating_supply) DESC
  `, [timestamp]);

  return rows;
}

/**
 * Get the most recent market data (used for initial divisor calculation)
 */
async function getMostRecentMarketData() {
  const [rows] = await Database.execute(`
    SELECT
      md.id as market_data_id,
      md.crypto_id,
      c.symbol,
      c.name,
      md.price_usd,
      md.circulating_supply,
      md.volume_24h_usd,
      (md.price_usd * md.circulating_supply) as market_cap_usd,
      md.percent_change_24h,
      md.percent_change_7d,
      md.timestamp,
      COALESCE(cm.is_stablecoin, 0) as is_stablecoin,
      COALESCE(cm.is_wrapped, 0) as is_wrapped,
      COALESCE(cm.is_liquid_staking, 0) as is_liquid_staking
    FROM market_data md
    INNER JOIN cryptocurrencies c ON md.crypto_id = c.id
    LEFT JOIN cryptocurrency_metadata cm ON c.id = cm.crypto_id
    WHERE md.timestamp = (SELECT MAX(timestamp) FROM market_data)
      AND (md.price_usd * md.circulating_supply) > 0
    ORDER BY (md.price_usd * md.circulating_supply) DESC
  `);

  return rows;
}

/**
 * Select top constituents after filtering exclusions
 * @param {boolean} verbose - Whether to log detailed information
 */
function selectConstituents(marketData, verbose = false) {
  // Filter out excluded symbols using metadata-aware function
  const filtered = marketData.filter(crypto => !isExcluded(crypto));

  if (verbose) {
    const excludedCount = marketData.length - filtered.length;
    log.info(`Filtered out ${excludedCount} excluded symbols (stablecoins, wrapped, liquid staking)`);

    // Log some examples of excluded cryptos for debugging
    const excluded = marketData.filter(crypto => isExcluded(crypto)).slice(0, 10);
    if (excluded.length > 0) {
      log.debug('Examples of excluded cryptos:');
      excluded.forEach(crypto => {
        const reasons = [];
        if (crypto.is_stablecoin) reasons.push('stablecoin');
        if (crypto.is_wrapped) reasons.push('wrapped');
        if (crypto.is_liquid_staking) reasons.push('liquid-staking');
        log.debug(`  - ${crypto.symbol}: ${reasons.join(', ')}`);
      });
    }
  }

  // Select top MAX_CONSTITUENTS by market cap
  const selected = filtered.slice(0, MAX_CONSTITUENTS);

  return selected;
}

/**
 * Store index history record
 */
async function storeIndexHistory(
  indexConfigId,
  timestamp,
  totalMarketCap,
  indexLevel,
  divisor,
  numberOfConstituents,
  calculationDuration
) {
  const [result] = await Database.execute(
    `INSERT INTO index_history
    (index_config_id, timestamp, total_market_cap_usd, index_level, divisor, number_of_constituents, calculation_duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    total_market_cap_usd = VALUES(total_market_cap_usd),
    index_level = VALUES(index_level),
    divisor = VALUES(divisor),
    number_of_constituents = VALUES(number_of_constituents),
    calculation_duration_ms = VALUES(calculation_duration_ms)`,
    [indexConfigId, timestamp, totalMarketCap, indexLevel, divisor, numberOfConstituents, calculationDuration]
  );

  // Get the index_history_id (either inserted or existing)
  if (result.insertId > 0) {
    return result.insertId;
  }

  // If it was an update (duplicate key), retrieve the ID
  const [rows] = await Database.execute(
    'SELECT id FROM index_history WHERE index_config_id = ? AND timestamp = ?',
    [indexConfigId, timestamp]
  );

  return rows[0].id;
}

/**
 * Store index constituents
 * @param {boolean} verbose - Whether to log detailed information
 */
async function storeConstituents(indexHistoryId, constituents, totalMarketCap, verbose = false) {
  // Delete existing constituents for this index history (in case of recalculation)
  await Database.execute(
    'DELETE FROM index_constituents WHERE index_history_id = ?',
    [indexHistoryId]
  );

  // Insert new constituents
  for (let i = 0; i < constituents.length; i++) {
    const crypto = constituents[i];
    const marketCap = parseFloat(crypto.price_usd) * parseFloat(crypto.circulating_supply);
    const weight = (marketCap / totalMarketCap) * 100;

    await Database.execute(
      `INSERT INTO index_constituents
      (index_history_id, crypto_id, market_data_id, rank_position, price_usd,
       circulating_supply, weight_in_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        indexHistoryId,
        crypto.crypto_id,
        crypto.market_data_id,
        i + 1, // rank_position (1-based)
        crypto.price_usd,
        crypto.circulating_supply,
        weight,
      ]
    );
  }

  if (verbose) {
    log.info(`Stored ${constituents.length} constituents`);

    // Log top 10 constituents
    log.info('Top 10 constituents:');
    for (let i = 0; i < Math.min(10, constituents.length); i++) {
      const crypto = constituents[i];
      const marketCap = parseFloat(crypto.price_usd) * parseFloat(crypto.circulating_supply);
      const weight = (marketCap / totalMarketCap) * 100;
      log.info(`  ${i + 1}. ${crypto.symbol} (${crypto.name}) - Weight: ${weight.toFixed(2)}%`);
    }
  }
}

// Run the command
calculateRisqLab80()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
