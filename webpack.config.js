import path from 'path';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'production',
  target: 'node',
  entry: './src/main.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    modules: ['node_modules'],
  },
  optimization: {
    minimize: false,
    nodeEnv: 'production',
  },
  experiments: {
    topLevelAwait: true,
  },
  output: {
    filename: 'main.cjs',
    path: path.resolve(process.cwd(), 'dist'),
    iife: false,
  },
};
