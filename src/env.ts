import readenv from '@cm-ayf/readenv';

if (process.env['NODE_ENV'] !== 'production')
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  require('dotenv').config();

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
