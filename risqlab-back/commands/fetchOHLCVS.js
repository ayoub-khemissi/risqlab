import config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

// Configuration for each granularity
const GRANULARITY_CONFIG = {
  daily: {
    unit: 'DAY',
    lookbackDays: 365,
    endpoint: Constants.COINDESK_OHLCVS_DAILY,
    // For daily: generate timestamps for each day
    getTimestamps: (lookbackDays) => {
      const timestamps = [];
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);

      // Start from yesterday (D-1) going back lookbackDays
      for (let i = 1; i <= lookbackDays; i++) {
        const date = new Date(now);
        date.setUTCDate(now.getUTCDate() - i);
        timestamps.push(date);
      }
      return timestamps;
    },
    formatTimestamp: (date) => formatDateTimeString(date, false), // YYYY-MM-DD 00:00:00
  },
  hourly: {
    unit: 'HOUR',
    lookbackDays: 90,
    endpoint: Constants.COINDESK_OHLCVS_HOURLY,
    // For hourly: generate timestamps for each hour
    getTimestamps: (lookbackDays) => {
      const timestamps = [];
      const now = new Date();
      // Round down to current hour
      now.setUTCMinutes(0, 0, 0);

      const totalHours = lookbackDays * 24;
      // Start from H-1 (previous hour) going back
      for (let i = 1; i <= totalHours; i++) {
        const date = new Date(now);
        date.setUTCHours(now.getUTCHours() - i);
        timestamps.push(date);
      }
      return timestamps;
    },
    formatTimestamp: (date) => formatDateTimeString(date, true), // YYYY-MM-DD HH:00:00
  },
};

const API_DELAY_MS = 100; // Rate limiting: 10 req/sec (under the 20/sec limit)

/**
 * Main function to fetch OHLCVS (OHLCV + Supply) data
 * from CoinDesk Data API and store it in the database.
 * @param {string} granularity - 'daily' or 'hourly'
 */
