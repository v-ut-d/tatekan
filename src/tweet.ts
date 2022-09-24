import Twitter from 'twitter';
import TwitterText from 'twitter-text';
import type { SpeakerCount } from './data/SpeakerCount';

export default class TwitterWrap {
  private readonly twitter: Twitter;
  public constructor(credential: Twitter.AccessTokenOptions) {
    this.twitter = new Twitter(credential);
  }

  // ツイート成型
  public static msgFormat(createdAt: Date, cleanContent: string): string {
    const formattedDate = new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    }).format(createdAt);
    let tweet =
      `${formattedDate} に書き込みがありました:\n` +
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

  public static voiceChannelFormat(
    channelName: string,
    speakerCount: SpeakerCount
  ): string {
    const formattedDate = new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    }).format(Date.now());
    return (
      `${formattedDate}現在、ボイスチャンネル「${channelName}」には\n` +
      `人間${speakerCount.humans}人\nbot ${speakerCount.bots}機\nがいます。`
    );
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
