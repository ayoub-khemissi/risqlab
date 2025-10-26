import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * GET /cryptocurrency/:symbol
 * Fetches comprehensive details for a specific cryptocurrency
 */
api.get('/cryptocurrency/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // 1. Fetch basic crypto info with latest market data
    const [cryptoRows] = await Database.execute(`
      SELECT
        c.id,
        c.symbol,
        c.name,
        c.cmc_id,
        md.price_usd,
        (md.price_usd * md.circulating_supply) as market_cap_usd,
        md.volume_24h_usd,
        md.circulating_supply,
        md.percent_change_1h,
        md.percent_change_24h,
        md.percent_change_7d,
        md.percent_change_30d,
        md.percent_change_60d,
        md.percent_change_90d,
        md.cmc_rank,
        md.max_supply,
        md.total_supply,
        md.fully_diluted_valuation,
        md.timestamp
      FROM cryptocurrencies c
      INNER JOIN (
        SELECT crypto_id, MAX(timestamp) as max_timestamp
        FROM market_data
        GROUP BY crypto_id
      ) latest ON c.id = latest.crypto_id
      INNER JOIN market_data md ON c.id = md.crypto_id AND md.timestamp = latest.max_timestamp
      WHERE c.symbol = ?
      LIMIT 1
    `, [symbol]);

    if (cryptoRows.length === 0) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${symbol} not found`,
      });
    }

    const crypto = cryptoRows[0];

    // 2. Fetch metadata
    const [metadataRows] = await Database.execute(`
      SELECT
        category,
        description,
        logo_url,
        website_url,
        whitepaper_url,
        twitter_url,
        reddit_url,
        telegram_url,
        github_url,
        platform,
        date_launched,
        tags
      FROM cryptocurrency_metadata
      WHERE crypto_id = ?
      LIMIT 1
    `, [crypto.id]);

    const metadata = metadataRows.length > 0 ? metadataRows[0] : {};

    // Parse tags if it exists
    let tags = [];
    if (metadata.tags) {
      try {
        tags = JSON.parse(metadata.tags);
      } catch (e) {
        tags = [];
      }
    }

    // 3. Build response
    const response = {
      data: {
        basic: {
          id: crypto.id,
          symbol: crypto.symbol,
          name: crypto.name,
          cmc_id: crypto.cmc_id,
          logo_url: metadata.logo_url || null,
          description: metadata.description || null,
          category: metadata.category || null,
          tags: tags,
        },
        links: {
          website: metadata.website_url || null,
          whitepaper: metadata.whitepaper_url || null,
          twitter: metadata.twitter_url || null,
          reddit: metadata.reddit_url || null,
          telegram: metadata.telegram_url || null,
          github: metadata.github_url || null,
        },
        launch: {
          date: metadata.date_launched || null,
          platform: metadata.platform || null,
        },
        market: {
          price_usd: parseFloat(crypto.price_usd) || 0,
          market_cap_usd: parseFloat(crypto.market_cap_usd) || 0,
          volume_24h_usd: parseFloat(crypto.volume_24h_usd) || 0,
          circulating_supply: parseFloat(crypto.circulating_supply) || 0,
          total_supply: crypto.total_supply ? parseFloat(crypto.total_supply) : null,
          max_supply: crypto.max_supply ? parseFloat(crypto.max_supply) : null,
          fully_diluted_valuation: crypto.fully_diluted_valuation ? parseFloat(crypto.fully_diluted_valuation) : null,
          cmc_rank: crypto.cmc_rank || null,
          percent_change_1h: crypto.percent_change_1h ? parseFloat(crypto.percent_change_1h) : null,
          percent_change_24h: crypto.percent_change_24h ? parseFloat(crypto.percent_change_24h) : null,
          percent_change_7d: crypto.percent_change_7d ? parseFloat(crypto.percent_change_7d) : null,
          percent_change_30d: crypto.percent_change_30d ? parseFloat(crypto.percent_change_30d) : null,
          percent_change_60d: crypto.percent_change_60d ? parseFloat(crypto.percent_change_60d) : null,
          percent_change_90d: crypto.percent_change_90d ? parseFloat(crypto.percent_change_90d) : null,
          last_updated: crypto.timestamp,
        }
      },
    };

    res.json(response);
    log.debug(`Fetched details for cryptocurrency: ${symbol}`);

  } catch (error) {
    log.error(`Error fetching cryptocurrency detail: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch cryptocurrency detail',
    });
  }
});
