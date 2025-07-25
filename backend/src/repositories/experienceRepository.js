const oracledb = require('oracledb');
const logger = require('../utils/logger');

class ExperienceRepository {
  constructor(database) {
    this.database = database;
  }

  async findByUser(schemaPrefix, filters = {}) {
    let sql = `
      SELECT 
        RAWTOHEX(experience_id) as experience_id,
        title,
        organization,
        department,
        location,
        description,
        start_date,
        end_date,
        is_current,
        experience_type,
        employment_type,
        JSON_VALUE(extracted_skills, '$') as extracted_skills,
        JSON_VALUE(key_highlights, '$') as key_highlights,
        JSON_VALUE(quantified_impacts, '$') as quantified_impacts,
        JSON_VALUE(technologies_used, '$') as technologies_used,
        JSON_VALUE(achievements, '$') as achievements,
        team_size,
        budget_managed,
        revenue_impact,
        cost_savings,
        created_at,
        updated_at
      FROM ${schemaPrefix}_experiences_detailed
      WHERE 1 = 1
    `;
    
    const binds = {};
    
    if (filters.experienceType) {
      sql += ' AND experience_type = :experienceType';
      binds.experienceType = filters.experienceType;
    }
    
    if (filters.isCurrent !== undefined) {
      sql += ' AND is_current = :isCurrent';
      binds.isCurrent = filters.isCurrent ? 1 : 0;
    }
    
    if (filters.dateFrom) {
      sql += ' AND start_date >= :dateFrom';
      binds.dateFrom = filters.dateFrom;
    }
    
    if (filters.dateTo) {
      sql += ' AND start_date <= :dateTo';
      binds.dateTo = filters.dateTo;
    }
    
    if (filters.searchText) {
      sql += ` AND (
        UPPER(title) LIKE UPPER(:searchText) OR 
        UPPER(description) LIKE UPPER(:searchText) OR
        UPPER(organization) LIKE UPPER(:searchText)
      )`;
      binds.searchText = `%${filters.searchText}%`;
    }
    
    sql += ' ORDER BY start_date DESC, created_at DESC';
    
    if (filters.limit) {
      sql += ' FETCH FIRST :limit ROWS ONLY';
      binds.limit = filters.limit;
    }
    
    const result = await this.database.executeQuery(sql, binds);
    return result.rows.map(this.mapToExperience);
  }

  async findById(schemaPrefix, experienceId) {
    const sql = `
      SELECT 
        RAWTOHEX(experience_id) as experience_id,
        title,
        organization,
        department,
        location,
        description,
        start_date,
        end_date,
        is_current,
        experience_type,
        employment_type,
        JSON_VALUE(extracted_skills, '$') as extracted_skills,
        JSON_VALUE(key_highlights, '$') as key_highlights,
        JSON_VALUE(quantified_impacts, '$') as quantified_impacts,
        JSON_VALUE(technologies_used, '$') as technologies_used,
        JSON_VALUE(achievements, '$') as achievements,
        team_size,
        budget_managed,
        revenue_impact,
        cost_savings,
        created_at,
        updated_at
      FROM ${schemaPrefix}_experiences_detailed
      WHERE experience_id = HEXTORAW(:experienceId)
    `;
    
    const result = await this.database.executeQuery(sql, { experienceId });
    return result.rows.length > 0 ? this.mapToExperience(result.rows[0]) : null;
  }

