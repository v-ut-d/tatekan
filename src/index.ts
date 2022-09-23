import {
  ChannelType,
  Client,
  GatewayIntentBits,
  Snowflake,
  VoiceBasedChannel,
} from 'discord.js';
import TwitterWrap from './tweet';
import json from './json';

import env from './env';

const {
  CHANNEL_ID,
  GUILD_ID,
  BOT_TOKEN,
  CONSUMER_KEY,
  CONSUMER_SECRET,
  ACCESS_TOKEN_KEY,
  ACCESS_TOKEN_SECRET,
} = env.readenv();

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
const writing = { id: [0, 0], speakers: [0, 0], intervalIDs: [0, 0] };
const idJSON = new json('id');
const speakersJSON = new json('speakers');
const intervalIDsJSON = new json('intervalIDs');
let ids: Record<string, string>,
  speakers: Record<string, any[]>,
  intervalIDs: Record<string, number>;

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
    for (const key in ids) {
      channel.messages.fetch(key).catch((e) => {
        if ((e as { httpStatus?: number }).httpStatus === 404) {
          twitter.delete(key, ids, writing);
        }
      });
    }
    await idJSON.write(ids, writing);
  }
}

// ツイート対象かチェック
function check(channelId: Snowflake, cleanContent: string): boolean {
  return channelId == CHANNEL_ID && !cleanContent.startsWith('.');
}

// 人数チェック
async function checkVoiceChannelStatus(
  channelId: Snowflake
): Promise<(number | null)[]> {
  const channel = await client.guilds
    .fetch(GUILD_ID)
    .then(async (guild) => guild.channels.fetch(channelId));

  if (
    channel?.type !== ChannelType.GuildVoice &&
    channel?.type !== ChannelType.GuildStageVoice
  )
    return [null, null];

  let bots = 0;
  let humans = 0;

  for (const [_, member] of channel.members) {
    if (member.roles.botRole) {
      bots += 1;
    } else {
      humans += 1;
    }
  }

  return [bots, humans];
}

// ボイチャの人数をツイート
function postVoiceChannelStatus(
  channelName: string,
  channelId: string,
  bots: number,
  humans: number
): void {
  const tweet = twitter.voiceChannelFormat(channelName, bots, humans);
  twitter.post(
    [channelId, bots, humans],
    tweet,
    'voice channel',
    ids,
    speakers,
    writing
  );
}

// 最初の一人の入室時と最後の一人の退出時
async function firstAndLast(
  channelId: Snowflake,
  channel: VoiceBasedChannel
): Promise<void> {
  await checkVoiceChannelStatus(channelId).then(async ([bots, humans]) => {
    if (
      bots &&
      humans &&
      (!(channelId in speakers) ||
        speakers[channelId]?.[0] !== bots ||
        speakers[channelId]?.[1] !== humans)
    ) {
      if (bots + humans === 0) {
        console.log('The last one has gone out from ' + channel.name + '.');
        clearInterval(intervalIDs[channelId]);
        delete intervalIDs[channelId];
        postVoiceChannelStatus(channel.name, channelId, bots, humans);
        await intervalIDsJSON.write(intervalIDs, writing);
      }
      const speakerCount = speakers[channelId] as [number, number] | undefined;
      if (
        !(channelId in speakers) ||
        (speakerCount && speakerCount[0] + speakerCount[1] === 0)
      ) {
        console.log('The first one has come into ' + channel.name + '.');
        intervalIDs[channelId] = setInterval(() => {
          everyInterval(channelId, channel).catch((e) => console.error(e));
        }, 1000 * interval)[Symbol.toPrimitive]();
        postVoiceChannelStatus(channel.name, channelId, bots, humans);
        await intervalIDsJSON.write(intervalIDs, writing);
      }
    }
  });
}

// 30分毎
async function everyInterval(
  channelId: Snowflake,
  channel: VoiceBasedChannel
): Promise<void> {
  await checkVoiceChannelStatus(channelId).then(([bots, humans]) => {
    if (
      bots &&
      humans &&
      (!(channelId in speakers) ||
        speakers[channelId]?.[0] !== bots ||
        speakers[channelId]?.[1] !== humans)
    ) {
      postVoiceChannelStatus(channel.name, channelId, bots, humans);
    }
  });
}

// 起動時
client.on('ready', async (client) => {
  console.log(`logged in as ${client.user.tag}`);
  ids = await idJSON.read();
  speakers = await speakersJSON.read();
  intervalIDs = await intervalIDsJSON.read();
  await clean();
});

// メッセージ投稿時
client.on('messageCreate', (msg) => {
  const { id, createdAt, channelId, cleanContent } = msg;

  if (!check(channelId, cleanContent)) return;

  const tweet = twitter.msgFormat(createdAt, cleanContent);

  twitter.post([id], tweet, 'msg', ids, speakers, writing);
});

// メッセージ編集時
client.on('messageUpdate', async (_, msg) => {
  if (msg.partial) msg = await msg.fetch();

  const { channelId, id, cleanContent } = msg;

  if (check(channelId, cleanContent)) return;

  twitter.delete(id, ids, writing);
});

// メッセージ削除時
client.on('messageDelete', async (msg) => {
  if (msg.partial) msg = await msg.fetch();

  const { channelId, id } = msg;

  if (channelId !== CHANNEL_ID) return;

  twitter.delete(id, ids, writing);
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
