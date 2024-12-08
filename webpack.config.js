const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const fs = require('fs');

const isDevelopment = process.env.NODE_ENV !== 'production';

const devServerConfig = {
    static: {
        directory: path.join(__dirname, '/'),
        publicPath: '/'
    },
    port: 443,
    hot: true,
    host: 'mutesky.app',
    open: {
        target: ['https://mutesky.app']
    },
    devMiddleware: {
        publicPath: '/'
    },
    historyApiFallback: true
};

// Only add HTTPS configuration in development mode
if (isDevelopment) {
    devServerConfig.server = {
        type: 'https',
        options: {
            key: fs.readFileSync('mutesky.app+3-key.pem'),
            cert: fs.readFileSync('mutesky.app+3.pem')
        }
    };
}

module.exports = {
    mode: isDevelopment ? 'development' : 'production',
    entry: {
        main: './js/main.js'
    },
    output: {
        filename: 'js/bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/',
        clean: {
            keep: /\.git/
        }
    },
    devServer: devServerConfig,
    resolve: {
        extensions: ['.js'],
        fallback: {
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "buffer": require.resolve("buffer/"),
            "util": require.resolve("util/"),
            "path": false,
            "fs": false
        }
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process/browser',
            blueskyService: ['./js/bluesky.js', 'blueskyService']
        }),
        new CopyPlugin({
            patterns: [
                { from: "index.html" },
                { from: "css", to: "css" },
                { from: "js", to: "js", globOptions: { ignore: ['**/main.js'] } },
                { from: "CNAME" },
                { from: "favicon.ico" },
                { from: "images", to: "images" },
                { from: "client-metadata.json" },
                { from: "callback.html" }
            ]
        })
    ]
}
