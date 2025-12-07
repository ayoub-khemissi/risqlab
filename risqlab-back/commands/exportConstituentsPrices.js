import Database from '../lib/database.js';
import log from '../lib/log.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export historical data for the 80 index constituents over the last 90 days
 * - Takes the 80 cryptos from yesterday's (D-1) last snapshot
 * - For each crypto, retrieves price from D-90 to D-1, and weight from D-1
 * Output: CSV file with 80 rows (one per crypto) and columns:
 *   Rank, Symbol, Name, Weight (D-1), then for each date: Date_Price
 */
async function exportConstituentsPrices() {
  const startTime = Date.now();

  try {
    log.info('Starting constituents prices export...');

    // 1. Get yesterday's (D-1) last snapshot to identify the 80 cryptos
    const [yesterdaySnapshot] = await Database.execute(`
      SELECT
        ih.id as index_history_id,
        ih.snapshot_date,
        ih.timestamp
      FROM index_history ih
      INNER JOIN index_config cfg ON ih.index_config_id = cfg.id
      WHERE cfg.is_active = TRUE
        AND ih.snapshot_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        AND ih.timestamp = (
          SELECT MAX(ih2.timestamp)
          FROM index_history ih2
          WHERE ih2.index_config_id = ih.index_config_id
            AND ih2.snapshot_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        )
      LIMIT 1
    `);

    if (yesterdaySnapshot.length === 0) {
      throw new Error('No index history found for yesterday');
    }

    log.info(`Using snapshot from ${yesterdaySnapshot[0].timestamp}`);

    // 2. Get the 80 crypto IDs from yesterday's snapshot (with weight)
    const [yesterdayCryptos] = await Database.execute(`
      SELECT
        c.id as crypto_id,
        c.symbol,
        c.name,
        ic.rank_position,
        ic.weight_in_index
      FROM index_constituents ic
      INNER JOIN cryptocurrencies c ON ic.crypto_id = c.id
      WHERE ic.index_history_id = ?
      ORDER BY ic.rank_position ASC
    `, [yesterdaySnapshot[0].index_history_id]);

    log.info(`Found ${yesterdayCryptos.length} constituents from yesterday`);

    const cryptoIds = yesterdayCryptos.map(c => c.crypto_id);

    // 3. Get historical prices for the 80 cryptos from market_data (last price of each day, D-90 to D-1)
    const [constituentsData] = await Database.execute(`
      SELECT
        md.crypto_id,
        md.price_date,
        md.price_usd
      FROM market_data md
      WHERE md.crypto_id IN (${cryptoIds.join(',')})
        AND md.price_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        AND md.price_date < CURDATE()
        AND md.timestamp = (
          SELECT MAX(md2.timestamp)
          FROM market_data md2
          WHERE md2.crypto_id = md.crypto_id
            AND md2.price_date = md.price_date
        )
      ORDER BY md.price_date ASC
    `);

    log.info(`Retrieved ${constituentsData.length} constituent records`);

    // 4. Build a map for quick lookup: crypto_id + date -> price
    const dataMap = new Map();
    const datesSet = new Set();
    for (const row of constituentsData) {
      // price_date is already a DATE, format it as YYYY-MM-DD
      const dateKey = row.price_date instanceof Date
        ? row.price_date.toISOString().split('T')[0]
        : new Date(row.price_date).toISOString().split('T')[0];
      const key = `${row.crypto_id}_${dateKey}`;
      dataMap.set(key, row);
      datesSet.add(dateKey);
    }

    // Get sorted dates
    const sortedDates = [...datesSet].sort();

    // 5. Build CSV content
    // Helper to format number (replace dot with comma for Excel)
    const formatNumber = (num) => {
      if (num === null || num === undefined) return '';
      return num.toString().replace('.', ',');
    };

    let csvContent = '';

    // Header row: Rank;Symbol;Name;Weight;Date1_Price;Date2_Price;...
    csvContent += 'Rank;Symbol;Name;Weight';
    for (const date of sortedDates) {
      csvContent += `;${date}_Price`;
    }
    csvContent += '\n';

    // Data rows: one per crypto (80 rows)
    for (const crypto of yesterdayCryptos) {
      csvContent += `${crypto.rank_position};${crypto.symbol};${crypto.name};${formatNumber(crypto.weight_in_index)}`;

      for (const date of sortedDates) {
        const key = `${crypto.crypto_id}_${date}`;
        const data = dataMap.get(key);
        csvContent += `;${data ? formatNumber(data.price_usd) : ''}`;
      }
      csvContent += '\n';
    }

    // 6. Write to file
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Constituents_Prices_90days_${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    fs.writeFileSync(filepath, csvContent, 'utf8');

    const duration = Date.now() - startTime;
    log.info(`Constituents prices exported successfully to: ${filepath}`);
    log.info(`Export completed in ${duration}ms`);
    log.info(`Exported ${yesterdayCryptos.length} cryptos x ${sortedDates.length} days (${sortedDates.length + 4} columns)`);

    return filepath;

  } catch (error) {
    log.error(`Error exporting constituents prices: ${error.message}`);
    throw error;
  }
}

// Run the command
exportConstituentsPrices()
  .then((filepath) => {
    log.info('Export command completed successfully');
    log.info(`File saved at: ${filepath}`);
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Export command failed: ${error.message}`);
    process.exit(1);
  });
