module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // config.target = 'electron-renderer';
      config.target = 'web';
    }

    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'store-images.s-microsoft.com',
      },
    ],
  }
};
