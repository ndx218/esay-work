/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true // 若你也用了 styled-components
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'your.cdn.com', // ✅ 替換成你實際使用的圖檔來源
      },
    ],
  },
  i18n: {
    locales: ['zh-TW', 'zh-CN'],
    defaultLocale: 'zh-TW'
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*'
      }
    ]
  }
}

module.exports = nextConfig
