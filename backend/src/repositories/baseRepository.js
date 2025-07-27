/**
 * Base Repository Class
 * Provides common database operations for all repositories
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class BaseRepository {
  constructor(database, config) {
    this.database = database;
    this.config = config;
  }

  /**
   * Generate a new UUID
   */
  generateId() {
    return uuidv4();
  }

  /**
   * Execute a query with error handling and logging
   */
  async executeQuery(query, params = {}, options = {}) {
    try {
      const result = await this.database.executeQuery(query, params, options);
      return result;
    } catch (error) {
      logger.error('Database query failed', {
        query: query.substring(0, 200),
        params: Object.keys(params),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute a query that returns a single row
   */
  async findOne(query, params = {}) {
    const results = await this.executeQuery(query, params);
    return results[0] || null;
  }

  /**
   * Execute a query that returns multiple rows
   */
  async findMany(query, params = {}, options = {}) {
    return await this.executeQuery(query, params, options);
  }

  /**
   * Insert a record and return the created entity
   */
  async create(table, data, returningColumns = '*') {
    const columns = Object.keys(data);
    const values = columns.map(col => `:${col}`);
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${values.join(', ')})
      ${returningColumns ? `RETURNING ${returningColumns} INTO :returning` : ''}
    `;

    if (returningColumns) {
      const returning = {};
      await this.executeQuery(query, { ...data, returning }, { autoCommit: true });
      return returning;
    } else {
      await this.executeQuery(query, data, { autoCommit: true });
      return data;
    }
  }

  /**
   * Update a record
   */
  async update(table, data, whereClause, whereParams = {}) {
    const setColumns = Object.keys(data)
      .filter(key => !whereParams.hasOwnProperty(key))
      .map(col => `${col} = :${col}`)
      .join(', ');
    
    const query = `
      UPDATE ${table}
      SET ${setColumns}
      WHERE ${whereClause}
    `;

    const result = await this.executeQuery(
      query, 
      { ...data, ...whereParams }, 
      { autoCommit: true }
    );
    
    return result.rowsAffected;
  }

  /**
   * Delete records
   */
  async delete(table, whereClause, whereParams = {}) {
    const query = `
      DELETE FROM ${table}
      WHERE ${whereClause}
    `;

    const result = await this.executeQuery(query, whereParams, { autoCommit: true });
    return result.rowsAffected;
  }

  /**
   * Check if a record exists
   */
  async exists(table, whereClause, whereParams = {}) {
    const query = `
      SELECT 1 as exists_flag
      FROM ${table}
      WHERE ${whereClause}
      FETCH FIRST 1 ROW ONLY
    `;

    const result = await this.findOne(query, whereParams);
    return result !== null;
  }

  /**
   * Count records
   */
  async count(table, whereClause = '1=1', whereParams = {}) {
    const query = `
      SELECT COUNT(*) as total
      FROM ${table}
      WHERE ${whereClause}
    `;

    const result = await this.findOne(query, whereParams);
    return result.total || 0;
  }

  /**
   * Begin a transaction
   */
  async beginTransaction() {
    return await this.database.beginTransaction();
  }

  /**
   * Commit a transaction
   */
  async commit(connection) {
    return await this.database.commit(connection);
  }

  /**
   * Rollback a transaction
   */
  async rollback(connection) {
    return await this.database.rollback(connection);
  }

  /**
   * Execute multiple queries in a transaction
   */
  async executeTransaction(callback) {
    const connection = await this.beginTransaction();
    
    try {
      const result = await callback(connection);
      await this.commit(connection);
      return result;
    } catch (error) {
      await this.rollback(connection);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  /**
   * Build pagination query
   */
  buildPaginationQuery(baseQuery, page = 1, limit = 20, orderBy = 'created_at DESC') {
    const offset = (page - 1) * limit;
    
    return `
      SELECT * FROM (
        SELECT a.*, ROWNUM rnum FROM (
          ${baseQuery}
          ORDER BY ${orderBy}
        ) a
        WHERE ROWNUM <= :maxRow
      )
      WHERE rnum > :offset
    `;
  }

  /**
   * Execute paginated query
   */
  async findPaginated(baseQuery, params = {}, page = 1, limit = 20, orderBy = 'created_at DESC') {
    const paginatedQuery = this.buildPaginationQuery(baseQuery, page, limit, orderBy);
    const maxRow = page * limit;
    const offset = (page - 1) * limit;
    
    const results = await this.findMany(paginatedQuery, {
      ...params,
      maxRow,
      offset
    });

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery})`;
    const countResult = await this.findOne(countQuery, params);
    const total = countResult.total || 0;

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = BaseRepository;