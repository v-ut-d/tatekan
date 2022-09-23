import Twitter from 'twitter';
import { parseTweet } from 'twitter-text';
import json from './json';

export default class TwitterWrap {
  private readonly twitter: Twitter;
  private readonly ids: json;
  private readonly speakers: json;
  public constructor(credential: Twitter.AccessTokenOptions) {
    this.twitter = new Twitter(credential);
    this.ids = new json('id');
    this.speakers = new json('speakers');
  }

  // ツイート成型
  public msgFormat(createdAt: Date, cleanContent: string): string {
    let tweet =
      new Intl.DateTimeFormat('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo',
      }).format(createdAt) +
      ' に書き込みがありました:\n' +
      cleanContent
        .replace(/<:.+?:\d+?>/g, '??')
        .replace(/@/g, '＠')
        .replace(/#/g, '#.');

    let result = parseTweet(tweet);
    while (!result.valid) {
      tweet = tweet.slice(0, -2) + '…';
      result = parseTweet(tweet);
    }
    return tweet;
  }

  public voiceChannelFormat(
    channelName: string,
    bots: number,
    humans: number
  ): string {
    const tweet =
      new Intl.DateTimeFormat('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Tokyo',
      }).format(Date.now()) +
      '現在、ボイスチャンネル「' +
      channelName +
      '」には\n人間 ' +
      humans.toString() +
      '人\nbot ' +
      bots.toString() +
      '機\nがいます。';
    return tweet;
  }
  public async idsUpdate(
    info: string,
    data: any,
    ids: Record<string, string>,
    writing: Record<string, number[]>
  ): Promise<void> {
    const id = info[0];
    if (!id) throw new Error('Undefined id is forbidden');
    ids[id] = (data as { id_str: string }).id_str;
    await this.ids.write(ids, writing);
  }

  public async speakersUpdate(
    info: [string, number, number],
    speakers: Record<string, any[]>,
    writing: Record<string, number[]>
  ): Promise<void> {
    const [channelId, bots, humans] = info;
    speakers[channelId] = [bots, humans];
    await this.speakers.write(speakers, writing);
  }

  // ツイート投稿
  public post(
    info: any,
    tweet: string,
    tweetType: string,
    ids: Record<string, string>,
    speakers: Record<string, number[]>,
    writing: Record<string, number[]>
  ): void {
    this.twitter.post('statuses/update', { status: tweet }, (e, data) => {
      if (e) console.error(e);
      else {
        if (tweetType === 'msg') {
          this.idsUpdate(info as string, data, ids, writing).catch((e) =>
            console.error(e)
          );
        } else if (tweetType === 'voice channel') {
          this.speakersUpdate(
            info as [string, number, number],
            speakers,
            writing
          ).catch((e) => console.error(e));
        }
      }
    });
  }

  // ツイート削除
  public delete(
    id: string,
    ids: Record<string, string>,
    writing: Record<string, number[]>
  ): void {
    if (!(id in ids)) return;

    this.twitter.post('statuses/destroy', { id: ids[id] }, (e) => {
      if (e) console.error(e);
      else {
        delete ids[id];
        this.ids.write(ids, writing).catch((e) => console.error(e));
      }
    });
  }
}
