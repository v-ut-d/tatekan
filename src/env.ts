import readenvOrig from '@cm-ayf/readenv';

const readenv =
  typeof readenvOrig === 'function'
    ? readenvOrig
    : (readenvOrig as { default: typeof readenvOrig }).default;

if (process.env['NODE_ENV'] !== 'production') {
  const dotenv = await import('dotenv');
  dotenv.config();
}

/**
 * environment variables that are in use; always load from here
 */
export const env = readenv({
  CONSUMER_KEY: {},
  CONSUMER_SECRET: {},
  ACCESS_TOKEN_KEY: {},
  ACCESS_TOKEN_SECRET: {},
  BOT_TOKEN: {},
  GUILD_ID: {},
  CHANNEL_ID: {},
  production: {
    from: 'NODE_ENV',
    default: false,
    parse: (s) => s === 'production',
  },
});
