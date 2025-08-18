/**
 * Profile Import Service
 * Handles importing and mapping professional profile data from LinkedIn
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { DatabaseError } = require('../utils/errors');

class ProfileImportService {
  constructor(database, experienceService, educationService, skillsService, certificationsService) {
    this.database = database;
    this.experienceService = experienceService;
    this.educationService = educationService;
    this.skillsService = skillsService;
    this.certificationsService = certificationsService;
  }

  /**
   * Import work experience from LinkedIn
   */
  async importWorkExperience(userId, positions) {
    if (!positions || positions.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    const connection = await this.database.getConnection();
    let imported = 0;
    let skipped = 0;

    try {
      await connection.execute('BEGIN');

      for (const position of positions) {
        try {
          // Map LinkedIn position to our experience schema
          const experience = this.mapPositionToExperience(position);
          
          // Check if this position already exists
          const exists = await this.experienceExists(userId, experience, connection);
          
          if (!exists) {
            await this.experienceService.create({
              userId,
              ...experience,
              source: 'linkedin',
              sourceId: position.id || uuidv4()
            }, connection);
            imported++;
          } else {
            skipped++;
          }
        } catch (error) {
          logger.warn('Failed to import position', { error: error.message, position: position.title });
          skipped++;
        }
      }

      await connection.execute('COMMIT');

      logger.info('Work experience imported', { userId, imported, skipped });

      return { imported, skipped };
    } catch (error) {
      await connection.execute('ROLLBACK');
      logger.error('Failed to import work experience', { error: error.message, userId });
      throw new DatabaseError('Failed to import work experience');
    } finally {
      await connection.close();
    }
  }

  /**
   * Import education from LinkedIn
   */
  async importEducation(userId, educations) {
    if (!educations || educations.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    const connection = await this.database.getConnection();
    let imported = 0;
    let skipped = 0;

    try {
      await connection.execute('BEGIN');

      for (const education of educations) {
        try {
          // Map LinkedIn education to our schema
          const edu = this.mapEducationToSchema(education);
          
          // Check if this education already exists
          const exists = await this.educationExists(userId, edu, connection);
          
          if (!exists) {
            await this.educationService.create({
              userId,
              ...edu,
              source: 'linkedin',
              sourceId: education.id || uuidv4()
            }, connection);
            imported++;
          } else {
            skipped++;
          }
        } catch (error) {
          logger.warn('Failed to import education', { error: error.message, school: education.schoolName });
          skipped++;
        }
      }

      await connection.execute('COMMIT');

      logger.info('Education imported', { userId, imported, skipped });

      return { imported, skipped };
    } catch (error) {
      await connection.execute('ROLLBACK');
      logger.error('Failed to import education', { error: error.message, userId });
      throw new DatabaseError('Failed to import education');
    } finally {
      await connection.close();
    }
  }

  /**
   * Import skills from LinkedIn
   */
  async importSkills(userId, skills) {
    if (!skills || skills.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    const connection = await this.database.getConnection();
    let imported = 0;
    let skipped = 0;

    try {
      await connection.execute('BEGIN');

      // Get user's existing skills
      const existingSkills = await this.skillsService.getUserSkills(userId, connection);
      const existingSkillNames = existingSkills.map(s => s.name.toLowerCase());

      for (const skill of skills) {
        try {
          const skillName = typeof skill === 'string' ? skill : skill.name;
          
          if (!existingSkillNames.includes(skillName.toLowerCase())) {
            await this.skillsService.addSkill({
              userId,
              name: skillName,
              category: this.categorizeSkill(skillName),
              proficiencyLevel: 'intermediate',
              source: 'linkedin',
              endorsements: skill.endorsements || 0
            }, connection);
            imported++;
          } else {
            skipped++;
          }
        } catch (error) {
          logger.warn('Failed to import skill', { error: error.message, skill });
          skipped++;
        }
      }

      await connection.execute('COMMIT');

      logger.info('Skills imported', { userId, imported, skipped });

      return { imported, skipped };
    } catch (error) {
      await connection.execute('ROLLBACK');
      logger.error('Failed to import skills', { error: error.message, userId });
      throw new DatabaseError('Failed to import skills');
    } finally {
      await connection.close();
    }
  }

  /**
   * Import certifications from LinkedIn
   */
  async importCertifications(userId, certifications) {
    if (!certifications || certifications.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    const connection = await this.database.getConnection();
    let imported = 0;
    let skipped = 0;

    try {
      await connection.execute('BEGIN');

      for (const certification of certifications) {
        try {
          // Map LinkedIn certification to our schema
          const cert = this.mapCertificationToSchema(certification);
          
          // Check if this certification already exists
          const exists = await this.certificationExists(userId, cert, connection);
          
          if (!exists) {
            await this.certificationsService.create({
              userId,
              ...cert,
              source: 'linkedin',
              sourceId: certification.id || uuidv4()
            }, connection);
            imported++;
          } else {
            skipped++;
          }
        } catch (error) {
          logger.warn('Failed to import certification', { error: error.message, cert: certification.name });
          skipped++;
        }
      }

      await connection.execute('COMMIT');

      logger.info('Certifications imported', { userId, imported, skipped });

      return { imported, skipped };
    } catch (error) {
      await connection.execute('ROLLBACK');
      logger.error('Failed to import certifications', { error: error.message, userId });
      throw new DatabaseError('Failed to import certifications');
    } finally {
      await connection.close();
    }
  }

  /**
   * Map LinkedIn position to experience schema
   */
  mapPositionToExperience(position) {
    const startDate = this.parseLinkedInDate(position.startDate);
    const endDate = position.endDate ? this.parseLinkedInDate(position.endDate) : null;

    return {
      title: position.title,
      company: position.companyName,
      location: position.location || position.locationName,
      description: position.description || position.summary,
      startDate,
      endDate,
      isCurrent: !endDate,
      employmentType: this.mapEmploymentType(position.employmentType),
      responsibilities: this.extractResponsibilities(position.description),
      achievements: this.extractAchievements(position.description),
      skills: position.skills || [],
      industry: position.industry
    };
  }

  /**
   * Map LinkedIn education to our schema
   */
  mapEducationToSchema(education) {
    const startDate = this.parseLinkedInDate(education.startDate);
    const endDate = education.endDate ? this.parseLinkedInDate(education.endDate) : null;

    return {
      institution: education.schoolName,
      degree: education.degreeName,
      fieldOfStudy: education.fieldOfStudy,
      startDate,
      endDate,
      grade: education.grade,
      activities: education.activities,
      description: education.description,
      honors: education.honors
    };
  }

  /**
   * Map LinkedIn certification to our schema
   */
  mapCertificationToSchema(certification) {
    const issueDate = this.parseLinkedInDate(certification.startDate);
    const expirationDate = certification.endDate ? this.parseLinkedInDate(certification.endDate) : null;

    return {
      name: certification.name,
      issuingOrganization: certification.authority || certification.issuingCompany,
      issueDate,
      expirationDate,
      credentialId: certification.licenseNumber,
      credentialUrl: certification.url,
      skills: certification.skills || []
    };
  }

  /**
   * Parse LinkedIn date format
   */
  parseLinkedInDate(dateObj) {
    if (!dateObj) return null;

    if (typeof dateObj === 'string') {
      return new Date(dateObj);
    }

    if (dateObj.year) {
      const month = dateObj.month || 1;
      const day = dateObj.day || 1;
      return new Date(dateObj.year, month - 1, day);
    }

    return null;
  }

  /**
   * Map employment type
   */
  mapEmploymentType(linkedInType) {
    const typeMap = {
      'FULL_TIME': 'full-time',
      'PART_TIME': 'part-time',
      'CONTRACT': 'contract',
      'TEMPORARY': 'temporary',
      'INTERNSHIP': 'internship',
      'FREELANCE': 'freelance',
      'VOLUNTEER': 'volunteer'
    };

    return typeMap[linkedInType] || 'full-time';
  }

  /**
   * Extract responsibilities from description
   */
  extractResponsibilities(description) {
    if (!description) return [];

    // Simple extraction based on bullet points or sentences
    const lines = description.split(/[\n•·]/);
    const responsibilities = [];

    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned && cleaned.length > 10) {
        responsibilities.push(cleaned);
      }
    }

    return responsibilities.slice(0, 5); // Limit to 5 responsibilities
  }

  /**
   * Extract achievements from description
   */
  extractAchievements(description) {
    if (!description) return [];

    // Look for achievement indicators
    const achievementKeywords = [
      'achieved', 'accomplished', 'delivered', 'increased', 'decreased',
      'improved', 'enhanced', 'reduced', 'saved', 'generated', 'led',
      'managed', 'developed', 'implemented', 'launched'
    ];

    const lines = description.split(/[.!?\n]/);
    const achievements = [];

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (achievementKeywords.some(keyword => lower.includes(keyword))) {
        const cleaned = line.trim();
        if (cleaned && cleaned.length > 20) {
          achievements.push(cleaned);
        }
      }
    }

    return achievements.slice(0, 3); // Limit to 3 achievements
  }

  /**
   * Categorize skill
   */
  categorizeSkill(skillName) {
    const skillLower = skillName.toLowerCase();

    // Programming languages
    if (/\b(javascript|python|java|c\+\+|ruby|go|rust|swift|kotlin)\b/.test(skillLower)) {
      return 'programming';
    }

    // Frameworks
    if (/\b(react|angular|vue|django|spring|rails|express|flask)\b/.test(skillLower)) {
      return 'framework';
    }

    // Databases
    if (/\b(sql|mysql|postgresql|mongodb|redis|oracle|cassandra)\b/.test(skillLower)) {
      return 'database';
    }

    // Cloud
    if (/\b(aws|azure|gcp|docker|kubernetes|cloud)\b/.test(skillLower)) {
      return 'cloud';
    }

    // Tools
    if (/\b(git|jenkins|jira|slack|figma|sketch)\b/.test(skillLower)) {
      return 'tool';
    }

    // Soft skills
    if (/\b(leadership|communication|teamwork|management|agile)\b/.test(skillLower)) {
      return 'soft-skill';
    }

    return 'other';
  }

  /**
   * Check if experience exists
   */
  async experienceExists(userId, experience, connection) {
    try {
      const result = await connection.execute(
        `SELECT COUNT(*) as count FROM user_${userId}_experiences_detailed 
         WHERE company = :company AND title = :title 
         AND start_date = :startDate`,
        {
          company: experience.company,
          title: experience.title,
          startDate: experience.startDate
        }
      );

      return result.rows[0].COUNT > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if education exists
   */
  async educationExists(userId, education, connection) {
    try {
      const result = await connection.execute(
        `SELECT COUNT(*) as count FROM user_${userId}_education 
         WHERE institution = :institution AND degree = :degree`,
        {
          institution: education.institution,
          degree: education.degree
        }
      );

      return result.rows[0].COUNT > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if certification exists
   */
  async certificationExists(userId, certification, connection) {
    try {
      const result = await connection.execute(
        `SELECT COUNT(*) as count FROM user_${userId}_certifications 
         WHERE name = :name AND issuing_organization = :org`,
        {
          name: certification.name,
          org: certification.issuingOrganization
        }
      );

      return result.rows[0].COUNT > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Preview import without saving
   */
  async previewImport(data) {
    const preview = {
      profile: data.profile,
      workExperience: data.positions ? data.positions.map(p => this.mapPositionToExperience(p)) : [],
      education: data.education ? data.education.map(e => this.mapEducationToSchema(e)) : [],
      skills: data.skills || [],
      certifications: data.certifications ? data.certifications.map(c => this.mapCertificationToSchema(c)) : []
    };

    return preview;
  }

  /**
   * Selective import with user choices
   */
  async selectiveImport(userId, data, options) {
    const imported = {};

    if (options.workExperience && data.positions) {
      imported.workExperience = await this.importWorkExperience(userId, data.positions);
    }

    if (options.education && data.education) {
      imported.education = await this.importEducation(userId, data.education);
    }

    if (options.skills && data.skills) {
      imported.skills = await this.importSkills(userId, data.skills);
    }

    if (options.certifications && data.certifications) {
      imported.certifications = await this.importCertifications(userId, data.certifications);
    }

    return { imported };
  }

  /**
   * Map LinkedIn profile to user profile
   */
  async mapLinkedInProfile(userId, profile) {
    const connection = await this.database.getConnection();

    try {
      await connection.execute('BEGIN');

      // Update user profile with LinkedIn data
      const updates = {
        headline: profile.headline,
        summary: profile.summary,
        location: this.formatLocation(profile.location),
        industry: profile.industry,
        profilePicture: this.extractProfilePicture(profile.profilePicture),
        linkedinUrl: `https://www.linkedin.com/in/${profile.vanityName || profile.id}`
      };

      // Update user profile
      await connection.execute(
        `UPDATE pf_user_profiles 
         SET headline = :headline, summary = :summary, location = :location,
             industry = :industry, linkedin_url = :linkedinUrl,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = :userId`,
        { ...updates, userId }
      );

      // Update user avatar if provided
      if (updates.profilePicture) {
        await connection.execute(
          `UPDATE pf_users SET avatar_url = :avatarUrl WHERE user_id = :userId`,
          { avatarUrl: updates.profilePicture, userId }
        );
      }

      await connection.execute('COMMIT');

      logger.info('LinkedIn profile mapped', { userId });

      return { mapped: true, updates };
    } catch (error) {
      await connection.execute('ROLLBACK');
      logger.error('Failed to map LinkedIn profile', { error: error.message, userId });
      throw new DatabaseError('Failed to map LinkedIn profile');
    } finally {
      await connection.close();
    }
  }

  /**
   * Format location from LinkedIn data
   */
  formatLocation(location) {
    if (!location) return null;

    if (typeof location === 'string') return location;

    const parts = [];
    if (location.city) parts.push(location.city);
    if (location.state) parts.push(location.state);
    if (location.country) parts.push(location.country);

    return parts.join(', ');
  }

  /**
   * Extract profile picture URL
   */
  extractProfilePicture(profilePicture) {
    if (!profilePicture) return null;

    if (typeof profilePicture === 'string') return profilePicture;

    // LinkedIn API v2 format
    if (profilePicture.displayImage) {
      const elements = profilePicture.displayImage['com.linkedin.digitalmedia.mediaartifact.StillImage']?.storageAspectRatio?.elements;
      if (elements && elements.length > 0) {
        // Get the largest image
        const sorted = elements.sort((a, b) => b.width - a.width);
        return sorted[0].identifiers[0].identifier;
      }
    }

    return null;
  }
}

module.exports = ProfileImportService;