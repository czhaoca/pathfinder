const BaseRepository = require('./baseRepository');

class ConfigurationRepository extends BaseRepository {
  constructor(db) {
    super(db, 'pf_configuration');
  }

  async getByKey(key) {
    return this.db(this.tableName)
      .where('config_key', key)
      .first();
  }

  async getByCategory(category) {
    return this.db(this.tableName)
      .where('category', category)
      .orderBy('config_key');
  }

  async upsert(key, value, category = 'general') {
    const existing = await this.getByKey(key);
    
    if (existing) {
      return this.db(this.tableName)
        .where('config_key', key)
        .update({
          config_value: value,
          updated_at: new Date()
        });
    } else {
      return this.db(this.tableName).insert({
        config_key: key,
        config_value: value,
        category,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }

  async getAllGroupedByCategory() {
    const configs = await this.db(this.tableName)
      .select('*')
      .orderBy(['category', 'config_key']);

    const grouped = {};
    for (const config of configs) {
      if (!grouped[config.category]) {
        grouped[config.category] = {};
      }
      grouped[config.category][config.config_key] = config.config_value;
    }

    return grouped;
  }

  async search(searchTerm) {
    return this.db(this.tableName)
      .where('config_key', 'like', `%${searchTerm}%`)
      .orWhere('config_value', 'like', `%${searchTerm}%`)
      .orWhere('description', 'like', `%${searchTerm}%`)
      .orderBy('config_key');
  }
}

module.exports = ConfigurationRepository;