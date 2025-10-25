import Database from '../lib/database.js';
import log from '../lib/log.js';
import { isExcluded } from '../utils/exclusions.js';

const INDEX_NAME = 'RisqLab 80';
const BASE_LEVEL = 100;
const MAX_CONSTITUENTS = 80;

/**
 * Main function to calculate the RisqLab 80 Index
 */
async function calculateRisqLab80() {
  const startTime = Date.now();

  try {
    log.info('Starting RisqLab 80 Index calculation...');

    // 1. Get or create index configuration
    const indexConfig = await getOrCreateIndexConfig();
    log.info(`Using index config ID: ${indexConfig.id}, Divisor: ${indexConfig.divisor}`);

    // 2. Get the most recent market data for each cryptocurrency
    const marketData = await getMostRecentMarketData();
    log.info(`Retrieved ${marketData.length} cryptocurrencies with market data`);

    // 3. Filter out excluded symbols and select top 80 by market cap
    const constituents = selectConstituents(marketData);
    log.info(`Selected ${constituents.length} constituents after filtering`);

    if (constituents.length === 0) {
      throw new Error('No valid constituents found for index calculation');
    }

    // 4. Calculate total market capitalization
    const totalMarketCap = constituents.reduce((sum, c) => sum + (parseFloat(c.price_usd) * parseFloat(c.circulating_supply)), 0);
    log.info(`Total market cap: $${(totalMarketCap / 1e9).toFixed(2)}B`);

    // 5. Calculate index level
    const indexLevel = totalMarketCap / parseFloat(indexConfig.divisor);
    log.info(`Index Level: ${indexLevel.toFixed(8)}`);

    // 6. Get timestamp from the latest market data
    const timestamp = constituents[0].timestamp;

    // 7. Calculate duration before storing (to store it in DB)
    const calculationDuration = Date.now() - startTime;

    // 8. Store index history
    const indexHistoryId = await storeIndexHistory(
      indexConfig.id,
      timestamp,
      totalMarketCap,
      indexLevel,
      indexConfig.divisor,
      constituents.length,
      calculationDuration
    );

    // 9. Store constituents
    await storeConstituents(indexHistoryId, constituents, totalMarketCap);

    log.info(`Index calculation completed successfully in ${calculationDuration}ms`);
    log.info(`Index Level: ${indexLevel.toFixed(8)} | Constituents: ${constituents.length} | Market Cap: $${(totalMarketCap / 1e9).toFixed(2)}B`);

  } catch (error) {
    log.error(`Error calculating RisqLab 80 Index: ${error.message}`);
    throw error;
  }
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
  const constituents = selectConstituents(marketData);

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
    (index_name, base_level, divisor, base_date, max_constituents, update_frequency_minutes, is_active)
    VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
    [INDEX_NAME, BASE_LEVEL, calculatedDivisor, now, MAX_CONSTITUENTS, 30]
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
    update_frequency_minutes: 30,
    is_active: true,
  };
}

/**
 * Get the most recent market data for each cryptocurrency with metadata
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
    INNER JOIN (
      SELECT crypto_id, MAX(timestamp) as max_timestamp
      FROM market_data
      GROUP BY crypto_id
    ) latest ON md.crypto_id = latest.crypto_id AND md.timestamp = latest.max_timestamp
    WHERE (md.price_usd * md.circulating_supply) > 0
    ORDER BY (md.price_usd * md.circulating_supply) DESC
  `);

  return rows;
}

/**
 * Select top constituents after filtering exclusions
 */
function selectConstituents(marketData) {
  // Filter out excluded symbols using metadata-aware function
  const filtered = marketData.filter(crypto => !isExcluded(crypto));

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
 */
async function storeConstituents(indexHistoryId, constituents, totalMarketCap) {
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
