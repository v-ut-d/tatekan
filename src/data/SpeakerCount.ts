import type { Collection } from 'discord.js';
import Json from './base';

interface SpeakerCountType {
  bots: number;
  humans: number;
}

export class SpeakerCount implements SpeakerCountType {
  public bots: number;
  public humans: number;
  public constructor(speakerCount: SpeakerCountType) {
    this.bots = speakerCount.bots;
    this.humans = speakerCount.humans;
  }
  public toJSON(): SpeakerCountType {
    return { bots: this.bots, humans: this.humans };
  }
  public get total(): number {
    return this.bots + this.humans;
  }
  public equals(speakerCount: SpeakerCount): boolean {
    return (
      this.bots === speakerCount.bots && this.humans === speakerCount.humans
    );
  }
}

export class SpeakerCountJson extends Json<SpeakerCount> {
  private constructor(data: Collection<string, SpeakerCount>) {
    super('speakers', data);
  }
  public static async create(): Promise<SpeakerCountJson> {
    const data = await super.read<SpeakerCountType>('speakers');
    return new this(data.mapValues((value) => new SpeakerCount(value)));
  }
}
