import Twitter from "twitter";
import { parseTweet } from "twitter-text";
import json from './json'

export default class TwitterWrap {
    twitter: Twitter;
    ids: json;
    speakers : json;
    constructor(credential: Twitter.AccessTokenOptions, wait: number) {
        this.twitter = new Twitter(credential);
        this.ids = new json('id');
        this.speakers = new json('speakers');
    }
    
    // ツイート成型
    msgFormat(createdAt: Date, cleanContent: string): string{
        let tweet = new Intl.DateTimeFormat('ja-JP', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tokyo'
        }).format(createdAt)
        + ' に書き込みがありました:\n'
        + cleanContent.replace(/<:.+?:\d+?>/g, '??').replace(/@/g, '＠').replace(/#/g,'#.');
    
        let result = parseTweet(tweet);
        while (!result.valid) {
            tweet = tweet.slice(0, -2) + '…';
            result = parseTweet(tweet);
        };
        return tweet;
    };

    voiceChannelFormat(channelName: string, bots: number, humans: number): string{
        const tweet = new Intl.DateTimeFormat('ja-JP', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Tokyo'
        }).format(Date.now())
        + '現在、ボイスチャンネル「'
        + channelName
        + '」には\n人間 '
        + humans
        + '人\nbot '
        + bots
        + '機\nがいます。';
        return tweet;
    }
    async idsUpdate(info: string, data: any, ids: Record<string, string>, writing: Record<string, Array<number>>){
        const id = info[0]
        ids[id] = data.id_str;
        await this.ids.write(ids,writing);
    }

    async speakersUpdate(info: Array<string | number>, speakers: Record<string, Array<any>>, writing: Record<string, Array<number>>){
        const [channelId, bots, humans] = info;
        speakers[channelId] = [bots, humans];
        await this.speakers.write(speakers,writing)
    }
    
    // ツイート投稿
    async post(info: any, tweet: string, tweetType: string, ids: Record<string,string>, speakers: Record<string, Array<number>>, writing: Record<string, Array<number>>): Promise<void>{
        this.twitter.post('statuses/update', { status: tweet }, async (e, data) => {
            if (e) console.error(e);
            else {
                if (tweetType === 'msg'){
                    await this.idsUpdate(info,data,ids,writing);
                } else if (tweetType === 'voice channel'){
                    await this.speakersUpdate(info,speakers,writing);
                }
            };
        });
    }
    
    // ツイート削除
    async delete(id: string, ids: Record<string, string>, writing: Record<string, Array<number>>): Promise<void> {
        if (!(id in ids)) return;
    
        this.twitter.post('statuses/destroy', { id: ids[id] }, async e => {
            if (e) console.error(e);
            else {
                delete ids[id];
                await this.ids.write(ids,writing);
            };
        });
    }
}