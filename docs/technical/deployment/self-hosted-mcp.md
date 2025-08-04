# Self-Hosted MCP with Personal AI Subscriptions

## Overview

Instead of using pay-per-token APIs, you can use your existing AI subscriptions (ChatGPT Plus, Claude Pro, etc.) with a self-hosted MCP server. This approach is more cost-effective and gives you complete control over your data and AI interactions.

## Benefits of Self-Hosting

### 💰 Cost Savings
- **ChatGPT Plus**: $20/month for unlimited usage vs $0.01-0.06 per 1K tokens
- **Claude Pro**: $20/month for unlimited usage vs $3-75 per 1M tokens
- **No API limits**: Use your full subscription benefits
- **Predictable costs**: Fixed monthly fee instead of variable API costs

### 🔒 Enhanced Privacy
- **Your infrastructure**: Complete control over data processing
- **No third-party servers**: Data never leaves your environment
- **Local processing**: AI interactions happen on your chosen platform
- **Audit trail**: Full logging and monitoring under your control

## Setup Options

### Option 1: ChatGPT Plus with Custom GPT + MCP

#### Prerequisites
- ChatGPT Plus subscription ($20/month)
- Docker installed on your machine
- Your database credentials (OCI/Cloudflare/etc.)

#### Step 1: Deploy MCP Server
```bash
# Clone the career navigator MCP server
git clone https://github.com/czhaoca/pathfinder.git
cd mcp-server

# Configure your database connection
cp .env.example .env
nano .env
```

#### Environment Configuration
```env
# Database Configuration
DB_TYPE=oci_atp  # or cloudflare_d1
DB_CONNECTION_STRING=your-encrypted-connection-string
DB_ENCRYPTION_KEY=your-32-byte-key

# MCP Server Configuration
MCP_PORT=8080
MCP_HOST=localhost
AUTH_TOKEN=your-secure-auth-token

# Privacy Settings  
LOG_LEVEL=info
AUDIT_ENABLED=true
DATA_RETENTION_DAYS=30
```

#### Step 2: Start MCP Server
```bash
# Build and start the MCP server
docker-compose up -d

# Verify server is running
curl http://localhost:8080/health
```

#### Step 3: Create Custom ChatGPT
```markdown
## Pathfinder GPT Instructions

You are a career navigation assistant with access to the user's detailed professional experience via MCP tools. Use these tools to provide personalized career guidance.

### Available MCP Tools:
- get_user_profile(): Get user's career summary and current status
- search_experiences(query): Search through user's experiences
- get_skill_analysis(): Analyze user's skills and strengths
- suggest_career_paths(): Recommend career directions
- generate_resume_content(job_description): Tailor resume for specific roles

### Guidelines:
1. Always start by getting the user's profile to understand their background
2. Ask clarifying questions about their career goals
3. Use specific examples from their experience when giving advice
4. Provide actionable recommendations with concrete next steps
5. Be encouraging and supportive while being realistic

### Privacy Note:
All user data is stored in their own database. Never store or remember sensitive career information between conversations.
```

#### Step 4: Configure MCP Connection in ChatGPT
```json
{
  "mcp_server_url": "http://localhost:8080",
  "auth_token": "your-secure-auth-token",
  "tools": [
    "get_user_profile",
    "search_experiences", 
    "get_skill_analysis",
    "suggest_career_paths",
    "generate_resume_content"
  ]
}
```

### Option 2: Claude Pro with MCP Integration

#### Prerequisites
- Claude Pro subscription ($20/month)
- Claude Desktop app installed
- MCP server running (from Option 1)

#### Step 1: Configure Claude Desktop MCP
```json
// ~/.config/claude-desktop/claude_desktop_config.json
{
  "mcpSettings": {
    "servers": {
      "pathfinder": {
        "command": "node",
        "args": ["/path/to/pathfinder-mcp/index.js"],
        "env": {
          "DB_CONNECTION_STRING": "your-encrypted-connection",
          "DB_ENCRYPTION_KEY": "your-encryption-key"
        }
      }
    }
  }
}
```

#### Step 2: Career Navigation Prompts for Claude
```markdown
# Career Analysis Session

I'm using Claude Pro with MCP access to my career database. Please help me with career planning using my stored experience data.

## Available Context:
- My detailed work experiences with extracted skills
- Education background and certifications  
- Project portfolio and achievements
- Career progression timeline
- Current skills and competency levels

## What I'd Like Help With:
[Describe your specific career question or goal]

Please start by reviewing my profile and ask any clarifying questions to provide the most relevant guidance.
```

