const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = [
  new ForkTsCheckerWebpackPlugin(),
  new CopyPlugin({
    patterns: [
        {
            from: path.join(__dirname, 'src/assets'),
            to: 'assets/',
        },{
            from: path.join(__dirname, 'src/assets'),
            to: 'main_window/assets/',
        },
        {
            from: path.join(__dirname, 'src/plugins/backend/www/'),
            to: 'stream_ui/',
        },
        // {
        //     from: path.join(__dirname, '.webpack/main/webui.js'),
        //     to: 'stream_ui/webui.js',
        // },

        {
            from: path.join(__dirname, 'node_modules/xbox-xcloud-player/src/Opus'),
            to: 'opus/',
        },{
            from: path.join(__dirname, 'node_modules/xbox-xcloud-player/src/Opus'),
            to: 'main_window/opus/',
        },
        {
            from: path.join(__dirname, 'node_modules/xbox-xcloud-player/src/Worker/Opus.js'),
            to: 'dist/opusWorker.min.js',
        },{
            from: path.join(__dirname, 'node_modules/xbox-xcloud-player/src/Worker/Opus.js'),
            to: 'main_window/dist/opusWorker.min.js',
        },
    ],
}),
];
