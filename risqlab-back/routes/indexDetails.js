import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

api.get('/index-details', async (req, res) => {
  try {
    const { period = 'all' } = req.query;

    let timeFilter = '';
    switch (period) {
      case '24h':
        timeFilter = 'AND ih.timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)';
        break;
      case '7d':
        timeFilter = 'AND ih.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case '30d':
        timeFilter = 'AND ih.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      default:
        timeFilter = '';
    }

    const [latestIndex] = await Database.execute(`
      SELECT
        ih.index_level,
        ih.timestamp,
        ih.total_market_cap_usd,
        ih.number_of_constituents
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'RisqLab 80'
      ORDER BY ih.timestamp DESC
      LIMIT 1
    `);

    const [yesterdayIndex] = await Database.execute(`
      SELECT ih.index_level
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'RisqLab 80'
        AND ih.timestamp <= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY ih.timestamp DESC
      LIMIT 1
    `);

    const [lastWeekIndex] = await Database.execute(`
      SELECT ih.index_level
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'RisqLab 80'
        AND ih.timestamp <= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY ih.timestamp DESC
      LIMIT 1
    `);

    const [lastMonthIndex] = await Database.execute(`
      SELECT ih.index_level
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'RisqLab 80'
        AND ih.timestamp <= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY ih.timestamp DESC
      LIMIT 1
    `);

    const [indexHistory] = await Database.execute(`
      SELECT
        ih.index_level,
        ih.timestamp
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'RisqLab 80'
        ${timeFilter}
      ORDER BY ih.timestamp ASC
    `);

    const [constituents] = await Database.execute(`
      SELECT
        ic.rank_position,
        c.symbol,
        c.name,
        c.cmc_id,
        ic.price_usd,
        (ic.price_usd * ic.circulating_supply) as market_cap_usd,
        ic.circulating_supply,
        ic.weight_in_index,
        md.percent_change_24h,
        md.percent_change_7d,
        md.volume_24h_usd
      FROM index_constituents ic
      INNER JOIN index_history ih ON ic.index_history_id = ih.id
      INNER JOIN cryptocurrencies c ON ic.crypto_id = c.id
      INNER JOIN market_data md ON ic.market_data_id = md.id
      WHERE ih.id = (
        SELECT ih2.id
        FROM index_history ih2
        INNER JOIN index_config ic2 ON ih2.index_config_id = ic2.id
        WHERE ic2.index_name = 'RisqLab 80'
        ORDER BY ih2.timestamp DESC
        LIMIT 1
      )
      ORDER BY ic.rank_position ASC
    `);

    const current = latestIndex[0] || null;
    const historicalValues = {
      yesterday: yesterdayIndex[0]?.index_level || null,
      lastWeek: lastWeekIndex[0]?.index_level || null,
      lastMonth: lastMonthIndex[0]?.index_level || null
    };

    const percent_change_24h = current && historicalValues.yesterday
      ? ((current.index_level - historicalValues.yesterday) / historicalValues.yesterday * 100)
      : 0;

    res.json({
      data: {
        current: {
          ...current,
          percent_change_24h
        },
        historicalValues,
        history: indexHistory,
        constituents
      }
    });

    log.debug('Fetched index details');
  } catch (error) {
    log.error(`Error fetching index details: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch index details',
    });
  }
});
