# Career Navigator MCP Tools Reference

Complete guide to using Career Navigator MCP tools for AI-powered career conversations.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Core Data Management Tools](#core-data-management-tools)
- [Context Retrieval Tools](#context-retrieval-tools)
- [Analysis & Recommendation Tools](#analysis--recommendation-tools)
- [Profile Management Tools](#profile-management-tools)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Performance Guidelines](#performance-guidelines)

## Overview

Career Navigator MCP provides 8 professional tools designed to enhance AI conversations about your career. These tools operate on a three-tier architecture optimized for different conversation needs:

- **Quick Context** (< 10ms) - Instant conversation initialization
- **Detailed Profile** (< 50ms) - Comprehensive career analysis  
- **Full Experiences** (< 200ms) - Specific experience discussions

## Getting Started

### Prerequisites

Before using MCP tools, ensure:

1. **MCP Server Running**: Your Career Navigator MCP server is active
2. **AI Assistant Connected**: Claude Desktop or compatible AI assistant configured
3. **Sample Data**: Loaded with `npm run db:seed:dev` (for testing)

### Basic Usage Pattern

Most AI conversations with Career Navigator follow this pattern:

```
1. Initial Context → get_quick_context (AI understands your background)
2. Specific Analysis → get_detailed_profile or search_experiences  
3. Action/Updates → store_experience, update_profile, etc.
```

## Core Data Management Tools

### store_experience

**Purpose**: Add new professional experiences to your profile  
**Performance**: < 500ms  
**Best for**: Adding recent work, education, projects, or achievements

#### Input Parameters

```javascript
{
  title: string,              // Required: Experience title/role
  organization: string,       // Optional: Company/institution name
  description: string,        // Required: Detailed description (max 5000 chars)
  startDate: string,         // Required: ISO date format (YYYY-MM-DD)
  endDate: string,           // Optional: ISO date format (null for current)
  isCurrent: boolean,        // Optional: Whether experience is ongoing
  experienceType: string,    // Required: work|education|volunteer|project|hobby|certification
  extractedSkills: array,   // Optional: Skills with proficiency levels
  keyHighlights: array,     // Optional: Achievements and impacts
  roleMappings: object,     // Optional: Career role connections
  industryTags: array,      // Optional: Industry classifications
  impactMetrics: object     // Optional: Quantifiable achievements
}
```

#### Example Usage

**In AI Conversation:**
```
You: "I just finished leading a major product launch at my company. Let me add this to my profile."

AI: "I'll help you add this experience. Let me capture the details..."
→ Calls store_experience tool
→ Prompts for key information: title, organization, description, dates
→ Asks about skills demonstrated and achievements
→ Stores complete experience with metadata
→ Confirms successful storage
```

**Detailed Example:**
```javascript
// What gets stored:
{
  title: "Senior Product Manager",
  organization: "TechCorp Inc",
  description: "Led cross-functional team of 12 to launch flagship mobile app serving 50K+ users. Managed product roadmap, stakeholder communication, and go-to-market strategy. Achieved 4.8 App Store rating and 30% increase in user engagement.",
  startDate: "2023-01-15",
  endDate: "2024-02-28", 
  isCurrent: false,
  experienceType: "work",
  extractedSkills: [
    { name: "Product Management", category: "soft", proficiency: "advanced" },
    { name: "Team Leadership", category: "soft", proficiency: "intermediate" },
    { name: "Data Analysis", category: "technical", proficiency: "intermediate" }
  ],
  keyHighlights: [
    { description: "Led team of 12 cross-functional members", impact: "high" },
    { description: "Achieved 4.8/5.0 App Store rating", impact: "high" },
    { description: "Increased user engagement by 30%", impact: "medium" }
  ],
  impactMetrics: {
    teamSize: 12,
    usersServed: 50000,
    appStoreRating: 4.8,
    engagementIncrease: 30
  }
}
```

#### Best Practices

- **Be Specific**: Include quantifiable achievements and impact metrics
- **Use Keywords**: Include industry-relevant terms for better searchability
- **Regular Updates**: Add experiences soon after completing them
- **Categorize Skills**: Specify technical vs. soft skills with proficiency levels

### search_experiences

**Purpose**: Find specific experiences using advanced filters  
**Performance**: < 200ms  
**Best for**: Locating relevant experiences for specific career discussions

#### Input Parameters

```javascript
{
  query: string,           // Optional: Text search across titles/descriptions
  experienceType: string,  // Optional: work|education|volunteer|project|hobby|certification
  isCurrent: boolean,      // Optional: Filter for current/past experiences
  dateFrom: string,        // Optional: Start date filter (YYYY-MM-DD)
  dateTo: string,         // Optional: End date filter (YYYY-MM-DD)
  limit: number           // Optional: Max results (1-50, default 10)
}
```

#### Example Usage

**Leadership Experience Search:**
```
You: "Can you show me examples of my leadership experience?"

AI: "Let me search through your experiences for leadership examples..."
→ Calls search_experiences({ query: "leadership team management", limit: 5 })
→ Returns relevant experiences with leadership components
→ Analyzes and presents leadership progression over time
```

**Technical Skills Search:**
```
You: "What JavaScript projects have I worked on?"

AI: "I'll search for your JavaScript-related experiences..."
→ Calls search_experiences({ query: "JavaScript React Node", experienceType: "work" })
→ Finds work experiences mentioning these technologies
→ Discusses technical progression and project complexity
```

#### Advanced Search Examples

```javascript
// Find recent work experiences
{ experienceType: "work", dateFrom: "2022-01-01", limit: 10 }

// Search current projects and roles
{ isCurrent: true }

// Find education and certifications  
{ experienceType: ["education", "certification"] }

// Search by skills or technologies
{ query: "Python machine learning data science" }

// Timeline-based search
{ dateFrom: "2020-01-01", dateTo: "2023-12-31" }
```

## Context Retrieval Tools

### get_quick_context

**Purpose**: Rapid professional summary for AI conversation initialization  
**Performance**: < 10ms (optimized for instant response)  
**Best for**: Starting career conversations, providing basic context

#### No Input Parameters Required

This tool retrieves your optimized professional summary automatically.

#### Response Format

```javascript
{
  executiveSummary: "2-3 sentence professional overview",
  keySkills: ["Top", "8-10", "Professional", "Skills"], 
  careerGoals: "Current career objectives and aspirations",
  yearsExperience: 5,
  currentRole: "Current job title or status",
  industries: ["Primary", "Industries", "Of", "Experience"],
  educationLevel: "Highest education achieved",
  location: "Current location or preference", 
  availability: "Current availability status",
  lastUpdated: "2024-01-15T10:30:00Z",
  responseTime: "8ms"
}
```

#### Example Usage

**Conversation Starter:**
```
You: "I need help with career planning. Can you start by understanding my background?"

AI: "Let me get your professional context first..."
→ Calls get_quick_context
→ Receives instant summary of your background
→ Responds: "I can see you're an experienced software engineer with 4+ years in full-stack development, currently seeking technical leadership opportunities. Your key strengths include JavaScript, React, team leadership, and you have experience in technology and fintech industries. How can I help with your career planning?"
```

#### When Quick Context is Used

- **Conversation initialization** - AI gets context about who you are
- **Context switching** - Moving between different career topics
- **Background verification** - Confirming current status before advice
- **Summary generation** - Creating overviews for specific purposes

### get_detailed_profile

**Purpose**: Comprehensive career analysis for in-depth discussions  
**Performance**: < 50ms  
**Best for**: Career planning, skills assessment, transition guidance

#### No Input Parameters Required

Retrieves your complete professional profile with career analysis.

#### Response Format

```javascript
{
  coreStrengths: {
    technical: ["Advanced technical skills with evidence"],
    leadership: ["Management and mentoring experience"], 
    communication: ["Writing, presenting, teaching abilities"]
  },
  careerInterests: {
    primaryAreas: ["Career focus areas"],
    industries: ["Target industries"],
    roleTypes: ["Desired role types"],
    workEnvironment: ["Preferred work settings"]
  },
  careerProgression: {
    timeline: [/* chronological career development */],
    growthPattern: "Identified progression pattern",
    nextSteps: ["Recommended development areas"],
    careerVelocity: "Advancement pattern analysis"
  },
  industryExperience: {
    primary: "Main industry experience",
    secondary: ["Additional industry exposure"],
    domainExpertise: ["Specialized knowledge areas"]
  },
  // ... additional comprehensive profile data
}
```

#### Example Usage

**Career Transition Planning:**
```
You: "I want to move from software engineering into product management. What should I consider?"

AI: "Let me analyze your detailed profile to assess your readiness for this transition..."
→ Calls get_detailed_profile
→ Reviews technical background, leadership experience, business skills
→ Identifies transferable skills and gaps
→ Provides personalized transition roadmap

"Based on your profile, you have strong technical foundations and I can see you've already led cross-functional projects and mentored team members. For product management, you'd leverage your technical expertise while developing business strategy skills..."
```

**Skills Assessment:**
```
You: "What are my strongest professional capabilities?"

AI: "I'll analyze your comprehensive profile to identify your core strengths..."
→ Calls get_detailed_profile
→ Reviews all experience categories and achievements
→ Analyzes patterns across roles and projects
→ Presents strengths with supporting evidence

"Your strongest capabilities cluster around three areas: 1) Technical Leadership - evidenced by leading teams of 4+ developers, 2) Full-Stack Development - demonstrated across 5 different projects, 3) Mentoring & Teaching - shown through 7+ mentoring relationships..."
```

## Analysis & Recommendation Tools

### get_skills_analysis

**Purpose**: Comprehensive skills analysis across all experiences  
**Performance**: < 200ms  
**Best for**: Skills gap analysis, career development planning, positioning

#### No Input Parameters Required

Analyzes skills frequency, categories, and growth potential across all experiences.

#### Response Format

```javascript
{
  topSkills: [
    { skill: "JavaScript", frequency: 5, category: "technical" },
    { skill: "Leadership", frequency: 3, category: "soft" }
  ],
  categorizedSkills: {
    technical: [/* ranked technical skills */],
    soft: [/* ranked interpersonal skills */],
    industrySpecific: [/* specialized domain skills */]
  },
  skillsGrowthPotential: {
    recommendedSkills: ["Skills to develop based on market demand"],
    note: "Analysis basis and recommendations"
  },
  totalUniqueSkills: 45,
  analysisDate: "2024-01-15T10:30:00Z"
}
```

#### Example Usage

**Skills Gap Analysis:**
```
You: "I want to become a senior engineer. What skills should I focus on developing?"

AI: "Let me analyze your current skills across all experiences..."
→ Calls get_skills_analysis  
→ Reviews skill frequency and proficiency across experiences
→ Compares against senior engineering requirements
→ Identifies development priorities

"Your skills analysis shows strong foundations in JavaScript (5 experiences), React (4 experiences), and team collaboration (3 experiences). For senior engineering roles, I recommend developing: 1) System Architecture & Design, 2) Mentoring & Code Review, 3) Technical Strategy & Planning. These build on your current strengths while addressing senior-level expectations."
```

**Resume Optimization:**
```
You: "Which skills should I emphasize on my resume for tech lead positions?"

AI: "I'll analyze your skills to identify the most relevant for tech lead roles..."
→ Calls get_skills_analysis
→ Filters skills by leadership and technical relevance
→ Ranks by frequency and market demand
→ Suggests positioning strategy

"Based on your experience, emphasize these skills for tech lead positions: 1) JavaScript/TypeScript (appears in 5 experiences, advanced level), 2) Team Leadership (3 experiences with increasing responsibility), 3) Architecture & System Design (demonstrated in 2 major projects)..."
```

### get_career_suggestions

**Purpose**: AI-powered career path recommendations  
**Performance**: < 200ms  
**Best for**: Career exploration, transition planning, opportunity identification

#### No Input Parameters Required

Generates personalized career recommendations based on your complete profile.

#### Response Format

```javascript
{
  careerSuggestions: [
    {
      careerPath: "Technical Leadership",
      alignment: "High", // High/Medium/Low
      nextSteps: ["Specific development recommendations"],
      growthOutlook: "Excellent", // Excellent/Strong/Good/Limited
      rationale: "Why this path aligns with your background"
    }
  ],
  basedOnProfile: true,
  basedOnQuickContext: true,
  generatedAt: "2024-01-15T10:30:00Z"
}
```

#### Example Usage

**Career Exploration:**
```
You: "What career paths would be good fits for my background and interests?"

AI: "Let me analyze your profile and generate personalized career suggestions..."
→ Calls get_career_suggestions
→ Analyzes skills, experience patterns, and career interests
→ Generates ranked recommendations with rationale
→ Provides actionable next steps for each path

"Based on your background, I see three strong career paths: 1) Technical Leadership (High alignment) - Your experience leading teams of 4+ developers and delivering complex projects positions you well. Next steps: system architecture certification, strategic planning experience. 2) Product Engineering (High alignment) - Your full-stack skills plus user-focused project experience... 3) Engineering Management (Medium alignment)..."
```

**Career Pivot Analysis:**
```
You: "I'm considering a move into data science. Does that make sense given my background?"

AI: "Let me analyze how your current experience aligns with data science careers..."
→ Calls get_career_suggestions  
→ Evaluates technical transferable skills
→ Assesses learning curve and development needs
→ Provides realistic transition assessment

"Data science shows Medium alignment with your background. Strengths: Your Python experience (3 projects) and analytical thinking (demonstrated in performance optimization work) provide a foundation. Development needed: Statistics/ML fundamentals, data visualization, domain expertise. Recommended transition path: 1) Complete ML certification, 2) Take on data-driven projects in current role..."
```

## Profile Management Tools

### update_profile

**Purpose**: Update comprehensive career analysis and profile data  
**Performance**: < 200ms  
**Best for**: Refreshing career analysis after new experiences

#### Input Parameters

```javascript
{
  coreStrengths: object,      // Optional: Updated strengths analysis
  careerInterests: object,    // Optional: Career interests and goals
  careerProgression: object,  // Optional: Progression timeline
  industryExperience: object, // Optional: Industry experience summary
  leadershipProfile: object,  // Optional: Leadership experience analysis
  technicalProfile: object,   // Optional: Technical skills assessment
  softSkillsProfile: object,  // Optional: Interpersonal skills analysis
  educationSummary: object,   // Optional: Education background
  achievementHighlights: object // Optional: Top career achievements
}
```

#### Example Usage

**After Adding New Experiences:**
```
You: "I just added several new work experiences. Can you update my overall profile analysis?"

AI: "I'll update your comprehensive profile to reflect your new experiences..."
→ Calls update_profile with refreshed analysis
→ Aggregates insights from all experiences including new ones
→ Updates career progression patterns and strengths
→ Confirms profile refresh completion

"Your profile has been updated to include your recent experiences. I can see your leadership progression from individual contributor to team lead, and your technical skills have expanded to include cloud architecture. Your updated profile now reflects 4+ years of progressive experience."
```

**Career Focus Refinement:**
```
You: "I've decided to focus more on technical architecture roles. Can we update my career interests?"

AI: "I'll update your profile to reflect your focus on technical architecture..."
→ Calls update_profile with revised career interests
→ Updates target roles, skills emphasis, and development goals
→ Aligns profile with new career direction

"Updated your career interests to emphasize technical architecture. This will help me provide more targeted advice for system design roles, architecture certifications, and related opportunities."
```

### update_quick_summary

**Purpose**: Optimize rapid-access summary for AI conversations  
**Performance**: < 100ms  
**Best for**: Refreshing conversation context after profile changes

#### Input Parameters

```javascript
{
  executiveSummary: string,    // Optional: Updated 2-3 sentence summary
  keySkills: array,           // Optional: Top 8-10 skills list
  careerGoals: string,        // Optional: Current career objectives
  yearsExperience: number,    // Optional: Total years experience
  currentRole: string,        // Optional: Current position/status
  industries: array,          // Optional: Primary industries (max 3)
  educationLevel: string,     // Optional: Highest education
  location: string,           // Optional: Current location
  availability: string        // Optional: Availability status
}
```

#### Example Usage

**Context Optimization:**
```
You: "I just got promoted to Senior Engineer. Let's update my quick summary."

AI: "Congratulations! I'll update your quick summary to reflect your promotion..."
→ Calls update_quick_summary with new role and responsibilities
→ Updates executive summary and current role
→ Optimizes for faster conversation initialization

"Quick summary updated! Your profile now reflects your Senior Engineer role. This will help me provide appropriate career guidance for your new level."
```

**Skills Refresh:**
```
You: "I've been focusing heavily on React and cloud technologies lately. Can we update my key skills?"

AI: "I'll refresh your key skills to emphasize your current focus areas..."
→ Calls update_quick_summary with updated skills list
→ Prioritizes React and cloud technologies
→ Maintains balance with other core competencies

"Updated your key skills to highlight React and cloud technologies while maintaining your full-stack foundation. This will help me give more relevant technical advice."
```

## Usage Examples

### Complete Career Planning Session

```
You: "I want to plan my career progression for the next 3 years. Can you help?"

AI: "I'd be happy to help with your career planning! Let me start by getting your current professional context..."

→ Calls get_quick_context
"I can see you're a Senior Software Engineer with 4+ years experience, focusing on full-stack development with leadership interests. Let me get your detailed profile for comprehensive planning..."

→ Calls get_detailed_profile  
"Based on your detailed profile, I see a clear progression from individual contributor to team leadership. You've led teams of 4+ developers and have strong mentoring experience. Let me analyze your skills to identify development opportunities..."

→ Calls get_skills_analysis
"Your skills analysis shows you're strong in technical execution and team collaboration. For career advancement, you might want to develop system architecture and strategic planning skills. Let me generate some specific career path recommendations..."

→ Calls get_career_suggestions
"Here are three career paths aligned with your background:

1. **Technical Lead** (High Alignment)
   - Next Steps: System architecture certification, technical strategy experience
   - Timeline: 12-18 months
   - Growth Outlook: Excellent

2. **Engineering Manager** (Medium-High Alignment)  
   - Next Steps: Formal leadership training, larger team experience
   - Timeline: 18-24 months
   - Growth Outlook: Strong

3. **Staff Engineer** (Medium Alignment)
   - Next Steps: Cross-system expertise, technical mentoring
   - Timeline: 24-36 months
   - Growth Outlook: Good

Which of these interests you most? I can help you create a detailed development plan."
```

### Adding New Experience with Follow-up

```
You: "I just completed a major project where I led the migration of our system to microservices. This was a 6-month effort with significant impact."

AI: "That sounds like a significant achievement! Let me help you document this experience properly..."

→ Calls store_experience (with guided information gathering)
"I'll capture the key details:
- Title: 'Technical Lead - Microservices Migration'  
- Duration: 6 months
- Leadership: Led migration project
- Impact: System architecture modernization

Can you tell me more about the team size, specific technologies used, and measurable outcomes?"

[After gathering details and storing the experience]

"Great! I've stored your microservices migration experience with all the details. This significantly strengthens your technical leadership profile. Let me update your overall profile to reflect this new experience..."

→ Calls update_profile
"Your profile has been updated. This experience particularly strengthens your:
- System Architecture capabilities
- Technical Leadership experience  
- Project Management skills
- Cloud/Microservices expertise

Would you like me to analyze how this positions you for your target career paths?"

→ Calls get_career_suggestions
"This new experience significantly improves your alignment with Technical Lead roles (now High+ alignment) and also opens up Solutions Architect opportunities. Your proven ability to lead complex technical initiatives is exactly what these roles require."
```

### Skills Assessment for Job Application

```
You: "I'm applying for a Staff Engineer position. Can you help me understand how my skills align and what to emphasize?"

AI: "I'll analyze your skills specifically for Staff Engineer requirements..."

→ Calls get_skills_analysis
"Let me review your skills profile against typical Staff Engineer expectations:

**Strong Alignment:**
- Technical Depth: JavaScript/Python expertise across 5+ projects
- System Thinking: Demonstrated in microservices migration
- Mentoring: 7+ developers mentored with proven growth

**Areas to Emphasize:**
- Cross-team collaboration: Your experience working with product and design
- Technical Strategy: Architecture decisions in recent projects
- Code Quality: Your focus on testing and CI/CD practices

**Development Opportunities:**
- Industry Thought Leadership: Consider speaking/writing about your work
- Open Source Contributions: Expand your community involvement"

→ Calls search_experiences with focus on system-level work
"Looking at your specific experiences, I'd highlight:
1. Microservices Migration Project - Shows system-level thinking
2. Performance Optimization Work - Demonstrates technical depth
3. Team Mentoring Program - Shows senior-level responsibility

Would you like me to help you craft specific examples for the interview process?"
```

## Best Practices

### Data Quality

**Complete Experience Records:**
- Include quantifiable achievements and impact metrics
- Specify technologies, team sizes, and project outcomes
- Use industry-standard terminology and keywords
- Update experiences promptly after completion

**Skills Documentation:**
- Categorize skills appropriately (technical vs. soft)
- Indicate proficiency levels honestly
- Include years of experience with each skill
- Connect skills to specific experiences/projects

### Conversation Flow

**Start with Context:**
- Begin career conversations by checking quick context
- Let AI understand your background before asking for advice
- Provide updates when your situation changes

**Use Appropriate Tools:**
- Quick context for general conversations
- Detailed profile for career planning
- Search experiences for specific discussions
- Skills analysis for development planning

### Regular Maintenance

**Profile Updates:**
- Add new experiences within a week of completion
- Update career goals when they change
- Refresh skills emphasis as you develop
- Review and update profile summaries quarterly

**Data Verification:**
- Regularly review stored experiences for accuracy
- Update achievement metrics as you learn more about impact
- Keep contact information and availability current

## Performance Guidelines

### Tool Selection for Performance

**For Speed (< 10ms):**
- Use `get_quick_context` for rapid conversation startup
- Ideal for basic background, current status, key skills

**For Depth (< 50ms):**
- Use `get_detailed_profile` for comprehensive analysis
- Best for career planning, skills assessment, transition guidance

**For Specific Queries (< 200ms):**
- Use `search_experiences` for targeted information
- Use `get_skills_analysis` for development planning
- Use `get_career_suggestions` for opportunity exploration

### Optimization Tips

**Connection Management:**
- MCP server maintains optimized connection pooling
- Multiple quick queries are faster than fewer complex ones
- Context retrieval is cached for conversation sessions

**Query Efficiency:**
- Be specific with search filters to reduce response time
- Use date ranges and type filters to narrow results
- Limit results appropriately (default 10, max 50)

**Profile Management:**
- Update profiles incrementally rather than completely rebuilding
- Quick summary updates are faster than full profile updates
- Skills analysis is computed on-demand, so frequency affects performance

---

This reference guide provides comprehensive coverage of Career Navigator MCP tools. For implementation details and troubleshooting, see the main [README](../README.md) and [troubleshooting documentation](troubleshooting.md).