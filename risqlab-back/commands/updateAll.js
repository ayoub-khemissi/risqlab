import { spawn } from 'child_process';
import log from '../lib/log.js';

/**
 * Execute a command and return a promise
 * @param {string} command - Command to execute
 * @param {string} description - Description for logging
 * @returns {Promise<void>}
 */
function executeCommand(command, description) {
  return new Promise((resolve, reject) => {
    log.info(`=== ${description} ===`);

    const child = spawn('node', [command], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${description} failed with code ${code}`));
      } else {
        log.info(`✓ ${description} completed successfully\n`);
        resolve();
      }
    });

    child.on('error', (error) => {
      reject(new Error(`${description} failed: ${error.message}`));
    });
  });
}

/**
 * Main function to update all data and calculate the index
 */
async function updateAll() {
  const startTime = Date.now();

  try {
    log.info('╔════════════════════════════════════════════════════════════╗');
    log.info('║         RisqLab 80 - Complete Data Update & Index          ║');
    log.info('╚════════════════════════════════════════════════════════════╝\n');

    // Step 1: Fetch cryptocurrency market data (500 cryptos)
    await executeCommand(
      'commands/fetchCryptoMarketData.js',
      'Step 1/4: Fetching Cryptocurrency Market Data'
    );

    // Step 2: Fetch global market metrics
    await executeCommand(
      'commands/fetchGlobalMetrics.js',
      'Step 2/4: Fetching Global Market Metrics'
    );

    // Step 3: Fetch Fear and Greed Index
    await executeCommand(
      'commands/fetchFearAndGreed.js',
      'Step 3/4: Fetching Fear and Greed Index'
    );

    // Step 4: Calculate RisqLab 80 Index
    await executeCommand(
      'commands/calculateRisqLab80.js',
      'Step 4/4: Calculating RisqLab 80 Index'
    );

    const duration = Date.now() - startTime;
    const durationSeconds = (duration / 1000).toFixed(2);

    log.info('╔════════════════════════════════════════════════════════════╗');
    log.info('║                    UPDATE COMPLETED                        ║');
    log.info('╚════════════════════════════════════════════════════════════╝');
    log.info(`Total execution time: ${durationSeconds}s (${duration}ms)`);
    log.info('All data successfully updated and index calculated!\n');

  } catch (error) {
    log.error('╔════════════════════════════════════════════════════════════╗');
    log.error('║                     UPDATE FAILED                          ║');
    log.error('╚════════════════════════════════════════════════════════════╝');
    log.error(`Error: ${error.message}`);
    throw error;
  }
}

// Run the update
updateAll()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Update failed: ${error.message}`);
    process.exit(1);
  });
