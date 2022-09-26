import Twitter from 'twitter';
import TwitterText from 'twitter-text';
import json from './json';

export default class TwitterWrap {
  private readonly twitter: Twitter;
  private readonly ids: json;
  public constructor(credential: Twitter.AccessTokenOptions) {
    this.twitter = new Twitter(credential);
    this.ids = new json('id');
  }

  // ツイート成型
  public msgFormat(createdAt: Date, cleanContent: string): string {
    let tweet =
      new Intl.DateTimeFormat('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Tokyo',
      }).format(createdAt) +
      ' に書き込みがありました:\n' +
      cleanContent
        .replace(/<:.+?:\d+?>/g, '??')
        .replace(/@/g, '＠')
        .replace(/#/g, '#.');

    let result = TwitterText.parseTweet(tweet);
    while (!result.valid) {
      tweet = tweet.slice(0, -2) + '…';
      result = TwitterText.parseTweet(tweet);
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
    id: string,
    data: Twitter.ResponseData,
    ids: Record<string, string>,
    writing: Record<string, number[]>
  ): Promise<void> {
    if (!id) throw new Error('Undefined id is forbidden');
    ids[id] = (data as { id_str: string }).id_str;
    await this.ids.write(ids, writing);
  }

  public speakersUpdate(
    id: string,
    infonum: number[],
    speakers: Record<string, number[]>
  ): void {
    speakers[id] = infonum;
  }

  // ツイート投稿
  public post(
    id: string,
    infonum: number[],
    tweet: string,
    tweetType: string,
    ids: Record<string, string>,
    speakers: Record<string, number[]>,
    writing: Record<string, number[]>
  ): void {
    this.twitter.post(
      'statuses/update',
      { status: tweet },
      (e: Error, data: Twitter.ResponseData) => {
        if (e) console.error(e);
        else {
          if (tweetType === 'msg') {
            this.idsUpdate(id, data, ids, writing).catch((e) =>
              console.error(e)
            );
          } else if (tweetType === 'voice channel') {
            this.speakersUpdate(id, infonum, speakers);
          }
        }
      }
    );
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
