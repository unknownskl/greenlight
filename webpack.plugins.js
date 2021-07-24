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
    ],
}),
];
