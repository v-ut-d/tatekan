import dotenv from 'dotenv';

dotenv.config();

interface Environment {
  CONSUMER_KEY: string;
  CONSUMER_SECRET: string;
  ACCESS_TOKEN_KEY: string;
  ACCESS_TOKEN_SECRET: string;
  BOT_TOKEN: string;
  GUILD_ID: string;
  CHANNEL_ID: string;
}

function readenv(): Environment {
  const nexists = [
    'CONSUMER_KEY',
    'CONSUMER_SECRET',
    'ACCESS_TOKEN_KEY',
    'ACCESS_TOKEN_SECRET',
    'BOT_TOKEN',
    'GUILD_ID',
    'CHANNEL_ID',
  ].filter((name) => process.env[name] === undefined);

  if (nexists.length === 0) {
    return {
      CONSUMER_KEY: process.env['CONSUMER_KEY'] ?? '',
      CONSUMER_SECRET: process.env['CONSUMER_SECRET'] ?? '',
      ACCESS_TOKEN_KEY: process.env['ACCESS_TOKEN_KEY'] ?? '',
      ACCESS_TOKEN_SECRET: process.env['ACCESS_TOKEN_SECRET'] ?? '',
      BOT_TOKEN: process.env['BOT_TOKEN'] ?? '',
      GUILD_ID: process.env['GUILD_ID'] ?? '',
      CHANNEL_ID: process.env['CHANNEL_ID'] ?? '',
    };
  } else {
    throw new Error(
      `Cannot find environment variable(s): ${nexists.join(', ')}`
    );
  }
}

export default {
  readenv,
};
