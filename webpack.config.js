import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (env, argv) => ({
  mode: argv.mode || 'development',
  entry: './src/client/app.ts',
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: 'bundle.js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.webpack.json'
          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  devServer: {
    port: 3000,
    hot: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  devtool: argv.mode === 'production' ? 'source-map' : 'cheap-module-source-map'
});
