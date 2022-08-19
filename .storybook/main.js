module.exports = {
  "stories": [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)"
  ],
  "addons": [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions"
  ],
  "framework": "@storybook/react",
  "core": {
    "builder": "@storybook/builder-webpack5"
  },
  webpackFinal: async (config, { configType }) => {
    config.resolve = {
        ...config.resolve,
        fallback: {
            ...(config.resolve || {}).fallback,
            fs: false,
            stream: false,
            os: false,
        },
    }

    // Return the altered config
    return config
  },
}