async function fetchOHLCVS(granularity) {
  const startTime = Date.now();
  const cfg = GRANULARITY_CONFIG[granularity];

  if (!cfg) {
    throw new Error(`Invalid granularity: ${granularity}. Use 'daily' or 'hourly'.`);
  }

  try {
    log.info(`Starting OHLCVS data fetch (${granularity.toUpperCase()})...`);
    log.info(`Lookback: ${cfg.lookbackDays} days, Unit: ${cfg.unit}`);

    // Validate API key
    if (!config.COINDESK_API_KEY) {
      throw new Error('COINDESK_API_KEY is not configured');
    }

    // Get all cryptocurrencies from database
    const [cryptos] = await Database.execute(`
      SELECT id, symbol FROM cryptocurrencies ORDER BY symbol
    `);

    log.info(`Found ${cryptos.length} cryptocurrencies to process`);

    let totalInserted = 0;
    let totalSkipped = 0;
    let totalApiErrors = 0;
    let totalSupplyUpdated = 0;
    let totalProcessed = 0;

    for (const crypto of cryptos) {
      try {
        const result = await processOHLCVSForCrypto(crypto.id, crypto.symbol, cfg);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
        totalSupplyUpdated += result.supplyUpdated;

        if (result.apiError) {
          totalApiErrors++;
        }

        totalProcessed++;

        // Rate limiting delay between API calls
        if (result.apiCalled) {
          await delay(API_DELAY_MS);
        }
      } catch (error) {
        log.error(`Error processing OHLCVS for ${crypto.symbol}: ${error.message}`);
        totalApiErrors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`OHLCVS fetch (${granularity}) completed in ${(duration / 1000).toFixed(2)}s`);
    log.info(`Processed: ${totalProcessed}, Inserted: ${totalInserted}, Skipped: ${totalSkipped}, Supply Updated: ${totalSupplyUpdated}, API Errors: ${totalApiErrors}`);

  } catch (error) {
    log.error(`Error in fetchOHLCVS: ${error.message}`);
    throw error;
  }
}

/**
 * Process OHLCVS data for a single cryptocurrency
 * @param {number} cryptoId - Cryptocurrency ID
 * @param {string} symbol - Cryptocurrency symbol (e.g., BTC, ETH)
 * @param {Object} cfg - Granularity configuration
 * @returns {Promise<{inserted: number, skipped: number, supplyUpdated: number, apiError: boolean, apiCalled: boolean}>}
 */
async function processOHLCVSForCrypto(cryptoId, symbol, cfg) {
  // Get missing timestamps for this crypto
  const missingTimestamps = await getMissingTimestamps(cryptoId, cfg);

  if (missingTimestamps.length === 0) {
    log.debug(`${symbol}: No missing timestamps for ${cfg.unit}, skipping`);

    // For daily data, still check if we need to update supply
    if (cfg.unit === 'DAY') {
      const supplyUpdated = await updateSupplyForCrypto(cryptoId, symbol, cfg.lookbackDays);
      return { inserted: 0, skipped: 1, supplyUpdated, apiError: false, apiCalled: supplyUpdated > 0 };
    }

    return { inserted: 0, skipped: 1, supplyUpdated: 0, apiError: false, apiCalled: false };
  }

  log.debug(`${symbol}: Found ${missingTimestamps.length} missing timestamp(s) for ${cfg.unit}`);

  // Fetch OHLCV data from CoinDesk API
  const instrument = `${symbol}-USD`;
  const { data: ohlcvsData, error: apiError } = await fetchOHLCVFromAPI(instrument, cfg);

  if (apiError) {
    log.warn(`${symbol}: API error - ${apiError}. Inserting placeholder records with zeros.`);
  }

  // Map API data by timestamp for quick lookup
  const dataByTimestamp = new Map();
  if (ohlcvsData && Array.isArray(ohlcvsData)) {
    for (const item of ohlcvsData) {
      const ts = unixToDateTimeString(item.TIMESTAMP, cfg.unit === 'HOUR');
      dataByTimestamp.set(ts, item);
    }
  }

  // Insert data for all missing timestamps
  let inserted = 0;
  for (const timestamp of missingTimestamps) {
    const tsString = cfg.formatTimestamp(timestamp);
    const apiData = dataByTimestamp.get(tsString);
    await insertOHLCVSRecord(cryptoId, cfg.unit, tsString, apiData);
    inserted++;
  }

  if (inserted > 0) {
    log.debug(`${symbol}: Inserted ${inserted} OHLCVS record(s) for ${cfg.unit}`);
  }

  // For daily data, also fetch and update supply data
  let supplyUpdated = 0;
  if (cfg.unit === 'DAY') {
    await delay(API_DELAY_MS); // Rate limiting before supply API call
    supplyUpdated = await updateSupplyForCrypto(cryptoId, symbol, cfg.lookbackDays);
  }

  return { inserted, skipped: 0, supplyUpdated, apiError: !!apiError, apiCalled: true };
}

/**
 * Update supply data for a cryptocurrency (daily only)
 * @param {number} cryptoId - Cryptocurrency ID
 * @param {string} symbol - Cryptocurrency symbol
 * @param {number} lookbackDays - Number of days to look back
 * @returns {Promise<number>} Number of records updated
 */
async function updateSupplyForCrypto(cryptoId, symbol, lookbackDays) {
  // Get ohlcvs records that need supply update (where supply_circulating = 0)
  const [recordsToUpdate] = await Database.execute(`
    SELECT id, DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s') as ts
    FROM ohlcvs
    WHERE crypto_id = ?
      AND unit = 'DAY'
      AND supply_circulating = 0
      AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
    ORDER BY timestamp
  `, [cryptoId, lookbackDays]);

  if (recordsToUpdate.length === 0) {
    return 0;
  }

  log.debug(`${symbol}: Found ${recordsToUpdate.length} record(s) needing supply update`);

  // Fetch supply data from CoinDesk API
  const { data: supplyData, error: apiError } = await fetchSupplyFromAPI(symbol, lookbackDays);

  if (apiError) {
    log.warn(`${symbol}: Supply API error - ${apiError}`);
    return 0;
  }

  if (!supplyData || supplyData.length === 0) {
    log.warn(`${symbol}: No supply data returned from API`);
    return 0;
  }

  // Map API data by timestamp for quick lookup
  const dataByTimestamp = new Map();
  for (const item of supplyData) {
    const ts = unixToDateTimeString(item.TIMESTAMP, false);
    dataByTimestamp.set(ts, item);
  }

  // Update records with all supply fields
  let updated = 0;
  for (const record of recordsToUpdate) {
    const apiData = dataByTimestamp.get(record.ts);
    if (apiData && apiData.SUPPLY_CIRCULATING > 0) {
      await Database.execute(`
        UPDATE ohlcvs
        SET supply_circulating = ?,
            supply_total = ?,
            supply_burnt = ?,
            supply_max = ?,
            supply_staked = ?,
            supply_future = ?,
            supply_issued = ?,
            supply_locked = ?
        WHERE id = ?
      `, [
        apiData.SUPPLY_CIRCULATING || 0,
        apiData.SUPPLY_TOTAL || 0,
        apiData.SUPPLY_BURNT || 0,
        apiData.SUPPLY_MAX ?? -1,
        apiData.SUPPLY_STAKED || 0,
        apiData.SUPPLY_FUTURE ?? -1,
        apiData.SUPPLY_ISSUED || 0,
        apiData.SUPPLY_LOCKED || 0,
        record.id,
      ]);
      updated++;
    }
  }

  if (updated > 0) {
    log.debug(`${symbol}: Updated ${updated} record(s) with supply data`);
  }

  return updated;
}

/**
 * Get timestamps missing from the ohlcvs table for a cryptocurrency
 * @param {number} cryptoId - Cryptocurrency ID
 * @param {Object} cfg - Granularity configuration
 * @returns {Promise<Date[]>} Array of Date objects
 */
async function getMissingTimestamps(cryptoId, cfg) {
  // Generate all expected timestamps
  const allTimestamps = cfg.getTimestamps(cfg.lookbackDays);

  // Get existing timestamps from database
  const [existingRows] = await Database.execute(`
    SELECT DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s') as ts
    FROM ohlcvs
    WHERE crypto_id = ?
      AND unit = ?
      AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
  `, [cryptoId, cfg.unit, cfg.lookbackDays]);

  const existingSet = new Set(existingRows.map(row => row.ts));

  // Return timestamps that don't exist in database
  return allTimestamps.filter(ts => !existingSet.has(cfg.formatTimestamp(ts)));
}

/**
 * Fetch OHLCV data from CoinDesk Data API
 * @param {string} instrument - Trading pair (e.g., BTC-USD)
 * @param {Object} cfg - Granularity configuration
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
async function fetchOHLCVFromAPI(instrument, cfg) {
  const now = Math.floor(Date.now() / 1000);

  // Calculate limit based on granularity
  const limit = cfg.unit === 'HOUR'
    ? cfg.lookbackDays * 24  // hours
    : cfg.lookbackDays;       // days

  const url = new URL(cfg.endpoint);
  url.searchParams.set('market', 'cadli');
  url.searchParams.set('instrument', instrument);
  url.searchParams.set('limit', String(Math.min(limit, 2000))); // API max is 2000
  url.searchParams.set('to_ts', String(now));
  url.searchParams.set('groups', 'OHLC,VOLUME');
  url.searchParams.set('fill', 'false');
  url.searchParams.set('apply_mapping', 'true');
  url.searchParams.set('response_format', 'JSON');
  url.searchParams.set('api_key', config.COINDESK_API_KEY);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: `HTTP ${response.status}: ${errorText}` };
    }

    const json = await response.json();

    // Check for API errors in response
    if (json.Err && Object.keys(json.Err).length > 0) {
      return { data: null, error: JSON.stringify(json.Err) };
    }

    return { data: json.Data || [], error: null };

  } catch (error) {
    return { data: null, error: error.message };
  }
}

/**
 * Fetch supply data from CoinDesk Data API
 * @param {string} symbol - Cryptocurrency symbol (e.g., BTC, ETH)
 * @param {number} lookbackDays - Number of days to look back
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
async function fetchSupplyFromAPI(symbol, lookbackDays) {
  const url = new URL(Constants.COINDESK_SUPPLY_DAILY);
  url.searchParams.set('asset', symbol);
  url.searchParams.set('asset_lookup_priority', 'SYMBOL');
  url.searchParams.set('limit', String(lookbackDays));
  url.searchParams.set('fill', 'false');
  url.searchParams.set('api_key', config.COINDESK_API_KEY);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: `HTTP ${response.status}: ${errorText}` };
    }

    const json = await response.json();

    // Check for API errors in response
    if (json.Err && Object.keys(json.Err).length > 0) {
      return { data: null, error: JSON.stringify(json.Err) };
    }

    return { data: json.Data || [], error: null };

  } catch (error) {
    return { data: null, error: error.message };
  }
}

/**
 * Insert an OHLCVS record into the database
 * @param {number} cryptoId - Cryptocurrency ID
 * @param {string} unit - 'DAY' or 'HOUR'
 * @param {string} timestamp - Timestamp string (YYYY-MM-DD HH:mm:ss)
 * @param {Object|null} apiData - Data from API (null if no data available)
 */
async function insertOHLCVSRecord(cryptoId, unit, timestamp, apiData) {
  const values = {
    open: apiData?.OPEN || 0,
    high: apiData?.HIGH || 0,
    low: apiData?.LOW || 0,
    close: apiData?.CLOSE || 0,
    volume: apiData?.VOLUME || 0,
    quote_volume: apiData?.QUOTE_VOLUME || 0,
    volume_top_tier: apiData?.VOLUME_TOP_TIER || 0,
    quote_volume_top_tier: apiData?.QUOTE_VOLUME_TOP_TIER || 0,
    volume_direct: apiData?.VOLUME_DIRECT || 0,
    quote_volume_direct: apiData?.QUOTE_VOLUME_DIRECT || 0,
    volume_top_tier_direct: apiData?.VOLUME_TOP_TIER_DIRECT || 0,
    quote_volume_top_tier_direct: apiData?.QUOTE_VOLUME_TOP_TIER_DIRECT || 0,
  };

  await Database.execute(`
    INSERT INTO ohlcvs
    (crypto_id, unit, timestamp, open, high, low, close, volume, quote_volume,
     volume_top_tier, quote_volume_top_tier, volume_direct, quote_volume_direct,
     volume_top_tier_direct, quote_volume_top_tier_direct,
     supply_circulating, supply_total, supply_burnt, supply_max,
     supply_staked, supply_future, supply_issued, supply_locked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, -1, 0, -1, 0, 0)
    ON DUPLICATE KEY UPDATE
    open = VALUES(open),
    high = VALUES(high),
    low = VALUES(low),
    close = VALUES(close),
    volume = VALUES(volume),
    quote_volume = VALUES(quote_volume),
    volume_top_tier = VALUES(volume_top_tier),
    quote_volume_top_tier = VALUES(quote_volume_top_tier),
    volume_direct = VALUES(volume_direct),
    quote_volume_direct = VALUES(quote_volume_direct),
    volume_top_tier_direct = VALUES(volume_top_tier_direct),
    quote_volume_top_tier_direct = VALUES(quote_volume_top_tier_direct)
  `, [
    cryptoId,
    unit,
    timestamp,
    values.open,
    values.high,
    values.low,
    values.close,
    values.volume,
    values.quote_volume,
    values.volume_top_tier,
    values.quote_volume_top_tier,
    values.volume_direct,
    values.quote_volume_direct,
    values.volume_top_tier_direct,
    values.quote_volume_top_tier_direct,
  ]);
}

/**
 * Convert Unix timestamp to datetime string
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {boolean} includeHour - Whether to include hour precision
 * @returns {string} YYYY-MM-DD HH:mm:ss
 */
function unixToDateTimeString(timestamp, includeHour) {
  const date = new Date(timestamp * 1000);
  return formatDateTimeString(date, includeHour);
}

/**
 * Format a Date object as YYYY-MM-DD HH:mm:ss string
 * @param {Date} date
 * @param {boolean} includeHour - If false, time is set to 00:00:00
 * @returns {string}
 */
function formatDateTimeString(date, includeHour) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = includeHour ? String(date.getUTCHours()).padStart(2, '0') : '00';
  return `${year}-${month}-${day} ${hour}:00:00`;
}

/**
 * Delay execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse command line arguments
 * @returns {string} granularity - 'daily' or 'hourly'
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--hourly') || args.includes('-h')) {
    return 'hourly';
  }

  if (args.includes('--daily') || args.includes('-d')) {
    return 'daily';
  }

  // Default: show usage
  console.log('Usage: node fetchOHLCVS.js [--daily|-d] [--hourly|-h]');
  console.log('');
  console.log('Options:');
  console.log('  --daily,  -d    Fetch daily OHLCVS data (365 days lookback) + supply data');
  console.log('  --hourly, -h    Fetch hourly OHLCVS data (90 days lookback)');
  process.exit(1);
}

// Run the command
const granularity = parseArgs();

fetchOHLCVS(granularity)
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
