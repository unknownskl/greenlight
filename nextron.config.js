module.exports = {
    // // specify an alternate main src directory, defaults to 'main'
    // mainSrcDir: 'main',
    // // specify an alternate renderer src directory, defaults to 'renderer'
    // rendererSrcDir: 'renderer',
  
    // main process' webpack config
    webpack: (config, env) => {
        config.module.rules.push({
            test: /\.node$/,
            loader: "node-loader",
        })
        return config;
    },
  };