### Option 3: Local LLM with Ollama + MCP

#### Prerequisites
- Ollama installed locally
- Sufficient hardware (16GB+ RAM recommended)
- Open WebUI or similar interface

#### Step 1: Install Ollama and Models
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Download recommended models
ollama pull llama2:13b          # Good balance of performance/resources
ollama pull codellama:13b       # Better for technical career advice
ollama pull mistral:7b          # Faster, lower resource usage
```

#### Step 2: Configure MCP with Ollama
```javascript
// ollama-mcp-config.js
const express = require('express');
const { Ollama } = require('ollama');

class OllamaMCPServer {
  constructor() {
    this.ollama = new Ollama({ host: 'http://localhost:11434' });
    this.app = express();
  }
  
  async handleCareerQuery(query, userContext) {
    const prompt = `
Career Advisor Assistant

User Context: ${JSON.stringify(userContext, null, 2)}

User Query: ${query}

Please provide career guidance based on the user's experience and background. Be specific and actionable.

Response:`;
    
    const response = await this.ollama.generate({
      model: 'llama2:13b',
      prompt: prompt,
      system: 'You are an expert career advisor with access to detailed user career data.'
    });
    
    return response.response;
  }
}
```

#### Step 3: Connect to Open WebUI
```yaml
# docker-compose.yml for Open WebUI with MCP
version: '3.8'
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "3000:8080"
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - MCP_SERVER_URL=http://host.docker.internal:8080
    volumes:
      - open-webui:/app/backend/data
    extra_hosts:
      - host.docker.internal:host-gateway
```

## MCP Server Implementation

### Core MCP Tools
```javascript
// pathfinder-mcp-tools.js
class CareerNavigatorMCP {
  constructor(dbConnection) {
    this.db = dbConnection;
  }
  
  // Get user's career profile summary
  async get_user_profile(userId) {
    const profile = await this.db.query(`
      SELECT executive_summary, key_skills, career_goals, 
             years_experience, current_role, industries
      FROM quick_summaries 
      WHERE user_id = ?
    `, [userId]);
    
    const detailedProfile = await this.db.query(`
      SELECT core_strengths, career_interests, career_progression
      FROM profile_summaries 
      WHERE user_id = ?
    `, [userId]);
    
    return {
      summary: profile[0],
      detailed: detailedProfile[0],
      last_updated: new Date().toISOString()
    };
  }
  
  // Search through user's experiences
  async search_experiences(userId, query) {
    const experiences = await this.db.query(`
      SELECT title, organization, description, extracted_skills,
             key_highlights, start_date, end_date
      FROM experiences_detailed 
      WHERE user_id = ? 
      AND (description LIKE ? OR JSON_EXTRACT(extracted_skills, '$') LIKE ?)
      ORDER BY start_date DESC
    `, [userId, `%${query}%`, `%${query}%`]);
    
    return experiences.map(exp => ({
      ...exp,
      relevance_score: this.calculateRelevance(exp, query)
    }));
  }
  
  // Analyze user's skills and strengths
  async get_skill_analysis(userId) {
    const skills = await this.db.query(`
      SELECT skill_name, proficiency_level, experience_count,
             last_used, market_demand
      FROM user_skills_view 
      WHERE user_id = ?
      ORDER BY proficiency_level DESC, market_demand DESC
    `, [userId]);
    
    return {
      top_skills: skills.slice(0, 10),
      emerging_skills: skills.filter(s => s.last_used > '2023-01-01'),
      skill_gaps: await this.identifySkillGaps(userId),
      recommendations: await this.getSkillRecommendations(userId)
    };
  }
  
  // Suggest career paths
  async suggest_career_paths(userId) {
    const userProfile = await this.get_user_profile(userId);
    const skillAnalysis = await this.get_skill_analysis(userId);
    
    const careerPaths = await this.db.query(`
      SELECT cp.path_name, cp.industry, cp.required_skills,
             cp.typical_progression, cp.growth_outlook,
             cp.salary_ranges
      FROM career_paths cp
      WHERE JSON_OVERLAPS(cp.required_skills, ?)
      ORDER BY cp.growth_outlook DESC
      LIMIT 5
    `, [JSON.stringify(skillAnalysis.top_skills.map(s => s.skill_name))]);
    
    return careerPaths.map(path => ({
      ...path,
      fit_score: this.calculateCareerFit(userProfile, skillAnalysis, path),
      next_steps: this.generateNextSteps(userProfile, path)
    }));
  }
  
