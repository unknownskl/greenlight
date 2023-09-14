module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // config.target = 'electron-renderer';
      config.target = 'web';
    }

    return config;
  },
};
