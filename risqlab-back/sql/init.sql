SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `app`;
CREATE TABLE IF NOT EXISTS `app` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `app` (`id`, `name`) VALUES
(1, 'risqlab-api');

DROP TABLE IF EXISTS `app_instance`;
CREATE TABLE IF NOT EXISTS `app_instance` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `app_id` int UNSIGNED NOT NULL,
  `version` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` bigint UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  FOREIGN KEY (`app_id`) REFERENCES app(`id`),
  KEY `fk_app_instance_app_idx` (`app_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `log_level`;
CREATE TABLE IF NOT EXISTS `log_level` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `level` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  UNIQUE KEY `level_UNIQUE` (`level`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `log_level` (`id`, `level`) VALUES
(1, 'DEBUG'),
(2, 'INFO'),
(3, 'WARN'),
(4, 'ERROR');

DROP TABLE IF EXISTS `log`;
CREATE TABLE IF NOT EXISTS `log` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `app_instance_id` int UNSIGNED NOT NULL,
  `level` int UNSIGNED NOT NULL,
  `text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` bigint UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  FOREIGN KEY (`level`) REFERENCES log_level(`id`),
  FOREIGN KEY (`app_instance_id`) REFERENCES app_instance(`id`),
  KEY `fk_log_log_level_idx` (`level`),
  KEY `fk_log_api_instance_idx` (`app_instance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `index_config`;
CREATE TABLE IF NOT EXISTS `index_config` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `index_name` VARCHAR(100) NOT NULL DEFAULT 'RisqLab 80',
    `base_level` DECIMAL(20, 8) NOT NULL DEFAULT 100.00000000,
    `divisor` DECIMAL(30, 8) NOT NULL,
    `base_date` DATETIME NOT NULL,
    `max_constituents` INT UNSIGNED NOT NULL DEFAULT 80,
    `update_frequency_minutes` INT UNSIGNED NOT NULL DEFAULT 30,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_index_name` (`index_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize RisqLab 80 Index with base configuration
-- The divisor will be calculated dynamically on first run based on actual market data
-- Base Level = 100, calculated as: Divisor = (Total Market Cap of top 80) / 100
INSERT INTO `index_config` (`index_name`, `base_level`, `divisor`, `base_date`, `max_constituents`, `update_frequency_minutes`, `is_active`)
VALUES ('RisqLab 80', 100.00000000, 1.00000000, NOW(), 80, 30, TRUE)
ON DUPLICATE KEY UPDATE
    base_level = VALUES(base_level),
    max_constituents = VALUES(max_constituents),
    update_frequency_minutes = VALUES(update_frequency_minutes),
    is_active = VALUES(is_active);

DROP TABLE IF EXISTS `cryptocurrencies`;
CREATE TABLE IF NOT EXISTS `cryptocurrencies` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `symbol` VARCHAR(20) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `cmc_id` INT UNSIGNED NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_symbol` (`symbol`),
    UNIQUE KEY `idx_cmc_id` (`cmc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `cryptocurrency_metadata`;
CREATE TABLE IF NOT EXISTS `cryptocurrency_metadata` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `crypto_id` INT UNSIGNED NOT NULL,
    `cmc_id` INT UNSIGNED NOT NULL,
    `tags` JSON NULL,
    `category` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `logo_url` VARCHAR(500) NULL,
    `website_url` VARCHAR(500) NULL,
    `platform` VARCHAR(100) NULL COMMENT 'Blockchain platform (e.g., Ethereum, Solana)',
    `date_launched` DATE NULL COMMENT 'Launch date of the cryptocurrency',
    `whitepaper_url` VARCHAR(500) NULL,
    `twitter_url` VARCHAR(500) NULL,
    `reddit_url` VARCHAR(500) NULL,
    `telegram_url` VARCHAR(500) NULL,
    `github_url` VARCHAR(500) NULL,
    `max_supply` DECIMAL(30, 8) NULL,
    `total_supply` DECIMAL(30, 8) NULL,
    `is_stablecoin` BOOLEAN GENERATED ALWAYS AS (JSON_CONTAINS(tags, '"stablecoin"')) STORED,
    `is_wrapped` BOOLEAN GENERATED ALWAYS AS (
        JSON_CONTAINS(tags, '"wrapped-tokens"') OR
        JSON_CONTAINS(tags, '"bridged-tokens"')
    ) STORED,
    `is_liquid_staking` BOOLEAN GENERATED ALWAYS AS (
        JSON_CONTAINS(tags, '"liquid-staking-derivatives"') OR
        JSON_CONTAINS(tags, '"staking"')
    ) STORED,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_metadata_crypto_idx` (`crypto_id`) REFERENCES `cryptocurrencies`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_crypto_id` (`crypto_id`),
    UNIQUE KEY `idx_cmc_id` (`cmc_id`),
    KEY `idx_stablecoin` (`is_stablecoin`),
    KEY `idx_wrapped` (`is_wrapped`),
    KEY `idx_liquid_staking` (`is_liquid_staking`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `market_data`;
CREATE TABLE IF NOT EXISTS `market_data` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `crypto_id` INT UNSIGNED NOT NULL,
    `price_usd` DECIMAL(30, 18) NOT NULL,
    `circulating_supply` DECIMAL(30, 8) NOT NULL,
    `volume_24h_usd` DECIMAL(30, 8) NOT NULL,
    `percent_change_1h` DECIMAL(10, 4) NULL,
    `percent_change_24h` DECIMAL(10, 4) NULL,
    `percent_change_7d` DECIMAL(10, 4) NULL,
    `percent_change_30d` DECIMAL(10, 4) NULL,
    `percent_change_60d` DECIMAL(10, 4) NULL,
    `percent_change_90d` DECIMAL(10, 4) NULL,
    `cmc_rank` INT UNSIGNED NULL COMMENT 'CoinMarketCap ranking',
    `max_supply` DECIMAL(30, 8) NULL,
    `total_supply` DECIMAL(30, 8) NULL,
    `fully_diluted_valuation` DECIMAL(40, 8) NULL,
    `timestamp` DATETIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_market_data_crypto_idx` (`crypto_id`) REFERENCES `cryptocurrencies`(`id`) ON DELETE CASCADE,
    KEY `idx_timestamp` (`timestamp`),
    UNIQUE KEY `idx_crypto_timestamp` (`crypto_id`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `index_history`;
CREATE TABLE IF NOT EXISTS `index_history` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `index_config_id` INT UNSIGNED NOT NULL,
    `timestamp` DATETIME NOT NULL,
    `total_market_cap_usd` DECIMAL(40, 8) NOT NULL,
    `index_level` DECIMAL(20, 8) NOT NULL,
    `divisor` DECIMAL(30, 8) NOT NULL,
    `number_of_constituents` INT UNSIGNED NOT NULL,
    `calculation_duration_ms` INT UNSIGNED NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_index_history_index_config_idx` (`index_config_id`) REFERENCES `index_config`(`id`) ON DELETE CASCADE,
    KEY `idx_timestamp` (`timestamp`),
    KEY `idx_index_level` (`index_level`),
    UNIQUE KEY `idx_config_timestamp` (`index_config_id`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `index_constituents`;
CREATE TABLE IF NOT EXISTS `index_constituents` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `index_history_id` BIGINT UNSIGNED NOT NULL,
    `crypto_id` INT UNSIGNED NOT NULL,
    `market_data_id` BIGINT UNSIGNED NOT NULL,
    `rank_position` INT UNSIGNED NOT NULL,
    `price_usd` DECIMAL(30, 18) NOT NULL,
    `circulating_supply` DECIMAL(30, 8) NOT NULL,
    `weight_in_index` DECIMAL(10, 6) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_index_constituents_index_history_idx` (`index_history_id`) REFERENCES `index_history`(`id`) ON DELETE CASCADE,
    FOREIGN KEY `fk_index_constituents_crypto_idx` (`crypto_id`) REFERENCES `cryptocurrencies`(`id`),
    FOREIGN KEY `fk_index_constituents_market_data_idx` (`market_data_id`) REFERENCES `market_data`(`id`),
    KEY `idx_history` (`index_history_id`),
    KEY `idx_crypto` (`crypto_id`),
    KEY `idx_rank` (`rank_position`),
    UNIQUE KEY `idx_history_crypto` (`index_history_id`, `crypto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `global_metrics`;
CREATE TABLE IF NOT EXISTS `global_metrics` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `btc_dominance` DECIMAL(10, 6) NOT NULL,
    `btc_dominance_24h_change` DECIMAL(10, 6) NOT NULL,
    `eth_dominance` DECIMAL(10, 6) NOT NULL,
    `eth_dominance_24h_change` DECIMAL(10, 6) NOT NULL,
    `others_dominance` DECIMAL(10, 6) NOT NULL,
    `others_dominance_24h_change` DECIMAL(10, 6) NOT NULL,
    `total_market_cap_usd` DECIMAL(40, 8) NOT NULL,
    `total_market_cap_24h_change` DECIMAL(10, 4) NOT NULL,
    `total_volume_24h_usd` DECIMAL(40, 8) NOT NULL,
    `total_volume_24h_change` DECIMAL(10, 4) NOT NULL,
    `timestamp` DATETIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_timestamp` (`timestamp`),
    UNIQUE KEY `idx_timestamp_unique` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `fear_and_greed`;
CREATE TABLE IF NOT EXISTS `fear_and_greed` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `value` TINYINT UNSIGNED NOT NULL,
    `timestamp` DATETIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_timestamp` (`timestamp`),
    UNIQUE KEY `idx_timestamp_unique` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crypto_log_returns`;
CREATE TABLE IF NOT EXISTS `crypto_log_returns` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `crypto_id` INT UNSIGNED NOT NULL,
    `date` DATE NOT NULL,
    `log_return` DECIMAL(20, 12) NOT NULL COMMENT 'Logarithmic return: ln(Price_t / Price_t-1)',
    `price_current` DECIMAL(30, 18) NOT NULL COMMENT 'Current day closing price',
    `price_previous` DECIMAL(30, 18) NOT NULL COMMENT 'Previous day closing price',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_log_returns_crypto_idx` (`crypto_id`) REFERENCES `cryptocurrencies`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_crypto_date` (`crypto_id`, `date`),
    KEY `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crypto_volatility`;
CREATE TABLE IF NOT EXISTS `crypto_volatility` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `crypto_id` INT UNSIGNED NOT NULL,
    `date` DATE NOT NULL COMMENT 'Date for which volatility is calculated',
    `window_days` INT UNSIGNED NOT NULL DEFAULT 90 COMMENT 'Rolling window size in days',
    `daily_volatility` DECIMAL(20, 12) NOT NULL COMMENT 'Daily volatility (standard deviation of log returns)',
    `annualized_volatility` DECIMAL(20, 12) NOT NULL COMMENT 'Annualized volatility (daily_vol * sqrt(365))',
    `num_observations` INT UNSIGNED NOT NULL COMMENT 'Number of data points used in calculation',
    `mean_return` DECIMAL(20, 12) NOT NULL COMMENT 'Mean of log returns over the window',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_volatility_crypto_idx` (`crypto_id`) REFERENCES `cryptocurrencies`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_crypto_date_window` (`crypto_id`, `date`, `window_days`),
    KEY `idx_date` (`date`),
    KEY `idx_annualized_volatility` (`annualized_volatility`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `portfolio_volatility`;
CREATE TABLE IF NOT EXISTS `portfolio_volatility` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `index_config_id` INT UNSIGNED NOT NULL COMMENT 'Reference to the index configuration',
    `date` DATE NOT NULL COMMENT 'Date for which portfolio volatility is calculated',
    `window_days` INT UNSIGNED NOT NULL DEFAULT 90 COMMENT 'Rolling window size in days',
    `daily_volatility` DECIMAL(20, 12) NOT NULL COMMENT 'Daily portfolio volatility',
    `annualized_volatility` DECIMAL(20, 12) NOT NULL COMMENT 'Annualized portfolio volatility (daily_vol * sqrt(365))',
    `num_constituents` INT UNSIGNED NOT NULL COMMENT 'Number of cryptocurrencies in the portfolio',
    `total_market_cap_usd` DECIMAL(40, 8) NOT NULL COMMENT 'Total market cap of portfolio constituents',
    `calculation_duration_ms` INT UNSIGNED NULL COMMENT 'Time taken to calculate volatility',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_portfolio_vol_index_config_idx` (`index_config_id`) REFERENCES `index_config`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_index_date_window` (`index_config_id`, `date`, `window_days`),
    KEY `idx_date` (`date`),
    KEY `idx_annualized_volatility` (`annualized_volatility`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `portfolio_volatility_constituents`;
CREATE TABLE IF NOT EXISTS `portfolio_volatility_constituents` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `portfolio_volatility_id` BIGINT UNSIGNED NOT NULL,
    `crypto_id` INT UNSIGNED NOT NULL,
    `weight` DECIMAL(10, 6) NOT NULL COMMENT 'Weight in portfolio (based on market cap)',
    `daily_volatility` DECIMAL(20, 12) NOT NULL COMMENT 'Individual crypto daily volatility',
    `annualized_volatility` DECIMAL(20, 12) NOT NULL COMMENT 'Individual crypto annualized volatility',
    `market_cap_usd` DECIMAL(40, 8) NOT NULL COMMENT 'Market cap at time of calculation',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_pvol_constituents_pvol_idx` (`portfolio_volatility_id`) REFERENCES `portfolio_volatility`(`id`) ON DELETE CASCADE,
    FOREIGN KEY `fk_pvol_constituents_crypto_idx` (`crypto_id`) REFERENCES `cryptocurrencies`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_pvol_crypto` (`portfolio_volatility_id`, `crypto_id`),
    KEY `idx_crypto` (`crypto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;

SET FOREIGN_KEY_CHECKS = 1;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
