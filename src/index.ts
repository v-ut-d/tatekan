import {
  ChannelType,
  Client,
  Collection,
  GatewayIntentBits,
  Snowflake,
  VoiceBasedChannel,
} from 'discord.js';
import TwitterWrap from './tweet';
import { IdJson, SpeakerCount, SpeakerCountJson } from './json';

import { env } from './env';

const {
  CHANNEL_ID,
  GUILD_ID,
  BOT_TOKEN,
  CONSUMER_KEY,
  CONSUMER_SECRET,
  ACCESS_TOKEN_KEY,
  ACCESS_TOKEN_SECRET,
} = env;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

const wait = 60 * 0.2;
const interval = 60 * 2;
const processing = new Set();

const idJson = await IdJson.create();
const speakersJson = await SpeakerCountJson.create();

const intervals = new Collection<string, NodeJS.Timer>(); //key: channelId, value: interval

const twitter = new TwitterWrap({
  consumer_key: CONSUMER_KEY,
  consumer_secret: CONSUMER_SECRET,
  access_token_key: ACCESS_TOKEN_KEY,
  access_token_secret: ACCESS_TOKEN_SECRET,
});

// id.jsonのkeyに対応するメッセージが存在しない場合、そのkeyとvalueのペアを削除
async function clean(): Promise<void> {
  const channel = await client.guilds
    .fetch(GUILD_ID)
    .then(async (guild) => guild.channels.fetch(CHANNEL_ID));

  if (channel?.isTextBased()) {
    for (const [discordMessageId, tweetId] of idJson.data.entries()) {
      await channel.messages.fetch(discordMessageId).catch(async (e) => {
        if ((e as { httpStatus?: number }).httpStatus === 404) {
          await twitter.delete(tweetId);
          idJson.data.delete(discordMessageId);
        }
      });
    }
    idJson.write();
  }
}

// ツイート対象かチェック
function check(channelId: Snowflake, cleanContent: string): boolean {
  return channelId == CHANNEL_ID && !cleanContent.startsWith('.');
}

// 人数チェック
async function checkVoiceChannelStatus(
  channelId: Snowflake
): Promise<SpeakerCount | null> {
  const channel = await client.guilds
    .fetch(GUILD_ID)
    .then(async (guild) => guild.channels.fetch(channelId));

  if (
    channel?.type !== ChannelType.GuildVoice &&
    channel?.type !== ChannelType.GuildStageVoice
  )
    return null;

  let bots = 0;
  let humans = 0;

  for (const [, member] of channel.members) {
    if (member.roles.botRole) {
      bots += 1;
    } else {
      humans += 1;
    }
  }

  return { bots, humans };
}

// ボイチャの人数をツイート
async function postVoiceChannelStatus(
  channelName: string,
  channelId: string,
  bots: number,
  humans: number
): Promise<void> {
  const tweet = TwitterWrap.voiceChannelFormat(channelName, bots, humans);
  await twitter.post(tweet);
  speakersJson.data.set(channelId, { bots, humans });
  speakersJson.write();
}

// 最初の一人の入室時と最後の一人の退出時
async function firstAndLast(
  channelId: Snowflake,
  channel: VoiceBasedChannel
): Promise<void> {
  const currentState = await checkVoiceChannelStatus(channelId);
  if (!currentState) return;

  const previousState = speakersJson.data.get(channelId);

  if (
    !previousState ||
    previousState.bots !== currentState.bots ||
    previousState.humans !== currentState.humans
  ) {
    if (currentState.bots + currentState.humans === 0) {
      console.log('The last one has gone out from ' + channel.name + '.');
      clearInterval(intervals.get(channelId));
      intervals.delete(channelId);
      await postVoiceChannelStatus(
        channel.name,
        channelId,
        currentState.bots,
        currentState.humans
      );
    }
    if (previousState && previousState.bots + previousState.humans === 0) {
      console.log('The first one has come into ' + channel.name + '.');
      const intervalId = setInterval(() => {
        everyInterval(channelId, channel).catch((e) => console.error(e));
      }, 1000 * interval);
      intervals.set(channelId, intervalId);
      await postVoiceChannelStatus(
        channel.name,
        channelId,
        currentState.bots,
        currentState.humans
      );
    }
  }
}

// 30分毎
async function everyInterval(
  channelId: Snowflake,
  channel: VoiceBasedChannel
): Promise<void> {
  const currentState = await checkVoiceChannelStatus(channelId);
  if (!currentState) return;

  const previousState = speakersJson.data.get(channelId);
  if (
    !previousState ||
    previousState.bots !== currentState.bots ||
    previousState.humans !== currentState.humans
  ) {
    await postVoiceChannelStatus(
      channel.name,
      channelId,
      currentState.bots,
      currentState.humans
    );
  }
}

// 起動時
client.on('ready', async (client) => {
  console.log(`logged in as ${client.user.tag}`);
  await clean();
});

// メッセージ投稿時
client.on('messageCreate', async (msg) => {
  const { id, createdAt, channelId, cleanContent } = msg;

  if (!check(channelId, cleanContent)) return;

  const tweet = TwitterWrap.msgFormat(createdAt, cleanContent);

  const tweetId = await twitter.post(tweet);

  idJson.data.set(id, tweetId);
  idJson.write();
});

// メッセージ編集時
client.on('messageUpdate', async (_, msg) => {
  if (msg.partial) msg = await msg.fetch();

  const { channelId, id, cleanContent } = msg;

  if (check(channelId, cleanContent)) return;

  const tweetId = idJson.data.get(id);
  idJson.data.delete(id);

  if (tweetId) await twitter.delete(tweetId);

  idJson.write();
});

// メッセージ削除時
client.on('messageDelete', async (msg) => {
  if (msg.partial) msg = await msg.fetch();

  const { channelId, id } = msg;

  if (channelId !== CHANNEL_ID) return;

  const tweetId = idJson.data.get(id);
  idJson.data.delete(id);

  if (tweetId) await twitter.delete(tweetId);

  idJson.write();
});

// 音声状態の変化時
client.on('voiceStateUpdate', (oldState, newState) => {
  if (
    newState.channelId !== null &&
    newState.channel !== null &&
    !processing.has(newState.channelId)
  ) {
    const channelId = newState.channelId;
    const channel = newState.channel;
    processing.add(channelId);
    setTimeout(() => {
      firstAndLast(channelId, channel)
        .then(() => processing.delete(channelId))
        .catch((e) => console.error(e));
    }, 1000 * wait);
  }
  if (
    oldState.channelId !== null &&
    oldState.channel !== null &&
    (newState.channelId === null ||
      newState.channelId !== oldState.channelId) &&
    !processing.has(oldState.channelId)
  ) {
    const channelId = oldState.channelId;
    const channel = oldState.channel;
    processing.add(channelId);
    setTimeout(() => {
      firstAndLast(channelId, channel)
        .then(() => processing.delete(channelId))
        .catch((e) => console.error(e));
    }, 1000 * wait);
  }
});

await client.login(BOT_TOKEN);
