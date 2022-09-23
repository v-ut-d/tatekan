import Twitter from 'twitter';
import { parseTweet } from 'twitter-text';

export default class TwitterWrap {
  private readonly twitter: Twitter;
  public constructor(credential: Twitter.AccessTokenOptions) {
    this.twitter = new Twitter(credential);
  }

  // ツイート成型
  public static msgFormat(createdAt: Date, cleanContent: string): string {
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

  public static voiceChannelFormat(
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

  // ツイート投稿
  public async post(tweet: string): Promise<string> {
    const response = (await this.twitter.post('statuses/update', {
      status: tweet,
    })) as { id_str: string };
    return response.id_str;
  }

  // ツイート削除
  public async delete(tweetId: string): Promise<void> {
    await this.twitter.post('statuses/destroy', { id: tweetId });
  }
}
