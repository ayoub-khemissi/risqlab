import Config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Main function to fetch Fear and Greed Index from CoinMarketCap
 * and store it in the database.
 */
async function fetchFearAndGreed() {
  try {
    log.info('Starting Fear and Greed Index fetch...');

    // 1. Fetch data from CoinMarketCap API
    const response = await fetch(`${Constants.COINMARKETCAP_FEAR_AND_GREED}?limit=1`, {
      headers: {
        'X-CMC_PRO_API_KEY': Config.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('Invalid response format from CoinMarketCap API');
    }

    const fearGreedData = data.data[0];

    // 2. Convert timestamp from Unix to MySQL DATETIME
    const timestamp = new Date(parseInt(fearGreedData.timestamp) * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    // 3. Insert into database
    await Database.execute(
      `INSERT INTO fear_and_greed
      (value, timestamp)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE
      value = VALUES(value)`,
      [
        fearGreedData.value,
        timestamp,
      ]
    );

    log.info(`Fear and Greed Index inserted/updated successfully at ${timestamp}`);
    log.info(`Value: ${fearGreedData.value}`);

  } catch (error) {
    log.error(`Error fetching Fear and Greed Index: ${error.message}`);
    throw error;
  }
}

// Run the command
fetchFearAndGreed()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