  // Generate tailored resume content
  async generate_resume_content(userId, jobDescription) {
    const profile = await this.get_user_profile(userId);
    const relevantExperiences = await this.search_experiences(userId, jobDescription);
    
    return {
      tailored_summary: this.tailorSummary(profile.summary, jobDescription),
      relevant_experiences: relevantExperiences.slice(0, 5),
      matched_skills: this.matchSkills(profile.detailed.core_strengths, jobDescription),
      suggested_improvements: this.suggestImprovements(profile, jobDescription)
    };
  }
}
```

### Prompt Templates for Different Scenarios

#### Career Change Analysis
```markdown
# Career Change Analysis Prompt

## User Background:
{user_profile}

## Current Situation:
- Current Role: {current_role}
- Years of Experience: {years_experience}
- Industries: {industries}

## Desired Change:
{user_career_goal}

## Analysis Request:
1. Assess transferable skills from current experience
2. Identify skill gaps for target career
3. Recommend learning path and timeline
4. Suggest networking strategies
5. Provide realistic timeline and expectations

Please be specific and actionable in your recommendations.
```

#### Resume Optimization
```markdown
# Resume Optimization for Specific Job

## Target Job Description:
{job_description}

## User's Experience Database:
{relevant_experiences}

## Current Skills:
{skill_analysis}

## Optimization Tasks:
1. Rewrite professional summary to match job requirements
2. Select and prioritize most relevant experiences
3. Quantify achievements where possible
4. Optimize keywords for ATS systems
5. Suggest additional skills to highlight

Provide specific text recommendations that can be copied directly into a resume.
```

#### Interview Preparation
```markdown
# Interview Preparation Assistant

## Job Role: {job_title}
## Company: {company_name}
## Job Description: {job_description}

## User's Background:
{user_profile}
{relevant_experiences}

## Preparation Tasks:
1. Generate likely interview questions based on job requirements
2. Prepare STAR method answers using user's actual experiences
3. Identify potential weak spots and how to address them
4. Create questions for the user to ask the interviewer
5. Provide company research talking points

Focus on connecting the user's real experiences to the job requirements.
```

## Privacy and Security Considerations

### Local Data Processing
```bash
# Ensure all processing happens locally
export MCP_LOCAL_ONLY=true
export DB_ALLOW_REMOTE=false
export AUDIT_LOG_LOCAL=true

# Network isolation for extra security
docker network create --internal career-nav-internal
```

### Data Encryption
```javascript
// All database queries use encrypted connections
const dbConfig = {
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('ca-certificate.crt'),
    key: fs.readFileSync('client-key.key'),
    cert: fs.readFileSync('client-certificate.crt')
  }
};
```

### Audit Logging
```yaml
# Audit configuration
audit:
  enabled: true
  log_level: info
  retention_days: 90
  include_queries: false  # Never log actual user data
  include_responses: false
  log_location: ./logs/audit.log
```

## Troubleshooting

### Common Issues

#### Connection Problems
```bash
# Check MCP server status
curl http://localhost:8080/health

# Check database connection
npm run test:db-connection

# View logs
docker logs pathfinder-mcp
```

#### Performance Optimization
```javascript
// Database connection pooling
const dbPool = {
  min: 2,
  max: 10,
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 100
};
```

#### Memory Management
```bash
# Monitor resource usage
docker stats pathfinder-mcp

# Adjust memory limits if needed
docker run --memory=2g --cpus=1.5 pathfinder-mcp
```

## Cost Comparison

### Monthly Cost Analysis
```yaml
API-based Approach:
  OpenAI GPT-4: $50-200/month (depending on usage)
  Anthropic Claude: $30-150/month
  Total: $80-350/month

Self-hosted Approach:
  ChatGPT Plus: $20/month
  OR Claude Pro: $20/month  
  OR Local LLM: $0/month (hardware costs)
  Database: $0/month (free tiers)
  Total: $0-20/month

Savings: $60-330/month ($720-3960/year)
```

### Usage Calculations
```
Typical Career Navigation Usage:
- 50 queries per month
- Average 1000 tokens per query
- 50,000 tokens per month

API Costs:
- GPT-4: 50,000 tokens × $0.03 = $1.50/month (minimum)
- But interactive sessions often use 5-10x more tokens
- Realistic cost: $15-50/month

Subscription Benefits:
- Unlimited usage within fair use policy
- Access to latest models
- No token counting or cost anxiety
- Better user experience
```