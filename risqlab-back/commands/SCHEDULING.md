# Data Orchestration & Scheduling

This document outlines the strategy for scheduling the data fetching and processing scripts to maximize data freshness while staying within the CoinMarketCap API limit of 10,000 credits per month.

## API Credit Cost Analysis

Each call to a CoinMarketCap API endpoint costs at least 1 credit. Based on the project's scripts, the cost breakdown is as follows:

1.  **`fetchCryptoMarketData.js`**: This is the most credit-intensive script. As calculated, running it every 5 minutes consumes **8,640 credits/month**.
    *   `(60 min / 5 min) * 24 hours * 30 days = 8,640 calls`

2.  **`calculateRisqLab80.js`** & **`updateVolatility.js`**: These scripts perform internal calculations on the local database. They make **no external API calls** and therefore consume no credits.

3.  **`fetchGlobalMetrics.js`**: This script fetches global metrics (e.g., BTC dominance). It consumes **1 credit per call**.

4.  **`fetchFearAndGreed.js`**: This script fetches the Fear and Greed Index. It consumes **1 credit per call**.

5.  **`fetchCryptoMetadata.js`**: This script fetches metadata (logos, descriptions, links) for all cryptocurrencies in the database. The cost depends on the number of assets, but it's typically low (**~2-4 credits** per full run). This data changes very infrequently.

## Optimized Scheduling Strategy

With 8,640 credits already allocated to the main data pipeline, we have **1,360 credits** remaining to distribute for other tasks.

Here is the proposed strategy to optimize data freshness without exceeding the monthly budget:

| Task | Frequency | Monthly Cost (Credits) | Justification |
| :--- | :--- | :--- | :--- |
| **Main Pipeline** | Every 5 minutes | **8,640** | Ensures maximum freshness for market data, which is the core of the application. |
| **Global Metrics** | Every 45 minutes | **~960** | This data (dominance, total market cap) is important but less volatile than prices. A 45-minute interval is an excellent trade-off. |
| **Fear & Greed Index** | Twice a day | **60** | The index is typically updated once daily. Fetching it twice (e.g., noon and midnight) ensures the latest value is captured without wasting credits. |
| **Crypto Metadata** | Once a week | **~15** | Project logos, descriptions, and websites almost never change. A weekly update is more than sufficient. |
| **Total Estimated** | | **~9,675 credits/month** | |

This plan uses approximately 97% of the monthly quota, leaving a small buffer for safety while ensuring high data freshness where it matters most.

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

# 1. Main Pipeline: Fetch market data, then calculate the index and volatility.
#    Runs every 5 minutes.
*/5 * * * * cd /home/ubuntu/risqlab/risqlab/risqlab-back && node commands/fetchCryptoMarketData.js && node commands/calculateRisqLab80.js && node commands/updateVolatility.js

# 2. Global Metrics: Fetch BTC/ETH dominance, total market cap, etc.
#    Runs every 45 minutes.
*/45 * * * * cd /home/ubuntu/risqlab/risqlab/risqlab-back && node commands/fetchGlobalMetrics.js

# 3. Fear & Greed Index:
#    Runs twice a day, at 00:05 and 12:05 (5 minutes past midnight and noon).
5 0,12 * * * cd /home/ubuntu/risqlab/risqlab/risqlab-back && node commands/fetchFearAndGreed.js

# 4. Crypto Metadata (logos, descriptions, etc.):
#    Runs once a week, on Sunday at 3:05 AM.
5 3 * * 0 cd /home/ubuntu/risqlab/risqlab/risqlab-back && node commands/fetchCryptoMetadata.js
```

### Crontab Notes:

*   `cd /home/ubuntu/risqlab/risqlab/risqlab-back`: This command is critical. It ensures that the scripts run from the correct directory, allowing them to resolve local dependencies (`.env`, `utils`, etc.).
*   `&&`: This operator chains commands. The next command only executes if the previous one succeeds. This is ideal for the main pipeline.
*   The execution times for less frequent jobs are slightly offset (e.g., `5 0,12 * * *`) to prevent them from running at the exact same time as the main pipeline, which helps distribute the system load.