/**
 * Seed script for progressive profile fields
 */

const { ulid } = require('ulid');

async function seedProfileFields(db, prefix = 'pf_') {
  console.log('Seeding profile fields...');

  // Define profile fields
  const profileFields = [
    // Personal Information (Essential)
    {
      field_name: 'first_name',
      field_label: 'First Name',
      field_type: 'text',
      field_group: 'personal',
      validation_rules: JSON.stringify({
        required: true,
        minLength: 1,
        maxLength: 100
      }),
      help_text: 'Your legal first name',
      placeholder: 'John',
      is_essential: 'Y',
      display_order: 1
    },
    {
      field_name: 'last_name',
      field_label: 'Last Name',
      field_type: 'text',
      field_group: 'personal',
      validation_rules: JSON.stringify({
        required: true,
        minLength: 1,
        maxLength: 100
      }),
      help_text: 'Your legal last name',
      placeholder: 'Doe',
      is_essential: 'Y',
      display_order: 2
    },
    {
      field_name: 'email',
      field_label: 'Email Address',
      field_type: 'email',
      field_group: 'personal',
      validation_rules: JSON.stringify({
        required: true
      }),
      help_text: 'Your primary email address',
      placeholder: 'john.doe@example.com',
      is_essential: 'Y',
      display_order: 3
    },
    {
      field_name: 'phone_number',
      field_label: 'Phone Number',
      field_type: 'phone',
      field_group: 'personal',
      validation_rules: JSON.stringify({
        required: false
      }),
      help_text: 'Your mobile or work phone number',
      placeholder: '+1 (555) 123-4567',
      is_essential: 'N',
      display_order: 4
    },
    {
      field_name: 'date_of_birth',
      field_label: 'Date of Birth',
      field_type: 'date',
      field_group: 'personal',
      validation_rules: JSON.stringify({
        required: false
      }),
      help_text: 'Your date of birth',
      is_essential: 'N',
      is_sensitive: 'Y',
      encryption_required: 'Y',
      display_order: 5
    },

    // Professional Information
    {
      field_name: 'current_title',
      field_label: 'Current Job Title',
      field_type: 'text',
      field_group: 'professional',
      validation_rules: JSON.stringify({
        maxLength: 200
      }),
      help_text: 'Your current professional title',
      placeholder: 'Software Engineer',
      is_essential: 'N',
      display_order: 10
    },
    {
      field_name: 'current_company',
      field_label: 'Current Company',
      field_type: 'text',
      field_group: 'professional',
      validation_rules: JSON.stringify({
        maxLength: 200
      }),
      help_text: 'Your current employer',
      placeholder: 'Tech Corp',
      is_essential: 'N',
      display_order: 11
    },
    {
      field_name: 'years_experience',
      field_label: 'Years of Experience',
      field_type: 'number',
      field_group: 'professional',
      validation_rules: JSON.stringify({
        min: 0,
        max: 50
      }),
      help_text: 'Total years of professional experience',
      placeholder: '5',
      is_essential: 'N',
      display_order: 12
    },
    {
      field_name: 'industry',
      field_label: 'Industry',
      field_type: 'select',
      field_group: 'professional',
      options: JSON.stringify([
        { value: 'technology', label: 'Technology' },
        { value: 'finance', label: 'Finance' },
        { value: 'healthcare', label: 'Healthcare' },
        { value: 'education', label: 'Education' },
        { value: 'retail', label: 'Retail' },
        { value: 'manufacturing', label: 'Manufacturing' },
        { value: 'consulting', label: 'Consulting' },
        { value: 'other', label: 'Other' }
      ]),
      help_text: 'Your primary industry',
      is_essential: 'N',
      display_order: 13
    },
    {
      field_name: 'skills',
      field_label: 'Skills',
      field_type: 'textarea',
      field_group: 'professional',
      validation_rules: JSON.stringify({
        maxLength: 1000
      }),
      help_text: 'List your key professional skills (comma-separated)',
      placeholder: 'JavaScript, Python, Project Management',
      is_essential: 'N',
      display_order: 14
    },
    {
      field_name: 'professional_headline',
      field_label: 'Professional Headline',
      field_type: 'text',
      field_group: 'professional',
      validation_rules: JSON.stringify({
        maxLength: 200
      }),
      help_text: 'A brief professional tagline',
      placeholder: 'Experienced Software Engineer specializing in web applications',
      is_essential: 'N',
      display_order: 15
    },

    // Location Information
    {
      field_name: 'location',
      field_label: 'Location',
      field_type: 'text',
      field_group: 'location',
      validation_rules: JSON.stringify({
        maxLength: 200
      }),
      help_text: 'Your current city and state/country',
      placeholder: 'San Francisco, CA',
      is_essential: 'N',
      display_order: 20
    },
    {
      field_name: 'timezone',
      field_label: 'Timezone',
      field_type: 'select',
      field_group: 'location',
      options: JSON.stringify([
        { value: 'PST', label: 'Pacific Time (PST/PDT)' },
        { value: 'MST', label: 'Mountain Time (MST/MDT)' },
        { value: 'CST', label: 'Central Time (CST/CDT)' },
        { value: 'EST', label: 'Eastern Time (EST/EDT)' },
        { value: 'GMT', label: 'Greenwich Mean Time (GMT)' },
        { value: 'CET', label: 'Central European Time (CET)' },
        { value: 'JST', label: 'Japan Standard Time (JST)' },
        { value: 'AEST', label: 'Australian Eastern Time (AEST)' }
      ]),
      help_text: 'Your primary timezone',
      is_essential: 'N',
      display_order: 21
    },

    // Education
    {
      field_name: 'education_institution',
      field_label: 'Education Institution',
      field_type: 'text',
      field_group: 'education',
      validation_rules: JSON.stringify({
        maxLength: 200
      }),
      help_text: 'Your highest degree institution',
      placeholder: 'Stanford University',
      is_essential: 'N',
      display_order: 30
    },
    {
      field_name: 'highest_degree',
      field_label: 'Highest Degree',
      field_type: 'select',
      field_group: 'education',
      options: JSON.stringify([
        { value: 'high_school', label: 'High School' },
        { value: 'associates', label: 'Associate Degree' },
        { value: 'bachelors', label: 'Bachelor\'s Degree' },
        { value: 'masters', label: 'Master\'s Degree' },
        { value: 'doctorate', label: 'Doctorate' },
        { value: 'professional', label: 'Professional Degree' },
        { value: 'other', label: 'Other' }
      ]),
      help_text: 'Your highest completed degree',
      is_essential: 'N',
      display_order: 31
    },
    {
      field_name: 'field_of_study',
      field_label: 'Field of Study',
      field_type: 'text',
      field_group: 'education',
      validation_rules: JSON.stringify({
        maxLength: 200
      }),
      help_text: 'Your major or field of study',
      placeholder: 'Computer Science',
      is_essential: 'N',
      display_order: 32
    },

    // Profile & Bio
    {
      field_name: 'bio',
      field_label: 'Bio',
      field_type: 'textarea',
      field_group: 'profile',
      validation_rules: JSON.stringify({
        maxLength: 2000
      }),
      help_text: 'A brief description about yourself',
      placeholder: 'Tell us about yourself, your interests, and goals...',
      is_essential: 'N',
      display_order: 40
    },
    {
      field_name: 'linkedin_url',
      field_label: 'LinkedIn Profile',
      field_type: 'url',
      field_group: 'profile',
      validation_rules: JSON.stringify({
        pattern: '^https?://([\\w]+\\.)?linkedin\\.com/.*$',
        patternMessage: 'Must be a valid LinkedIn URL'
      }),
      help_text: 'Your LinkedIn profile URL',
      placeholder: 'https://linkedin.com/in/johndoe',
      is_essential: 'N',
      display_order: 41
    },
    {
      field_name: 'portfolio_url',
      field_label: 'Portfolio/Website',
      field_type: 'url',
      field_group: 'profile',
      help_text: 'Your personal website or portfolio',
      placeholder: 'https://johndoe.com',
      is_essential: 'N',
      display_order: 42
    },

    // Preferences
    {
      field_name: 'preferred_language',
      field_label: 'Preferred Language',
      field_type: 'select',
      field_group: 'preferences',
      options: JSON.stringify([
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
        { value: 'de', label: 'German' },
        { value: 'zh', label: 'Chinese' },
        { value: 'ja', label: 'Japanese' },
        { value: 'ko', label: 'Korean' },
        { value: 'pt', label: 'Portuguese' }
      ]),
      help_text: 'Your preferred language for communication',
      default_value: 'en',
      is_essential: 'N',
      display_order: 50
    },
    {
      field_name: 'notification_preferences',
      field_label: 'Notification Preferences',
      field_type: 'checkbox',
      field_group: 'preferences',
      options: JSON.stringify([
        { value: 'email', label: 'Email notifications' },
        { value: 'sms', label: 'SMS notifications' },
        { value: 'push', label: 'Push notifications' }
      ]),
      help_text: 'How would you like to receive notifications?',
      is_essential: 'N',
      display_order: 51
    }
  ];

  // Insert profile fields
  for (const field of profileFields) {
    try {
      const checkQuery = `
        SELECT field_id FROM ${prefix}profile_fields 
        WHERE field_name = :field_name
      `;
      
      const existing = await db.execute(checkQuery, [field.field_name]);
      
      if (existing.rows.length === 0) {
        const insertQuery = `
          INSERT INTO ${prefix}profile_fields (
            field_id,
            field_name,
            field_label,
            field_type,
            field_group,
            validation_rules,
            options,
            help_text,
            placeholder,
            default_value,
            is_essential,
            is_sensitive,
            encryption_required,
            display_order,
            is_active
          ) VALUES (
            :field_id,
            :field_name,
            :field_label,
            :field_type,
            :field_group,
            :validation_rules,
            :options,
            :help_text,
            :placeholder,
            :default_value,
            :is_essential,
            :is_sensitive,
            :encryption_required,
            :display_order,
            :is_active
          )
        `;

        await db.execute(insertQuery, {
          field_id: ulid(),
          field_name: field.field_name,
          field_label: field.field_label,
          field_type: field.field_type,
          field_group: field.field_group || null,
          validation_rules: field.validation_rules || null,
          options: field.options || null,
          help_text: field.help_text || null,
          placeholder: field.placeholder || null,
          default_value: field.default_value || null,
          is_essential: field.is_essential || 'N',
          is_sensitive: field.is_sensitive || 'N',
          encryption_required: field.encryption_required || 'N',
          display_order: field.display_order || 0,
          is_active: 'Y'
        });

        console.log(`✓ Created field: ${field.field_name}`);
      } else {
        console.log(`- Field already exists: ${field.field_name}`);
      }
    } catch (error) {
      console.error(`✗ Failed to create field ${field.field_name}:`, error.message);
    }
  }

  // Seed feature requirements
  console.log('\nSeeding feature requirements...');

  const featureRequirements = [
    // Resume Builder Requirements
    {
      feature_key: 'resume_builder',
      requirements: [
        { field_name: 'first_name', requirement_level: 'required' },
        { field_name: 'last_name', requirement_level: 'required' },
        { field_name: 'email', requirement_level: 'required' },
        { field_name: 'phone_number', requirement_level: 'required' },
        { field_name: 'current_title', requirement_level: 'required' },
        { field_name: 'years_experience', requirement_level: 'recommended' },
        { field_name: 'skills', requirement_level: 'recommended' },
        { field_name: 'education_institution', requirement_level: 'recommended' },
        { field_name: 'highest_degree', requirement_level: 'recommended' }
      ]
    },
    // Networking Features
    {
      feature_key: 'networking',
      requirements: [
        { field_name: 'first_name', requirement_level: 'required' },
        { field_name: 'last_name', requirement_level: 'required' },
        { field_name: 'current_title', requirement_level: 'required' },
        { field_name: 'linkedin_url', requirement_level: 'recommended' },
        { field_name: 'bio', requirement_level: 'recommended' }
      ]
    },
    // Advanced Search
    {
      feature_key: 'advanced_search',
      requirements: [
        { field_name: 'location', requirement_level: 'required' },
        { field_name: 'industry', requirement_level: 'required' },
        { field_name: 'years_experience', requirement_level: 'recommended' }
      ]
    },
    // Career Path Analysis
    {
      feature_key: 'career_path_analysis',
      requirements: [
        { field_name: 'current_title', requirement_level: 'required' },
        { field_name: 'years_experience', requirement_level: 'required' },
        { field_name: 'industry', requirement_level: 'required' },
        { field_name: 'skills', requirement_level: 'required' },
        { field_name: 'highest_degree', requirement_level: 'recommended' }
      ]
    }
  ];

  for (const feature of featureRequirements) {
    console.log(`\nSetting requirements for feature: ${feature.feature_key}`);
    
    for (const req of feature.requirements) {
      try {
        // Get field ID
        const fieldQuery = `
          SELECT field_id FROM ${prefix}profile_fields 
          WHERE field_name = :field_name
        `;
        
        const fieldResult = await db.execute(fieldQuery, [req.field_name]);
        
        if (fieldResult.rows.length > 0) {
          const fieldId = fieldResult.rows[0].field_id;
          
          // Check if requirement exists
          const checkQuery = `
            SELECT requirement_id FROM ${prefix}feature_field_requirements
            WHERE feature_key = :feature_key AND field_id = :field_id
          `;
          
          const existing = await db.execute(checkQuery, [feature.feature_key, fieldId]);
          
          if (existing.rows.length === 0) {
            const insertQuery = `
              INSERT INTO ${prefix}feature_field_requirements (
                requirement_id,
                feature_key,
                field_id,
                is_required,
                requirement_level,
                custom_message
              ) VALUES (
                :requirement_id,
                :feature_key,
                :field_id,
                :is_required,
                :requirement_level,
                :custom_message
              )
            `;

            await db.execute(insertQuery, {
              requirement_id: ulid(),
              feature_key: feature.feature_key,
              field_id: fieldId,
              is_required: req.requirement_level === 'required' ? 'Y' : 'N',
              requirement_level: req.requirement_level,
              custom_message: req.custom_message || null
            });

            console.log(`  ✓ Added ${req.requirement_level} requirement: ${req.field_name}`);
          } else {
            console.log(`  - Requirement already exists: ${req.field_name}`);
          }
        } else {
          console.log(`  ✗ Field not found: ${req.field_name}`);
        }
      } catch (error) {
        console.error(`  ✗ Failed to add requirement for ${req.field_name}:`, error.message);
      }
    }
  }

  console.log('\n✓ Profile fields seeding complete');
}

module.exports = seedProfileFields;