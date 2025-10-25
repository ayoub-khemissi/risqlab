import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

api.get('/cryptocurrencies', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const sortBy = req.query.sortBy || 'market_cap_usd';
    const sortOrder = (req.query.sortOrder || 'desc').toUpperCase();

    const allowedSortColumns = [
      'market_cap_usd',
      'price_usd',
      'percent_change_24h',
      'percent_change_7d',
      'volume_24h_usd',
      'circulating_supply',
      'symbol',
      'name'
    ];

    if (!allowedSortColumns.includes(sortBy)) {
      return res.status(400).json({
        data: null,
        msg: 'Invalid sortBy parameter',
      });
    }

    if (!['ASC', 'DESC'].includes(sortOrder)) {
      return res.status(400).json({
        data: null,
        msg: 'Invalid sortOrder parameter',
      });
    }

    const offset = (page - 1) * limit;

    const orderByClause = `ORDER BY ${sortBy === 'market_cap_usd' ? '(md.price_usd * md.circulating_supply)' : sortBy} ${sortOrder}`;

    const [rows] = await Database.execute(`
      SELECT
        c.id,
        c.symbol,
        c.name,
        c.cmc_id,
        md.price_usd,
        (md.price_usd * md.circulating_supply) as market_cap_usd,
        md.volume_24h_usd,
        md.circulating_supply,
        md.percent_change_24h,
        md.percent_change_7d,
        md.timestamp,
        ranked.rank_number as \`rank\`
      FROM cryptocurrencies c
      INNER JOIN (
        SELECT crypto_id, MAX(timestamp) as max_timestamp
        FROM market_data
        GROUP BY crypto_id
      ) latest ON c.id = latest.crypto_id
      INNER JOIN market_data md ON c.id = md.crypto_id AND md.timestamp = latest.max_timestamp
      INNER JOIN (
        SELECT
          md2.crypto_id,
          ROW_NUMBER() OVER (ORDER BY (md2.price_usd * md2.circulating_supply) DESC) as rank_number
        FROM market_data md2
        INNER JOIN (
          SELECT crypto_id, MAX(timestamp) as max_timestamp
          FROM market_data
          GROUP BY crypto_id
        ) latest2 ON md2.crypto_id = latest2.crypto_id AND md2.timestamp = latest2.max_timestamp
        WHERE (md2.price_usd * md2.circulating_supply) > 0
      ) ranked ON c.id = ranked.crypto_id
      WHERE (md.price_usd * md.circulating_supply) > 0
      ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const [countResult] = await Database.execute(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM cryptocurrencies c
      INNER JOIN (
        SELECT crypto_id, MAX(timestamp) as max_timestamp
        FROM market_data
        GROUP BY crypto_id
      ) latest ON c.id = latest.crypto_id
      INNER JOIN market_data md ON c.id = md.crypto_id AND md.timestamp = latest.max_timestamp
      WHERE (md.price_usd * md.circulating_supply) > 0
    `);

    const total = countResult[0].total;

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

    log.debug(`Fetched ${rows.length} cryptocurrencies (page ${page})`);
  } catch (error) {
    log.error(`Error fetching cryptocurrencies: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch cryptocurrencies',
    });
  }
});
