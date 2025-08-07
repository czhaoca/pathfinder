/**
 * Database Query Optimizer
 * Implements query optimization strategies and monitoring
 */

const logger = require('./logger');

class QueryOptimizer {
  constructor() {
    this.queryStats = new Map();
    this.slowQueryThreshold = 1000; // 1 second
    this.indexSuggestions = new Map();
  }

  /**
   * Analyze and optimize SELECT query
   */
  optimizeSelect(table, conditions = {}, options = {}) {
    const query = {
      text: '',
      values: [],
      optimizations: []
    };

    // Build WHERE clause with parameterized queries
    const whereConditions = [];
    let paramIndex = 1;

    for (const [field, value] of Object.entries(conditions)) {
      if (value === null) {
        whereConditions.push(`${field} IS NULL`);
      } else if (Array.isArray(value)) {
        // Use IN clause for arrays
        const placeholders = value.map(() => `$${paramIndex++}`);
        whereConditions.push(`${field} IN (${placeholders.join(', ')})`);
        query.values.push(...value);
        query.optimizations.push(`Using IN clause for ${field}`);
      } else if (typeof value === 'object' && value.operator) {
        // Handle complex conditions
        const { operator, value: val } = value;
        whereConditions.push(`${field} ${operator} $${paramIndex++}`);
        query.values.push(val);
      } else {
        whereConditions.push(`${field} = $${paramIndex++}`);
        query.values.push(value);
      }
    }

    // Build SELECT statement
    const fields = options.fields || '*';
    const fieldList = Array.isArray(fields) ? fields.join(', ') : fields;
    
    query.text = `SELECT ${fieldList} FROM ${table}`;
    
    if (whereConditions.length > 0) {
      query.text += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Add ORDER BY
    if (options.orderBy) {
      const orderClauses = [];
      for (const [field, direction] of Object.entries(options.orderBy)) {
        orderClauses.push(`${field} ${direction.toUpperCase()}`);
      }
      query.text += ` ORDER BY ${orderClauses.join(', ')}`;
      query.optimizations.push('Using index for sorting');
    }

    // Add LIMIT and OFFSET for pagination
    if (options.limit) {
      query.text += ` LIMIT $${paramIndex++}`;
      query.values.push(options.limit);
      
      if (options.offset) {
        query.text += ` OFFSET $${paramIndex++}`;
        query.values.push(options.offset);
      }
      query.optimizations.push('Using pagination to limit result set');
    }

    // Suggest indexes
    this.suggestIndexes(table, whereConditions, options.orderBy);

    return query;
  }

  /**
   * Optimize JOIN queries
   */
  optimizeJoin(joins, conditions = {}, options = {}) {
    const query = {
      text: '',
      values: [],
      optimizations: []
    };

    // Analyze join order for optimization
    const optimizedJoins = this.optimizeJoinOrder(joins);
    
    // Build FROM clause with first table
    const firstJoin = optimizedJoins[0];
    const fields = options.fields || `${firstJoin.table}.*`;
    query.text = `SELECT ${fields} FROM ${firstJoin.table}`;

    // Add JOINs
    for (let i = 1; i < optimizedJoins.length; i++) {
      const join = optimizedJoins[i];
      query.text += ` ${join.type || 'INNER'} JOIN ${join.table}`;
      query.text += ` ON ${join.on}`;
      query.optimizations.push(`Optimized join order for ${join.table}`);
    }

    // Add WHERE conditions
    if (Object.keys(conditions).length > 0) {
      const whereClause = this.buildWhereClause(conditions, query.values);
      query.text += ` WHERE ${whereClause}`;
    }

    // Add GROUP BY if needed
    if (options.groupBy) {
      query.text += ` GROUP BY ${options.groupBy.join(', ')}`;
      query.optimizations.push('Using GROUP BY with potential index');
    }

    // Add HAVING clause if needed
    if (options.having) {
      query.text += ` HAVING ${options.having}`;
    }

    // Add ORDER BY
    if (options.orderBy) {
      const orderClauses = [];
      for (const [field, direction] of Object.entries(options.orderBy)) {
        orderClauses.push(`${field} ${direction.toUpperCase()}`);
      }
      query.text += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // Add pagination
    if (options.limit) {
      query.text += ` LIMIT ${options.limit}`;
      if (options.offset) {
        query.text += ` OFFSET ${options.offset}`;
      }
    }

    return query;
  }

  /**
   * Optimize join order based on table statistics
   */
  optimizeJoinOrder(joins) {
    // Sort joins by estimated row count (smaller tables first)
    return joins.sort((a, b) => {
      const sizeA = this.getEstimatedTableSize(a.table);
      const sizeB = this.getEstimatedTableSize(b.table);
      return sizeA - sizeB;
    });
  }

  /**
   * Build parameterized WHERE clause
   */
  buildWhereClause(conditions, values) {
    const clauses = [];
    let paramIndex = values.length + 1;

    for (const [field, value] of Object.entries(conditions)) {
      if (value === null) {
        clauses.push(`${field} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${paramIndex++}`);
        clauses.push(`${field} IN (${placeholders.join(', ')})`);
        values.push(...value);
      } else {
        clauses.push(`${field} = $${paramIndex++}`);
        values.push(value);
      }
    }

    return clauses.join(' AND ');
  }

  /**
   * Batch insert optimization
   */
  optimizeBatchInsert(table, records, options = {}) {
    if (!records || records.length === 0) {
      throw new Error('No records to insert');
    }

    const query = {
      text: '',
      values: [],
      optimizations: []
    };

    // Get fields from first record
    const fields = Object.keys(records[0]);
    const fieldList = fields.join(', ');

    // Build VALUES clause with parameterized queries
    const valueClauses = [];
    let paramIndex = 1;

    for (const record of records) {
      const placeholders = fields.map(() => `$${paramIndex++}`);
      valueClauses.push(`(${placeholders.join(', ')})`);
      
      for (const field of fields) {
        query.values.push(record[field]);
      }
    }

    query.text = `INSERT INTO ${table} (${fieldList}) VALUES ${valueClauses.join(', ')}`;

    // Add ON CONFLICT clause if specified
    if (options.onConflict) {
      query.text += ` ON CONFLICT (${options.onConflict.fields.join(', ')})`;
      
      if (options.onConflict.action === 'update') {
        const updates = fields
          .filter(f => !options.onConflict.fields.includes(f))
          .map(f => `${f} = EXCLUDED.${f}`);
        query.text += ` DO UPDATE SET ${updates.join(', ')}`;
      } else {
        query.text += ' DO NOTHING';
      }
    }

    // Add RETURNING clause if needed
    if (options.returning) {
      query.text += ` RETURNING ${options.returning}`;
    }

    query.optimizations.push(`Batch insert of ${records.length} records`);

    return query;
  }

  /**
   * Optimize UPDATE query
   */
  optimizeUpdate(table, updates, conditions, options = {}) {
    const query = {
      text: '',
      values: [],
      optimizations: []
    };

    // Build SET clause
    const setClauses = [];
    let paramIndex = 1;

    for (const [field, value] of Object.entries(updates)) {
      setClauses.push(`${field} = $${paramIndex++}`);
      query.values.push(value);
    }

    query.text = `UPDATE ${table} SET ${setClauses.join(', ')}`;

    // Add WHERE clause
    if (Object.keys(conditions).length > 0) {
      const whereClause = this.buildWhereClause(conditions, query.values);
      query.text += ` WHERE ${whereClause}`;
    } else {
      logger.warn('UPDATE without WHERE clause detected - this will update all records');
    }

    // Add RETURNING clause if needed
    if (options.returning) {
      query.text += ` RETURNING ${options.returning}`;
    }

    return query;
  }

  /**
   * Suggest indexes based on query patterns
   */
  suggestIndexes(table, whereConditions, orderBy) {
    const key = `${table}:${whereConditions.join(',')}`;
    
    if (!this.indexSuggestions.has(key)) {
      const suggestion = {
        table,
        fields: [],
        type: 'btree',
        reason: ''
      };

      // Extract fields from WHERE conditions
      whereConditions.forEach(condition => {
        const field = condition.split(' ')[0];
        if (!suggestion.fields.includes(field)) {
          suggestion.fields.push(field);
        }
      });

      // Add ORDER BY fields
      if (orderBy) {
        Object.keys(orderBy).forEach(field => {
          if (!suggestion.fields.includes(field)) {
            suggestion.fields.push(field);
          }
        });
        suggestion.reason = 'Optimize WHERE and ORDER BY';
      } else {
        suggestion.reason = 'Optimize WHERE conditions';
      }

      this.indexSuggestions.set(key, suggestion);
    }
  }

  /**
   * Get estimated table size for join optimization
   */
  getEstimatedTableSize(table) {
    // This would normally query table statistics
    // For now, return estimates based on table names
    const estimates = {
      users: 10000,
      sessions: 50000,
      experiences: 100000,
      skills: 1000,
      career_paths: 100,
      jobs: 500000,
      applications: 200000,
      contacts: 50000,
      interactions: 500000
    };

    return estimates[table] || 10000;
  }

  /**
   * Monitor query performance
   */
  async monitorQuery(queryText, executionTime) {
    const key = this.getQueryKey(queryText);
    
    if (!this.queryStats.has(key)) {
      this.queryStats.set(key, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity
      });
    }

    const stats = this.queryStats.get(key);
    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    stats.maxTime = Math.max(stats.maxTime, executionTime);
    stats.minTime = Math.min(stats.minTime, executionTime);

    // Log slow queries
    if (executionTime > this.slowQueryThreshold) {
      logger.warn('Slow query detected', {
        query: queryText.substring(0, 100),
        executionTime,
        avgTime: stats.avgTime
      });
    }
  }

  /**
   * Get query key for statistics
   */
  getQueryKey(queryText) {
    // Remove values to group similar queries
    return queryText
      .replace(/\$\d+/g, '$?')
      .replace(/\d+/g, '?')
      .substring(0, 200);
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const report = {
      totalQueries: 0,
      slowQueries: [],
      frequentQueries: [],
      indexSuggestions: Array.from(this.indexSuggestions.values())
    };

    for (const [query, stats] of this.queryStats.entries()) {
      report.totalQueries += stats.count;

      if (stats.avgTime > this.slowQueryThreshold) {
        report.slowQueries.push({
          query,
          ...stats
        });
      }

      if (stats.count > 100) {
        report.frequentQueries.push({
          query,
          ...stats
        });
      }
    }

    // Sort by impact (frequency * avg time)
    report.slowQueries.sort((a, b) => 
      (b.count * b.avgTime) - (a.count * a.avgTime)
    );

    report.frequentQueries.sort((a, b) => b.count - a.count);

    return report;
  }

  /**
   * Clear statistics
   */
  clearStats() {
    this.queryStats.clear();
    this.indexSuggestions.clear();
  }
}

// Export singleton instance
const queryOptimizer = new QueryOptimizer();

module.exports = queryOptimizer;