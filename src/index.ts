import { ChannelType, Client, GatewayIntentBits, Snowflake, VoiceBasedChannel, VoiceChannel } from 'discord.js';
import TwitterWrap from './tweet';
import fs from 'fs/promises';
import json from './json';

import env from './env';

const { 
    CHANNEL_ID, 
    GUILD_ID, 
    BOT_TOKEN,
    CONSUMER_KEY,
    CONSUMER_SECRET,
    ACCESS_TOKEN_KEY,
    ACCESS_TOKEN_SECRET
} = env.readenv();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ]
});

const wait= 60*0.2;
const interval = 60*2;
const processing = new Set();
let writing = {'id' : [0, 0],'speakers' : [0, 0],'intervalIDs' : [0, 0]};
const idJSON = new json('id');
const speakersJSON = new json('speakers');
const intervalIDsJSON = new json('intervalIDs');
let ids: Record<string, string>, speakers: Record<string, Array<any>>, intervalIDs: Record<string, number>;

const twitter = new TwitterWrap({
    consumer_key: CONSUMER_KEY,
    consumer_secret: CONSUMER_SECRET,
    access_token_key: ACCESS_TOKEN_KEY,
    access_token_secret: ACCESS_TOKEN_SECRET
  },wait);






// id.jsonのkeyに対応するメッセージが存在しない場合、そのkeyとvalueのペアを削除
async function clean(): Promise<void>{

    let channel = await client.guilds.fetch(GUILD_ID)
        .then(guild => guild.channels.fetch(CHANNEL_ID));
    
    if (channel?.isTextBased()) {
        for (let key in ids) {
            channel.messages.fetch(key)
                .catch(async e => {
                    if (e.httpStatus === 404) {
                        await twitter.delete(key,ids, writing);
                    };
                });
        };
        await idJSON.write(ids,writing);
    };
};

// ツイート対象かチェック
function check(channelId: Snowflake, cleanContent: string): boolean{
    return channelId == CHANNEL_ID && !cleanContent.startsWith('.');
};



// 人数チェック
async function checkVoiceChannelStatus(channelId: Snowflake): Promise<Array<number | null>>{
    let channel = await client.guilds.fetch(GUILD_ID)
        .then(guild => guild.channels.fetch(channelId));

    if (channel?.type !== ChannelType.GuildVoice && channel?.type !== ChannelType.GuildStageVoice) return [null, null];

    let bots = 0;
    let humans = 0;

    for (let [_, member] of channel.members){
        if (member.roles.botRole){
            bots += 1;
        } else {
            humans += 1;
        }
    };

    return [bots,humans]
};

// ボイチャの人数をツイート
async function postVoiceChannelStatus(channelName: string, channelId:string, bots: number, humans: number) {
    let tweet = twitter.voiceChannelFormat(channelName,bots,humans);
    await twitter.post([channelId,bots,humans],tweet,'voice channel',ids,speakers, writing);
}

// 最初の一人の入室時と最後の一人の退出時
async function firstAndLast(channelId: Snowflake, channel: VoiceBasedChannel): Promise<void>{
    await checkVoiceChannelStatus(channelId)
    .then(async ([bots,humans]) =>{
        if (bots !== null && humans !== null 
            && (!(channelId in speakers) 
                || speakers[channelId][0] !== bots 
                || speakers[channelId][1] !== humans)){
                    if (bots + humans === 0){
                        console.log('The last one has gone out from ' + channel.name + '.' )
                        clearInterval(intervalIDs[channelId]);
                        delete intervalIDs[channelId];
                        await postVoiceChannelStatus(channel.name,channelId,bots,humans);
                        await intervalIDsJSON.write(intervalIDs,writing);
                    }
                    if (!(channelId in speakers)  
                    || speakers[channelId][0] + speakers[channelId][1] === 0){
                        console.log('The first one has come into ' + channel.name + '.' )
                        intervalIDs[channelId]  = setInterval(async ()=>{
                            await everyInterval(channelId, channel);
                        }, 1000*interval)[Symbol.toPrimitive]();
                        await postVoiceChannelStatus(channel.name,channelId,bots,humans);
                        await intervalIDsJSON.write(intervalIDs,writing);
                    }
            }
        })
    };

// 30分毎
async function everyInterval(channelId: Snowflake, channel: VoiceBasedChannel): Promise<void>{
    await checkVoiceChannelStatus(channelId)
    .then(async ([bots,humans]) =>{
    if (bots !== null && humans !== null 
        && (!(channelId in speakers) 
            || speakers[channelId][0] !== bots 
            || speakers[channelId][1] !== humans)){
                await postVoiceChannelStatus(channel.name,channelId,bots,humans);
        }
    });
};

// 起動時
client.on('ready', async client => {
    console.log(`logged in as ${client.user.tag}`);
    ids = await idJSON.read();
    speakers = await speakersJSON.read();
    intervalIDs = await intervalIDsJSON.read();
    await clean();
});

// メッセージ投稿時
client.on('messageCreate', async msg => {
    let { id, createdAt, channelId, cleanContent } = msg;

    if (!check(channelId, cleanContent)) return;

    let tweet = twitter.msgFormat(createdAt, cleanContent);

    await twitter.post([id], tweet, 'msg', ids, speakers, writing);
});

// メッセージ編集時
client.on('messageUpdate', async (_, msg) => {    
    if (msg.partial) msg = await msg.fetch();

    let { channelId, id, cleanContent } = msg;

    if (check(channelId, cleanContent)) return;

    await twitter.delete(id, ids, writing);
});

// メッセージ削除時
client.on('messageDelete', async msg => {
    if (msg.partial) msg = await msg.fetch();

    let { channelId, id } = msg;

    if (channelId !== CHANNEL_ID) return;

    await twitter.delete(id, ids, writing);
});

// 音声状態の変化時
client.on('voiceStateUpdate', async (oldState, newState) =>{
    if (newState.channelId !== null && newState.channel !== null 
        && !processing.has(newState.channelId)){
            let channelId = newState.channelId;
            let channel = newState.channel;
            processing.add(channelId)
            setTimeout(async () => {    
                await firstAndLast(channelId,channel)
                processing.delete(channelId)
            },1000*wait);
    }
    if (oldState.channelId !== null && oldState.channel !== null
        && (newState.channelId === null || newState.channelId !== oldState.channelId) 
        && !processing.has(oldState.channelId)){
            let channelId = oldState.channelId;
            let channel = oldState.channel;
            processing.add(channelId)
            setTimeout(async () => {    
                await firstAndLast(channelId,channel)
                processing.delete(channelId)
            },1000*wait);
    }
});


client.login(BOT_TOKEN);