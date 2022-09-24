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