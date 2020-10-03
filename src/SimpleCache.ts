/* Very unsophisticated cache to reduce unnecessary I/O */
export default class SimpleCache {
  _cache: Record<string, any>;

  constructor() {
    this._cache = {};
  }

  async get(key: string, valueObtainer: () => Promise<any>) {
    if (this._cache[key] !== undefined) {
      return this._cache[key];
    } else {
      const value = await valueObtainer();
      this._cache[key] = value;
      return value;
    }
  }
}
