import fs from 'fs/promises';
import { Collection } from 'discord.js';

export default class Json<T> {
  private writing = 0;
  protected constructor(
    private readonly filename: string,
    public data: Collection<string, T>
  ) {}

  protected static async read<T>(
    filename: string
  ): Promise<Collection<string, T>> {
    const dict = await fs
      .access(filename + '.json')
      .then(async () => fs.readFile(filename + '.json', { encoding: 'utf-8' }))
      .catch(() => '{}')
      .then((data) => JSON.parse(data) as Record<string, T>);
    return new Collection(Object.entries(dict));
  }

  public write(): void {
    if (this.writing === 0) {
      this.writeAsync().catch((e) => console.error(e));
    } else if (this.writing === 1) {
      this.writing = 2;
    }
  }

  private async writeAsync(): Promise<void> {
    this.writing = 1;
    while (this.writing > 0) {
      await fs.writeFile(
        this.filename + '.json',
        JSON.stringify(Object.fromEntries(this.data.entries()))
      );
      this.writing--;
    }
  }
}

export class IdJson extends Json<string> {
  private constructor(data: Collection<string, string>) {
    super('id', data);
  }
  public static async create(): Promise<IdJson> {
    return new this(await super.read('id'));
  }
}

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
