const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const fs = require('fs');

const isDevelopment = process.env.NODE_ENV !== 'production';

// Serve HTTPS on mutesky.app in development only when the local mkcert files
// exist; otherwise fall back to plain-HTTP localhost so dev still works
const useHttps = isDevelopment
    && fs.existsSync('mutesky.app+3-key.pem')
    && fs.existsSync('mutesky.app+3.pem');

const devServerConfig = {
    static: {
        directory: path.join(__dirname, '/'),
        publicPath: '/'
    },
    port: useHttps ? 443 : 8080,
    hot: true,
    host: useHttps ? 'mutesky.app' : 'localhost',
    open: {
        target: [useHttps ? 'https://mutesky.app' : 'http://localhost:8080']
    },
    devMiddleware: {
        publicPath: '/'
    },
    historyApiFallback: true
};

if (useHttps) {
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
        extensions: ['.js']
    },
    plugins: [
        new webpack.ProvidePlugin({
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
