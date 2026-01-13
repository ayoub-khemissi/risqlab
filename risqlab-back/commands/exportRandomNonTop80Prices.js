import Database from '../lib/database.js';
import log from '../lib/log.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export historical prices for 3 random cryptos that have NEVER been in the top 80
 * - Selects cryptos that have never appeared in portfolio_volatility_constituents
 * - Only selects cryptos with complete price data for all dates in the window
 * - Retrieves prices from market_data up to D-1
 * Output: CSV file with columns:
 *   Symbol, Name, then for each date: Date_Price
 */
async function exportRandomNonTop80Prices() {
  const startTime = Date.now();

  try {
    log.info('Starting random non-top80 prices export...');

    // 1. Get the latest portfolio volatility record to use its window_days
    const [pvRecords] = await Database.execute(`
      SELECT pv.id, pv.date, pv.window_days
      FROM portfolio_volatility pv
      INNER JOIN index_config ic ON pv.index_config_id = ic.id
      WHERE ic.index_name = 'RisqLab 80'
      ORDER BY pv.date DESC
      LIMIT 1
    `);

    if (pvRecords.length === 0) {
      throw new Error('No portfolio volatility data found');
    }

    const { window_days: windowDays } = pvRecords[0];
    log.info(`Using ${windowDays} days window (from latest portfolio volatility)`);

    // 2. Count the expected number of dates in the window
    const [dateCountResult] = await Database.execute(`
      SELECT COUNT(DISTINCT price_date) as date_count
      FROM market_data
      WHERE price_date >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL ${windowDays} DAY)
        AND price_date <= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `);

    const expectedDateCount = dateCountResult[0].date_count;
    log.info(`Expected ${expectedDateCount} dates in the window`);

    // 3. Get 3 random cryptos that:
    //    - Have NEVER been in portfolio_volatility_constituents
    //    - Have prices for ALL dates in the window
    const [randomCryptos] = await Database.execute(`
      SELECT c.id as crypto_id, c.symbol, c.name
      FROM cryptocurrencies c
      WHERE c.id NOT IN (
        SELECT DISTINCT pvc.crypto_id
        FROM portfolio_volatility_constituents pvc
      )
      AND (
        SELECT COUNT(DISTINCT md.price_date)
        FROM market_data md
        WHERE md.crypto_id = c.id
          AND md.price_date >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL ${windowDays} DAY)
          AND md.price_date <= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      ) = ${expectedDateCount}
      ORDER BY RAND()
      LIMIT 3
    `);

    if (randomCryptos.length === 0) {
      throw new Error('No cryptos found that have never been in top 80 with complete price data');
    }

    log.info(`Selected ${randomCryptos.length} random cryptos: ${randomCryptos.map(c => c.symbol).join(', ')}`);

    const cryptoIds = randomCryptos.map(c => c.crypto_id);

    // 3. Get historical prices for these cryptos from market_data (D-1 to D-1-window, excludes today)
    const [pricesData] = await Database.execute(`
      SELECT
        md.crypto_id,
        md.price_date,
        md.price_usd
      FROM market_data md
      WHERE md.crypto_id IN (${cryptoIds.join(',')})
        AND md.price_date >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL ${windowDays} DAY)
        AND md.price_date <= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        AND md.timestamp = (
          SELECT MAX(md2.timestamp)
          FROM market_data md2
          WHERE md2.crypto_id = md.crypto_id
            AND md2.price_date = md.price_date
        )
      ORDER BY md.price_date ASC
    `);

    log.info(`Retrieved ${pricesData.length} price records`);

    // 4. Build a map for quick lookup: crypto_id + date -> price
    const dataMap = new Map();
    const datesSet = new Set();

    for (const row of pricesData) {
      const dateKey = row.price_date instanceof Date
        ? row.price_date.toISOString().split('T')[0]
        : new Date(row.price_date).toISOString().split('T')[0];
      const key = `${row.crypto_id}_${dateKey}`;
      dataMap.set(key, row);
      datesSet.add(dateKey);
    }

    const sortedDates = [...datesSet].sort();

    // 5. Build CSV content
    const formatNumber = (num) => {
      if (num === null || num === undefined) return '';
      return num.toString().replace('.', ',');
    };

    let csvContent = '';

    // Header row: Symbol;Name;Date1_Price;Date2_Price;...
    csvContent += 'Symbol;Name';
    for (const date of sortedDates) {
      csvContent += `;${date}_Price`;
    }
    csvContent += '\n';

    // Data rows: one per crypto
    for (const crypto of randomCryptos) {
      csvContent += `${crypto.symbol};${crypto.name}`;

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
    const filename = `Random_NonTop80_Prices_${windowDays}days_${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    fs.writeFileSync(filepath, csvContent, 'utf8');

    const duration = Date.now() - startTime;
    log.info(`Random non-top80 prices exported successfully to: ${filepath}`);
    log.info(`Export completed in ${duration}ms`);
    log.info(`Exported ${randomCryptos.length} cryptos x ${sortedDates.length} days`);

    return filepath;

  } catch (error) {
    log.error(`Error exporting random non-top80 prices: ${error.message}`);
    throw error;
  }
}

// Run the command
exportRandomNonTop80Prices()
  .then((filepath) => {
    log.info('Export command completed successfully');
    log.info(`File saved at: ${filepath}`);
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Export command failed: ${error.message}`);
    process.exit(1);
  });