  async create(schemaPrefix, experience) {
    const sql = `
      INSERT INTO ${schemaPrefix}_experiences_detailed (
        title, organization, department, location, description, 
        start_date, end_date, is_current, experience_type, employment_type,
        extracted_skills, key_highlights, quantified_impacts, 
        technologies_used, achievements, team_size, budget_managed,
        revenue_impact, cost_savings, duration_months
      ) VALUES (
        :title, :organization, :department, :location, :description,
        TO_DATE(:startDate, 'YYYY-MM-DD'), 
        ${experience.endDate ? "TO_DATE(:endDate, 'YYYY-MM-DD')" : 'NULL'},
        :isCurrent, :experienceType, :employmentType,
        :extractedSkills, :keyHighlights, :quantifiedImpacts,
        :technologiesUsed, :achievements, :teamSize, :budgetManaged,
        :revenueImpact, :costSavings, :durationMonths
      ) RETURNING RAWTOHEX(experience_id) INTO :experienceId
    `;
    
    const binds = {
      title: experience.title,
      organization: experience.organization || null,
      department: experience.department || null,
      location: experience.location || null,
      description: experience.description,
      startDate: experience.startDate,
      isCurrent: experience.isCurrent ? 1 : 0,
      experienceType: experience.experienceType || 'work',
      employmentType: experience.employmentType || null,
      extractedSkills: experience.extractedSkills ? JSON.stringify(experience.extractedSkills) : null,
      keyHighlights: experience.keyHighlights ? JSON.stringify(experience.keyHighlights) : null,
      quantifiedImpacts: experience.quantifiedImpacts ? JSON.stringify(experience.quantifiedImpacts) : null,
      technologiesUsed: experience.technologiesUsed ? JSON.stringify(experience.technologiesUsed) : null,
      achievements: experience.achievements ? JSON.stringify(experience.achievements) : null,
      teamSize: experience.teamSize || null,
      budgetManaged: experience.budgetManaged || null,
      revenueImpact: experience.revenueImpact || null,
      costSavings: experience.costSavings || null,
      durationMonths: experience.durationMonths || null,
      experienceId: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
    };

    if (experience.endDate) {
      binds.endDate = experience.endDate;
    }
    
    const result = await this.database.executeQuery(sql, binds, { autoCommit: true });
    return result.outBinds.experienceId;
  }

  async update(schemaPrefix, experienceId, updates) {
    const updateFields = [];
    const binds = { experienceId };

    // Build dynamic update statement
    if (updates.title !== undefined) {
      updateFields.push('title = :title');
      binds.title = updates.title;
    }
    if (updates.organization !== undefined) {
      updateFields.push('organization = :organization');
      binds.organization = updates.organization;
    }
    if (updates.department !== undefined) {
      updateFields.push('department = :department');
      binds.department = updates.department;
    }
    if (updates.location !== undefined) {
      updateFields.push('location = :location');
      binds.location = updates.location;
    }
    if (updates.description !== undefined) {
      updateFields.push('description = :description');
      binds.description = updates.description;
    }
    if (updates.startDate !== undefined) {
      updateFields.push("start_date = TO_DATE(:startDate, 'YYYY-MM-DD')");
      binds.startDate = updates.startDate;
    }
    if (updates.endDate !== undefined) {
      updateFields.push("end_date = TO_DATE(:endDate, 'YYYY-MM-DD')");
      binds.endDate = updates.endDate;
    }
    if (updates.isCurrent !== undefined) {
      updateFields.push('is_current = :isCurrent');
      binds.isCurrent = updates.isCurrent ? 1 : 0;
    }
    if (updates.experienceType !== undefined) {
      updateFields.push('experience_type = :experienceType');
      binds.experienceType = updates.experienceType;
    }
    if (updates.employmentType !== undefined) {
      updateFields.push('employment_type = :employmentType');
      binds.employmentType = updates.employmentType;
    }
    if (updates.extractedSkills !== undefined) {
      updateFields.push('extracted_skills = :extractedSkills');
      binds.extractedSkills = JSON.stringify(updates.extractedSkills);
    }
    if (updates.keyHighlights !== undefined) {
      updateFields.push('key_highlights = :keyHighlights');
      binds.keyHighlights = JSON.stringify(updates.keyHighlights);
    }
    if (updates.quantifiedImpacts !== undefined) {
      updateFields.push('quantified_impacts = :quantifiedImpacts');
      binds.quantifiedImpacts = JSON.stringify(updates.quantifiedImpacts);
    }
    if (updates.technologiesUsed !== undefined) {
      updateFields.push('technologies_used = :technologiesUsed');
      binds.technologiesUsed = JSON.stringify(updates.technologiesUsed);
    }
    if (updates.achievements !== undefined) {
      updateFields.push('achievements = :achievements');
      binds.achievements = JSON.stringify(updates.achievements);
    }
    if (updates.teamSize !== undefined) {
      updateFields.push('team_size = :teamSize');
      binds.teamSize = updates.teamSize;
    }
    if (updates.budgetManaged !== undefined) {
      updateFields.push('budget_managed = :budgetManaged');
      binds.budgetManaged = updates.budgetManaged;
    }
    if (updates.revenueImpact !== undefined) {
      updateFields.push('revenue_impact = :revenueImpact');
      binds.revenueImpact = updates.revenueImpact;
    }
    if (updates.costSavings !== undefined) {
      updateFields.push('cost_savings = :costSavings');
      binds.costSavings = updates.costSavings;
    }
    if (updates.durationMonths !== undefined) {
      updateFields.push('duration_months = :durationMonths');
      binds.durationMonths = updates.durationMonths;
    }

    updateFields.push('updated_at = SYSTIMESTAMP');

    const sql = `
      UPDATE ${schemaPrefix}_experiences_detailed
      SET ${updateFields.join(', ')}
      WHERE experience_id = HEXTORAW(:experienceId)
    `;

    await this.database.executeQuery(sql, binds, { autoCommit: true });
  }

