# Data Orchestration & Scheduling

This document outlines the strategy for scheduling the data fetching and processing scripts to maximize data freshness while staying within the CoinMarketCap API limit of 10,000 credits per month.

## API Credit Cost Analysis

Each call to a CoinMarketCap API endpoint costs at least 1 credit. Based on the project's scripts, the cost breakdown is as follows:

1.  **`fetchCryptoMarketData.js`**: This is the most credit-intensive script. As calculated, running it every 15 minutes consumes **8,640 credits/month**.
    *   `(60 min / 15 min) * 24 hours * 30 days = 2,880 calls`
    *   `2,880 calls * 3 credits = 8,640 credits`

2.  **`calculateRisqLab80.js`**: This script performs internal calculations on the local database to compute the RisqLab80 index. It makes **no external API calls** and therefore consumes no credits.

3.  **`updateVolatility.js`**: This script calculates the volatility for crypto assets and portfolios based on historical data in the database. It makes **no external API calls** and consumes no credits. Given the computational nature of volatility (which requires historical price data), it is scheduled to run **once per day at midnight** rather than every 15 minutes.

4.  **`fetchGlobalMetrics.js`**: This script fetches global metrics (e.g., BTC dominance). It consumes **1 credit per call**.

5.  **`fetchFearAndGreed.js`**: This script fetches the Fear and Greed Index. It consumes **1 credit per call**.

6.  **`fetchCryptoMetadata.js`**: This script fetches metadata (logos, descriptions, links) for all cryptocurrencies in the database. The cost depends on the number of assets, but it's typically low (**~5 credits** per full run). This data changes very infrequently.

## Optimized Scheduling Strategy

With 8,640 credits already allocated to the main data pipeline, we have **1,360 credits** remaining to distribute for other tasks.

Here is the proposed strategy to optimize data freshness without exceeding the monthly budget:

| Task | Frequency | Monthly Cost (Credits) | Justification |
| :--- | :--- | :--- | :--- |
| **Main Pipeline** (Market Data + Index) | Every 15 minutes | **8,640** | Ensures maximum freshness for market data and the RisqLab80 index, which are the core of the application. |
| **Volatility Update** | Once a day (midnight) | **0** | Volatility calculations are computationally intensive and based on historical data. Daily updates are sufficient for this metric. No API calls required. |
| **Global Metrics** | Every 45 minutes | **~960** | This data (dominance, total market cap) is important but less volatile than prices. A 45-minute interval is an excellent trade-off. |
| **Fear & Greed Index** | Every 3 hours | **240** | The index provides real-time market sentiment. Fetching it 8 times daily ensures consistent updates throughout the day while staying within budget. |
| **Crypto Metadata** | Once a week | **~20** | Project logos, descriptions, and websites almost never change. A weekly update is more than sufficient. |
| **Total Estimated** | | **~9,860 credits/month** | |

This plan uses approximately 98.6% of the monthly quota, leaving a small buffer (~140 credits) for safety while ensuring high data freshness where it matters most.

## Crontab Configuration for Ubuntu

To implement this schedule, open your crontab file by running `crontab -e` in your Ubuntu terminal and add the following content.

**Important:** The paths below are configured for the project located at `/home/ubuntu/risqlab/risqlab`.

```cron
# =================================================================
# RisqLab Crypto Dashboard - CRON Jobs
# =================================================================
#
# Note: Ensure 'node' is in the cron user's PATH, or specify the full
# path (e.g., /usr/bin/node).
#
# For debugging, you can redirect output to a log file:
# >> /home/ubuntu/risqlab/risqlab/risqlab-back/log/cron.log 2>&1
#

# 1. Main Pipeline: Fetch market data and calculate the RisqLab80 index.
#    Runs every 15 minutes.
*/15 * * * * cd /home/ubuntu/risqlab/risqlab/risqlab-back && node commands/fetchCryptoMarketData.js && node commands/calculateRisqLab80.js

# 2. Volatility Update: Calculate crypto and portfolio volatility.
#    Runs once a day at 00:10 (10 minutes past midnight).
10 0 * * * cd /home/ubuntu/risqlab/risqlab/risqlab-back && node commands/updateVolatility.js

# 3. Global Metrics: Fetch BTC/ETH dominance, total market cap, etc.
#    Runs every 45 minutes.
*/45 * * * * cd /home/ubuntu/risqlab/risqlab/risqlab-back && node commands/fetchGlobalMetrics.js

# 4. Fear & Greed Index:
#    Runs every 3 hours (8 times per day: 0h, 3h, 6h, 9h, 12h, 15h, 18h, 21h).
0 */3 * * * cd /home/ubuntu/risqlab/risqlab/risqlab-back && node commands/fetchFearAndGreed.js

# 5. Crypto Metadata (logos, descriptions, etc.):
#    Runs once a week, on Sunday at 3:05 AM.
5 3 * * 0 cd /home/ubuntu/risqlab/risqlab/risqlab-back && node commands/fetchCryptoMetadata.js
```

### Crontab Notes:

*   `cd /home/ubuntu/risqlab/risqlab/risqlab-back`: This command is critical. It ensures that the scripts run from the correct directory, allowing them to resolve local dependencies (`.env`, `utils`, etc.).
*   `&&`: This operator chains commands. The next command only executes if the previous one succeeds. This is ideal for the main pipeline.
*   The execution times for less frequent jobs are slightly offset to prevent them from running at the exact same time as the main pipeline, which helps distribute the system load.

### Alternative Configuration for Fear & Greed Index

If you want to reduce API credit consumption slightly, you can use a 4-hour interval instead:

```cron
# Alternative: Fear & Greed Index every 4 hours (6 times per day)
# Cost: ~180 credits/month (saves 60 credits compared to 3-hour interval)
0 */4 * * * cd /home/ubuntu/risqlab/risqlab/risqlab-back && node commands/fetchFearAndGreed.js
```

This would bring the total monthly cost to **~9,800 credits** (98%), leaving 200 credits as a buffer.