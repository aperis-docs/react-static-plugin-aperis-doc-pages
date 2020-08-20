/* Very unsophisticated cache to reduce unnecessary I/O */
export default class SimpleCache {
  constructor() {
    this._cache = {};
  }
  async get(key, valueObtainer) {
    if (this._cache[key] !== undefined) {
      return this._cache[key];
    } else {
      const value = await valueObtainer();
      this._cache[key] = value;
      return value;
    }
  }
}
