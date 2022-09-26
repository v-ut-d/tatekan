import fs from 'fs/promises';

export default class json {
  private filename: string;
  public constructor(filename: string) {
    this.filename = filename;
  }
  public async read<T>(): Promise<Record<string, T>> {
    const dict: Record<string, T> = await fs
      .access('data/' + this.filename + '.json')
      .then(async () =>
        fs.readFile('data/' + this.filename + '.json', { encoding: 'utf-8' })
      )
      .catch(() => '{}')
      .then((data) => JSON.parse(data) as Record<string, T>);
    return dict;
  }

  public async write<T>(
    dict: Record<string, T>,
    writing: Record<string, number[]>
  ): Promise<void> {
    if (!writing[this.filename]) writing[this.filename] = [0, 0];
    const writingThisFile = writing[this.filename];
    if (!writingThisFile || writingThisFile.length !== 2) return;
    writingThisFile[0] += 1;
    if (writingThisFile[1] === 0) {
      writingThisFile[1] = 1;
      while (writingThisFile[0] && writingThisFile[0] > 0) {
        await fs
          .writeFile('data/' + this.filename + '.json', JSON.stringify(dict))
          .then(() => {
            writingThisFile[0] -= 1;
          });
      }
      writingThisFile[1] = 0;
    }
  }
}
