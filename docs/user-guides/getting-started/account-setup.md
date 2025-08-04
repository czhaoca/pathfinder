# Account Setup Guide

Complete guide to setting up and configuring your Pathfinder account for optimal career management.

## 📝 Account Creation

### Registration Process

1. **Navigate to Sign Up**
   ```
   https://app.pathfinder.ai/signup
   ```

2. **Choose Registration Method**
   - Email & Password (Recommended)
   - Google OAuth
   - LinkedIn OAuth
   - Microsoft OAuth

3. **Email Registration Details**
   ```javascript
   {
     "email": "jane.doe@example.com",
     "password": "MySecure#Pass123",
     "firstName": "Jane",
     "lastName": "Doe",
     "acceptTerms": true,
     "marketingEmails": false  // Optional
   }
   ```

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (!@#$%^&*)

### Email Verification
1. Check your email within 5 minutes
2. Click the verification link
3. If not received:
   - Check spam/junk folder
   - Click "Resend verification"
   - Add noreply@pathfinder.ai to contacts

## 🔐 Security Configuration

### Enable Two-Factor Authentication (Recommended)

1. **Navigate to Security Settings**
   ```
   Profile → Settings → Security → Two-Factor Authentication
   ```

2. **Choose 2FA Method**
   - **Authenticator App** (Most Secure)
     - Google Authenticator
     - Microsoft Authenticator
     - Authy
   - **SMS** (Convenient)
   - **Email** (Backup Option)

3. **Setup Authenticator App**
   ```
   1. Install authenticator app on phone
   2. Scan QR code displayed
   3. Enter 6-digit code to verify
   4. Save backup codes securely
   ```

### Backup Codes
```
IMPORTANT: Save these codes in a secure location
- H4K2-9PL5-MN87
- X3D4-7YU9-QW21
- B8N6-3RF2-KL90
- ... (8 more codes)
```

## 👤 Profile Configuration

### Basic Information

```javascript
{
  "profile": {
    "displayName": "Jane Doe",
    "headline": "Senior Software Engineer | Cloud Architecture | Team Lead",
    "location": {
      "city": "San Francisco",
      "state": "CA",
      "country": "USA",
      "remote": true
    },
    "contactInfo": {
      "phone": "+1-555-123-4567",
      "linkedIn": "linkedin.com/in/janedoe",
      "portfolio": "janedoe.dev",
      "github": "github.com/janedoe"
    }
  }
}
```

### Professional Summary

Write a compelling 2-3 paragraph summary:
```markdown
Experienced software engineer with 8+ years developing scalable cloud applications. 
Specialized in microservices architecture, DevOps practices, and team leadership. 
Passionate about mentoring junior developers and driving technical innovation.

Currently leading a team of 5 engineers at TechCorp, focusing on modernizing 
legacy systems and implementing cloud-native solutions. Seeking opportunities 
to leverage my technical expertise and leadership skills in a senior architect role.
```

### Career Preferences

```javascript
{
  "preferences": {
    "targetRoles": [
      "Senior Software Engineer",
      "Staff Engineer",
      "Engineering Manager",
      "Solutions Architect"
    ],
    "industries": [
      "Technology",
      "FinTech",
      "HealthTech",
      "E-commerce"
    ],
    "companySize": ["startup", "midsize", "enterprise"],
    "workStyle": ["remote", "hybrid"],
    "salaryRange": {
      "min": 150000,
      "max": 250000,
      "currency": "USD"
    }
  }
}
```

## 📥 Importing Existing Data

### Import from LinkedIn

1. **Export LinkedIn Data**
   ```
   LinkedIn → Settings & Privacy → Data Privacy → 
   Get a copy of your data → Select "Connections" and "Profile"
   ```

2. **Upload to Pathfinder**
   ```
   Dashboard → Import Data → LinkedIn → Upload ZIP file
   ```

3. **Review and Confirm**
   - Verify imported experiences
   - Check skill mappings
   - Update any outdated information

### Import from Resume (PDF/DOCX)

1. **Prepare Your Resume**
   - Ensure clear formatting
   - Include dates for all positions
   - List quantifiable achievements

2. **Upload Process**
   ```javascript
   // API Example
   POST /api/import/resume
   Content-Type: multipart/form-data
   
   {
     "file": resume.pdf,
     "parseOptions": {
       "extractSkills": true,
       "inferDates": true,
       "detectAchievements": true
     }
   }
   ```

3. **AI-Assisted Review**
   The AI will:
   - Extract experiences with 95% accuracy
   - Identify skills and technologies
   - Parse achievements and metrics
   - Flag any ambiguous information

### Manual Data Entry Template

For each experience, use this template:

```javascript
{
  "experience": {
    "title": "Senior Software Engineer",
    "company": "TechCorp Inc.",
    "location": "San Francisco, CA",
    "type": "full-time",
    "startDate": "2021-03",
    "endDate": "current",
    "description": "Lead engineer for cloud migration initiative...",
    "responsibilities": [
      "Architect and implement microservices using Node.js and Python",
      "Lead team of 5 engineers in Agile environment",
      "Design CI/CD pipelines using Jenkins and GitLab"
    ],
    "achievements": [
      {
        "description": "Reduced deployment time by 70%",
        "metric": "70%",
        "category": "efficiency"
      },
      {
        "description": "Improved system uptime to 99.99%",
        "metric": "99.99%",
        "category": "reliability"
      }
    ],
    "skills": [
      "Node.js", "Python", "AWS", "Docker", 
      "Kubernetes", "PostgreSQL", "Redis"
    ]
  }
}
```

## 🔔 Notification Settings

### Configure Email Notifications

```javascript
{
  "notifications": {
    "email": {
      "jobAlerts": true,
      "frequency": "daily",
      "profileViews": true,
      "weeklyInsights": true,
      "careerTips": true,
      "systemUpdates": false
    },
    "inApp": {
      "allNotifications": true
    }
  }
}
```

### Job Alert Configuration

```javascript
{
  "jobAlerts": {
    "keywords": ["senior engineer", "tech lead", "architect"],
    "locations": ["San Francisco", "Remote"],
    "salaryMin": 150000,
    "excludeCompanies": ["CurrentEmployer Inc."],
    "seniorityLevel": ["senior", "staff", "principal"]
  }
}
```

## 🌐 Privacy Settings

### Data Visibility Controls

```javascript
{
  "privacy": {
    "profileVisibility": "registered_users", // public, registered_users, private
    "showEmail": false,
    "showPhone": false,
    "showCurrentEmployer": true,
    "allowRecruiterContact": true,
    "shareWithPartners": false,
    "anonymousAnalytics": true
  }
}
```

### Data Sharing Preferences

- **Recruiter Access**: Allow verified recruiters to view profile
- **Company Research**: Share anonymized data for salary insights
- **AI Training**: Contribute to improving AI recommendations
- **Marketing**: Receive product updates and career tips

## 💾 Data Export

### Export Your Data

1. **Request Export**
   ```
   Settings → Privacy → Export Data → Request Export
   ```

2. **Export Formats Available**
   - JSON (Complete data)
   - PDF (Resume format)
   - CSV (Experiences and skills)
   - LinkedIn format (For re-import)

3. **Export Contents**
   ```javascript
   {
     "export": {
       "profile": {...},
       "experiences": [...],
       "skills": [...],
       "achievements": [...],
       "resumes": [...],
       "aiConversations": [...],
       "settings": {...},
       "exportDate": "2024-01-15T10:30:00Z"
     }
   }
   ```

## 🚨 Account Recovery

### Forgot Password

1. Click "Forgot Password" on login page
2. Enter registered email
3. Check email for reset link (valid for 1 hour)
4. Create new password following requirements

### Account Locked

After 5 failed login attempts:
1. Account locked for 30 minutes
2. Email sent with unlock link
3. Complete security verification
4. Reset password if compromised

### Deactivate Account

```
Settings → Account → Deactivate Account

Options:
1. Temporary Deactivation (Can reactivate anytime)
2. Permanent Deletion (30-day grace period)
```

## ✅ Setup Checklist

- [ ] Email verified
- [ ] Two-factor authentication enabled
- [ ] Profile photo uploaded
- [ ] Professional summary written
- [ ] At least 3 experiences added
- [ ] Skills validated by AI
- [ ] Career preferences configured
- [ ] Privacy settings reviewed
- [ ] Notification preferences set
- [ ] First resume generated

## 🎯 Next Steps

1. [Add Your First Experience](./first-experience.md)
2. [Configure AI Assistant](./using-ai-chat.md)
3. [Set Career Goals](../features/career-path-planning.md)
4. [Build Your Network](../features/professional-networking.md)

---

**Questions?** Contact support@pathfinder.ai or use the in-app chat for immediate assistance.