  async delete(schemaPrefix, experienceId) {
    const sql = `
      DELETE FROM ${schemaPrefix}_experiences_detailed
      WHERE experience_id = HEXTORAW(:experienceId)
    `;
    
    await this.database.executeQuery(sql, { experienceId }, { autoCommit: true });
  }

  async getStats(schemaPrefix) {
    const sql = `
      SELECT 
        COUNT(*) as total_experiences,
        COUNT(CASE WHEN is_current = 1 THEN 1 END) as current_experiences,
        COUNT(DISTINCT organization) as unique_organizations,
        MIN(start_date) as earliest_experience,
        MAX(CASE WHEN is_current = 0 THEN end_date END) as latest_experience,
        SUM(duration_months) as total_months_experience
      FROM ${schemaPrefix}_experiences_detailed
    `;
    
    const result = await this.database.executeQuery(sql);
    if (result.rows.length > 0) {
      const stats = result.rows[0];
      return {
        totalExperiences: stats.TOTAL_EXPERIENCES,
        currentExperiences: stats.CURRENT_EXPERIENCES,
        uniqueOrganizations: stats.UNIQUE_ORGANIZATIONS,
        earliestExperience: stats.EARLIEST_EXPERIENCE,
        latestExperience: stats.LATEST_EXPERIENCE,
        totalMonthsExperience: stats.TOTAL_MONTHS_EXPERIENCE
      };
    }
    return null;
  }

  mapToExperience(row) {
    return {
      experienceId: row.EXPERIENCE_ID,
      title: row.TITLE,
      organization: row.ORGANIZATION,
      department: row.DEPARTMENT,
      location: row.LOCATION,
      description: row.DESCRIPTION,
      startDate: row.START_DATE,
      endDate: row.END_DATE,
      isCurrent: row.IS_CURRENT === 1,
      experienceType: row.EXPERIENCE_TYPE,
      employmentType: row.EMPLOYMENT_TYPE,
      extractedSkills: row.EXTRACTED_SKILLS ? JSON.parse(row.EXTRACTED_SKILLS) : [],
      keyHighlights: row.KEY_HIGHLIGHTS ? JSON.parse(row.KEY_HIGHLIGHTS) : [],
      quantifiedImpacts: row.QUANTIFIED_IMPACTS ? JSON.parse(row.QUANTIFIED_IMPACTS) : [],
      technologiesUsed: row.TECHNOLOGIES_USED ? JSON.parse(row.TECHNOLOGIES_USED) : [],
      achievements: row.ACHIEVEMENTS ? JSON.parse(row.ACHIEVEMENTS) : [],
      teamSize: row.TEAM_SIZE,
      budgetManaged: row.BUDGET_MANAGED,
      revenueImpact: row.REVENUE_IMPACT,
      costSavings: row.COST_SAVINGS,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }
}

module.exports = ExperienceRepository;