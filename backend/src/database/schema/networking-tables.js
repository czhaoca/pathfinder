/**
 * Professional Networking Tables
 */

async function createNetworkingTables(db, prefix = 'pf_') {
  // Professional contacts
  await db.execute(`
    CREATE TABLE ${prefix}professional_contacts (
      contact_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      full_name VARCHAR2(200) NOT NULL,
      email VARCHAR2(255),
      phone VARCHAR2(50),
      linkedin_url VARCHAR2(500),
      current_title VARCHAR2(200),
      current_company VARCHAR2(200),
      location VARCHAR2(200),
      relationship_type VARCHAR2(50) CHECK (
        relationship_type IN ('colleague', 'mentor', 'mentee', 'client', 'partner', 'recruiter', 'friend', 'other')
      ),
      relationship_strength NUMBER(1) CHECK (relationship_strength BETWEEN 1 AND 5),
      first_met_date DATE,
      first_met_context VARCHAR2(500),
      last_contact_date DATE,
      tags CLOB CHECK (tags IS JSON),
      notes CLOB,
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_contact_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Networking interactions
  await db.execute(`
    CREATE TABLE ${prefix}networking_interactions (
      interaction_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      contact_id VARCHAR2(26) NOT NULL,
      interaction_type VARCHAR2(50) CHECK (
        interaction_type IN ('meeting', 'call', 'email', 'message', 'event', 'coffee_chat', 'interview', 'other')
      ),
      interaction_date TIMESTAMP NOT NULL,
      duration_minutes NUMBER(10),
      location VARCHAR2(200),
      purpose VARCHAR2(500),
      key_topics CLOB CHECK (key_topics IS JSON),
      outcomes CLOB,
      follow_up_actions CLOB CHECK (follow_up_actions IS JSON),
      sentiment VARCHAR2(20) CHECK (sentiment IN ('positive', 'neutral', 'negative')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_interaction_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_interaction_contact FOREIGN KEY (contact_id) 
        REFERENCES ${prefix}professional_contacts(contact_id) ON DELETE CASCADE
    )
  `);

  // Networking goals
  await db.execute(`
    CREATE TABLE ${prefix}networking_goals (
      goal_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      goal_type VARCHAR2(50) CHECK (
        goal_type IN ('expand_network', 'deepen_relationships', 'find_mentor', 'find_job', 'build_partnerships', 'other')
      ),
      title VARCHAR2(200) NOT NULL,
      description CLOB,
      target_date DATE,
      target_metrics CLOB CHECK (target_metrics IS JSON),
      current_progress CLOB CHECK (current_progress IS JSON),
      status VARCHAR2(20) DEFAULT 'active' CHECK (
        status IN ('active', 'completed', 'paused', 'cancelled')
      ),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_netgoal_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Contact reminders
  await db.execute(`
    CREATE TABLE ${prefix}contact_reminders (
      reminder_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      contact_id VARCHAR2(26) NOT NULL,
      reminder_type VARCHAR2(50) CHECK (
        reminder_type IN ('follow_up', 'check_in', 'birthday', 'anniversary', 'custom')
      ),
      reminder_date DATE NOT NULL,
      reminder_time VARCHAR2(5),
      title VARCHAR2(200) NOT NULL,
      description CLOB,
      is_recurring CHAR(1) DEFAULT 'N' CHECK (is_recurring IN ('Y', 'N')),
      recurrence_pattern VARCHAR2(50),
      status VARCHAR2(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'completed', 'dismissed', 'snoozed')
      ),
      completed_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_reminder_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_reminder_contact FOREIGN KEY (contact_id) 
        REFERENCES ${prefix}professional_contacts(contact_id) ON DELETE CASCADE
    )
  `);

  // Networking events
  await db.execute(`
    CREATE TABLE ${prefix}networking_events (
      event_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      event_name VARCHAR2(200) NOT NULL,
      event_type VARCHAR2(50) CHECK (
        event_type IN ('conference', 'meetup', 'workshop', 'webinar', 'social', 'job_fair', 'other')
      ),
      event_date DATE NOT NULL,
      location VARCHAR2(200),
      is_virtual CHAR(1) DEFAULT 'N' CHECK (is_virtual IN ('Y', 'N')),
      organizer VARCHAR2(200),
      description CLOB,
      attendees_met CLOB CHECK (attendees_met IS JSON),
      key_takeaways CLOB,
      follow_ups CLOB CHECK (follow_ups IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_event_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Referral tracking
  await db.execute(`
    CREATE TABLE ${prefix}referral_tracking (
      referral_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      referrer_contact_id VARCHAR2(26),
      referral_type VARCHAR2(50) CHECK (
        referral_type IN ('job', 'client', 'partnership', 'introduction', 'other')
      ),
      company VARCHAR2(200),
      position VARCHAR2(200),
      referral_date DATE NOT NULL,
      status VARCHAR2(50) CHECK (
        status IN ('pending', 'in_progress', 'successful', 'unsuccessful', 'withdrawn')
      ),
      outcome CLOB,
      notes CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_referral_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_referral_contact FOREIGN KEY (referrer_contact_id) 
        REFERENCES ${prefix}professional_contacts(contact_id) ON DELETE SET NULL
    )
  `);
}

module.exports = createNetworkingTables;