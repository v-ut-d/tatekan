import {
  Client,
  Collection,
  GatewayIntentBits,
  Snowflake,
  VoiceBasedChannel,
} from 'discord.js';

import { setTimeout } from 'timers/promises';

import TwitterWrap from './tweet';
import { SpeakerCount, SpeakerCountJson } from './data/SpeakerCount';
import { IdJson } from './data/Id';

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

const wait = 60 * 1;
const interval = 60 * 10;
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
    for (const [discordMessageId, tweetId] of idJson.data) {
      await channel.messages.fetch(discordMessageId).catch(async (e) => {
        if ((e as { status?: number }).status === 404) {
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
function checkVoiceChannelStatus(channel: VoiceBasedChannel): SpeakerCount {
  let bots = 0;
  let humans = 0;

  for (const [, member] of channel.members) {
    if (member.roles.botRole) {
      bots += 1;
    } else {
      humans += 1;
    }
  }

  return new SpeakerCount({
    bots,
    humans,
  });
}

// ボイチャの人数をツイート
async function postVoiceChannelStatus(
  channelName: string,
  channelId: string,
  speakerCount: SpeakerCount
): Promise<void> {
  const tweet = TwitterWrap.voiceChannelFormat(channelName, speakerCount);
  await twitter.post(tweet);
  speakersJson.data.set(channelId, speakerCount);
  speakersJson.write();
}

// 最初の一人の入室時と最後の一人の退出時
async function firstAndLast(channel: VoiceBasedChannel): Promise<void> {
  const currentState = checkVoiceChannelStatus(channel);

  const previousState = speakersJson.data.get(channel.id);

  if (!previousState || !currentState.equals(previousState)) {
    if (!previousState || previousState.total === 0) {
      console.log('The first one has come into ' + channel.name + '.');
      const intervalId = setInterval(() => {
        everyInterval(channel).catch((e) => console.error(e));
      }, 1000 * interval);
      intervals.set(channel.id, intervalId);
      await postVoiceChannelStatus(channel.name, channel.id, currentState);
    }
    if (currentState.total === 0) {
      console.log('The last one has gone out from ' + channel.name + '.');
      clearInterval(intervals.get(channel.id));
      intervals.delete(channel.id);
      await postVoiceChannelStatus(channel.name, channel.id, currentState);
    }
  }
}

// 30分毎
async function everyInterval(channel: VoiceBasedChannel): Promise<void> {
  const currentState = checkVoiceChannelStatus(channel);

  const previousState = speakersJson.data.get(channel.id);
  if (!previousState || !currentState.equals(previousState)) {
    await postVoiceChannelStatus(channel.name, channel.id, currentState);
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
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.channel !== null && !processing.has(newState.channelId)) {
    const channel = newState.channel;
    processing.add(channel.id);
    await setTimeout(1000 * wait);
    await firstAndLast(channel);
    processing.delete(channel.id);
  }
  if (
    oldState.channel !== null &&
    (newState.channelId === null ||
      newState.channelId !== oldState.channelId) &&
    !processing.has(oldState.channelId)
  ) {
    const channel = oldState.channel;
    processing.add(channel.id);
    await setTimeout(1000 * wait);
    await firstAndLast(channel);
    processing.delete(channel.id);
  }
});

await client.login(BOT_TOKEN);
