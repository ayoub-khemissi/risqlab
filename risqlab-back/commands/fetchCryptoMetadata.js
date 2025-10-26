import Config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Main function to fetch cryptocurrency metadata from CoinMarketCap
 * and store it in the database for filtering purposes.
 */
async function fetchCryptoMetadata() {
  try {
    log.info('Starting cryptocurrency metadata fetch...');

    // 1. Get all cryptocurrencies from our database that have a cmc_id
    const [cryptos] = await Database.execute(`
      SELECT id, symbol, name, cmc_id
      FROM cryptocurrencies
      WHERE cmc_id IS NOT NULL
      ORDER BY id
    `);

    if (cryptos.length === 0) {
      log.warn('No cryptocurrencies with cmc_id found in database. Run fetchCryptoMarketData first.');
      return;
    }

    log.info(`Found ${cryptos.length} cryptocurrencies to fetch metadata for`);

    // 2. Batch the requests (CoinMarketCap allows up to 1000 IDs per request)
    const BATCH_SIZE = 500; // Use 500 to be safe
    const batches = [];

    for (let i = 0; i < cryptos.length; i += BATCH_SIZE) {
      batches.push(cryptos.slice(i, i + BATCH_SIZE));
    }

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalErrors = 0;

    // 3. Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const cmcIds = batch.map(c => c.cmc_id).join(',');

      log.info(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} cryptos)...`);

      try {
        // Fetch metadata from CoinMarketCap
        const response = await fetch(`${Constants.COINMARKETCAP_CRYPTO_INFO}?id=${cmcIds}`, {
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

        if (!data.data) {
          throw new Error('Invalid response format from CoinMarketCap API');
        }

        // 4. Process each cryptocurrency metadata
        for (const crypto of batch) {
          try {
            const metadata = data.data[crypto.cmc_id];

            if (!metadata) {
              log.warn(`No metadata found for ${crypto.symbol} (CMC ID: ${crypto.cmc_id})`);
              totalErrors++;
              continue;
            }

            // Extract relevant information
            const tags = metadata.tags || [];
            const category = metadata.category || null;
            const description = metadata.description || null;
            const logoUrl = metadata.logo || null;
            const websiteUrl = metadata.urls?.website?.[0] || null;
            const whitepaperUrl = metadata.urls?.technical_doc?.[0] || null;
            const twitterUrl = metadata.urls?.twitter?.[0] || null;
            const redditUrl = metadata.urls?.reddit?.[0] || null;
            const telegramUrl = metadata.urls?.chat?.[0] || metadata.urls?.message_board?.[1] || null;
            const githubUrl = metadata.urls?.source_code?.[0] || null;

            // Extract platform information
            let platform = null;
            let dateLaunched = null;

            if (metadata.platform) {
              platform = metadata.platform.name || null;
            }

            if (metadata.date_added) {
              dateLaunched = metadata.date_added.split('T')[0]; // Extract just the date part
            }

            // Store metadata in database
            await Database.execute(
              `INSERT INTO cryptocurrency_metadata
              (crypto_id, cmc_id, tags, category, description, logo_url, website_url,
               whitepaper_url, twitter_url, reddit_url, telegram_url, github_url,
               platform, date_launched)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
              tags = VALUES(tags),
              category = VALUES(category),
              description = VALUES(description),
              logo_url = VALUES(logo_url),
              website_url = VALUES(website_url),
              whitepaper_url = VALUES(whitepaper_url),
              twitter_url = VALUES(twitter_url),
              reddit_url = VALUES(reddit_url),
              telegram_url = VALUES(telegram_url),
              github_url = VALUES(github_url),
              platform = VALUES(platform),
              date_launched = VALUES(date_launched),
              updated_at = CURRENT_TIMESTAMP`,
              [
                crypto.id,
                crypto.cmc_id,
                JSON.stringify(tags),
                category,
                description,
                logoUrl,
                websiteUrl,
                whitepaperUrl,
                twitterUrl,
                redditUrl,
                telegramUrl,
                githubUrl,
                platform,
                dateLaunched,
              ]
            );

            totalSuccess++;
            totalProcessed++;

            // Log if it's a stablecoin, wrapped, or liquid staking
            const isStablecoin = tags.includes('stablecoin');
            const isWrapped = tags.includes('wrapped-tokens') || tags.includes('bridged-tokens');
            const isLiquidStaking = tags.includes('liquid-staking-derivatives') || tags.includes('staking');

            if (isStablecoin || isWrapped || isLiquidStaking) {
              const types = [];
              if (isStablecoin) types.push('STABLECOIN');
              if (isWrapped) types.push('WRAPPED');
              if (isLiquidStaking) types.push('LIQUID_STAKING');
              log.debug(`${crypto.symbol}: ${types.join(', ')}`);
            }

          } catch (error) {
            totalErrors++;
            log.error(`Error processing metadata for ${crypto.symbol}: ${error.message}`);
          }
        }

        log.info(`Batch ${batchIndex + 1} completed: ${batch.length} processed`);

        // Add a small delay between batches to respect rate limits
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        totalErrors += batch.length;
        log.error(`Error fetching batch ${batchIndex + 1}: ${error.message}`);
      }
    }

    log.info(`Metadata fetch completed: ${totalSuccess} successful, ${totalErrors} errors out of ${cryptos.length} total`);

    // 5. Log summary of exclusions
    const [summary] = await Database.execute(`
      SELECT
        SUM(is_stablecoin) as stablecoins,
        SUM(is_wrapped) as wrapped,
        SUM(is_liquid_staking) as liquid_staking,
        SUM(is_stablecoin OR is_wrapped OR is_liquid_staking) as total_excluded
      FROM cryptocurrency_metadata
    `);

    if (summary.length > 0) {
      const stats = summary[0];
      log.info('=== Exclusion Summary ===');
      log.info(`Stablecoins: ${stats.stablecoins}`);
      log.info(`Wrapped tokens: ${stats.wrapped}`);
      log.info(`Liquid staking: ${stats.liquid_staking}`);
      log.info(`Total excluded: ${stats.total_excluded}`);
    }

  } catch (error) {
    log.error(`Error fetching crypto metadata: ${error.message}`);
    throw error;
  }
}

// Run the command
fetchCryptoMetadata()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
