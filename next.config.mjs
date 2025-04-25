/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false

    // Add WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
      layers: true,
    }

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    })

    // Important: Mark WASM files as async chunks
    config.output.webassemblyModuleFilename =
      (isServer ? '../' : '') + 'static/wasm/[modulehash].wasm'

    return config
  },
  // Add transpilation for problematic packages
  transpilePackages: ['@emurgo/cardano-serialization-lib-asmjs'],
  // Disable server-side rendering for WASM-dependent features
  serverExternalPackages: ['@lucid-evolution', '@anastasia-labs/cardano-multiplatform-lib-browser'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    ppr: 'incremental',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: '*.pinata.cloud',
        port: '',
      },
      {
        protocol: 'https',
        hostname: '*.mypinata.cloud',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'edamam-product-images.s3.amazonaws.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'abs-0.twimg.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'blog.iagon.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
    ],
  },
  reactStrictMode: false,
}

export default nextConfig
