/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/:path*` : 'http://localhost:8000/api/:path*',
      },
      {
        source: '/resource/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/resource/api/:path*` : 'http://localhost:8000/resource/api/:path*',
      },
      {
        source: '/academic/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/academic/api/:path*` : 'http://localhost:8000/academic/api/:path*',
      },
      {
        source: '/Genai/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/Genai/api/:path*` : 'http://localhost:8000/Genai/api/:path*',
      },
      {
        source: '/notice/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/notice/api/:path*` : 'http://localhost:8000/notice/api/:path*',
      }
    ]
  },
  images: {
    domains: ['localhost'],
  },
}

module.exports = nextConfig
