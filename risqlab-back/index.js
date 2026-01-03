import api from './lib/api.js';
import log from './lib/log.js';
import config from './utils/config.js';

import './routes/cryptocurrencies.js';
import './routes/metrics.js';
import './routes/indexDetails.js';
import './routes/cryptoDetail.js';
import './routes/volatility.js';
import './routes/correlation.js';
import './routes/riskMetrics.js';

// eslint-disable-next-line
api.use((err, req, res, next) => {
  const originalUrl = req?.originalUrl || '';
  const errorMessage = err?.message || '';
  const stack = err?.stack || '';
  const msg = `Internal server error - Route ${originalUrl} - ${errorMessage}`;

  log.error(`${msg} - ${stack}`);

  res.status(err.status || 500).json({
    data: null,
    msg: msg,
  });
});

const { RISQLAB_API_HTTPSECURE, RISQLAB_API_HOSTNAME, RISQLAB_API_PORT } = config;

api.listen(RISQLAB_API_PORT, RISQLAB_API_HOSTNAME, async function () {
  log.info(
    `API listening on http${RISQLAB_API_HTTPSECURE ? 's' : ''}://${RISQLAB_API_HOSTNAME}:${RISQLAB_API_PORT}/.`
  );
});
