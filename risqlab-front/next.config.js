/** @type {import('next').NextConfig} */

const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 's2.coinmarketcap.com',
                pathname: '/static/img/coins/**',
            },
        ],
    },
};

module.exports = nextConfig;
