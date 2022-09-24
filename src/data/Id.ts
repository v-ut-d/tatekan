import type { Collection } from 'discord.js';
import Json from './base';

export class IdJson extends Json<string> {
  private constructor(data: Collection<string, string>) {
    super('id', data);
  }
  public static async create(): Promise<IdJson> {
    return new this(await super.read('id'));
  }
}
