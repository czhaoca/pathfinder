# Career Navigator MCP Server

A single-user Model Context Protocol (MCP) server for professional experience management, powered by Oracle Autonomous Database. Designed for optimal AI conversation context with three-tier data architecture.

[![Open Issues](https://img.shields.io/github/issues-raw/czhaoca/career-navigator)](https://github.com/czhaoca/career-navigator/issues)
[![Twitter](https://img.shields.io/twitter/url/https/x.com/langchainai.svg?style=social&label=Follow%20%40yvrlab)](https://x.com/yvrlab)

## Table of Contents

- [What is Career Navigator MCP?](#what-is-career-navigator-mcp)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [System Architecture](#system-architecture)
- [Deployment Guide](#deployment-guide)
- [Using the MCP Server](#using-the-mcp-server)
- [Available Scripts](#available-scripts)
- [Configuration](#configuration)
- [Performance & Monitoring](#performance--monitoring)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## What is Career Navigator MCP?

Career Navigator MCP is a **Model Context Protocol server** that provides intelligent storage and retrieval of professional experiences for AI-powered career conversations. It enables AI assistants like Claude to have contextual, personalized career discussions by maintaining your professional history in a performance-optimized database.

### Why MCP?

**Model Context Protocol (MCP)** allows AI assistants to access external data sources during conversations. Instead of manually copying your resume into every chat, Career Navigator MCP:

- **Automatically provides context** about your professional experiences
- **Maintains conversation continuity** across multiple AI interactions  
- **Enables personalized career guidance** based on your actual background
- **Protects your privacy** with local data storage under your control

### Single-User Focus

This implementation is designed for **individual professionals** who want:
- Complete control over their career data
- High-performance AI conversations (< 10ms response times)
- Enterprise-grade database reliability (Oracle Autonomous Database)
- No multi-tenant complexity or shared infrastructure

## Key Features

### 🎯 Three-Tier Performance Architecture

**Level 3: Quick Context (< 10ms)**
```
Executive summary, key skills, current role
→ Instant AI conversation initialization
```

**Level 2: Detailed Profile (< 50ms)**
```  
Comprehensive career analysis, skills progression
→ In-depth career planning conversations
```

**Level 1: Full Experiences (< 200ms)**
```
Complete experience records with metadata
→ Specific achievement and story discussions
```

### 🛠️ Professional MCP Tools

- **`store_experience`** - Add new professional experiences
- **`get_quick_context`** - Rapid conversation context for AI
- **`get_detailed_profile`** - Comprehensive career analysis
- **`search_experiences`** - Find experiences with advanced filters
- **`update_profile`** - Update career summaries and analysis
- **`get_skills_analysis`** - Skills analysis across all experiences
- **`get_career_suggestions`** - AI-powered career recommendations
- **`update_quick_summary`** - Optimize rapid context retrieval

### 🔒 Enterprise Security & Reliability

- **Oracle Autonomous Database** - Enterprise-grade reliability with Always Free tier
- **End-to-end encryption** - Your data is encrypted in transit and at rest
- **User-controlled hosting** - Database runs in your own Oracle Cloud account
- **No vendor lock-in** - Complete data portability and control

### ⚡ Performance Optimized

- **Sub-10ms** quick context retrieval for instant AI responses
- **Connection pooling** optimized for conversational patterns
- **Intelligent caching** with Redis-compatible performance
- **Monitoring & alerting** for proactive performance management

## Quick Start

### Prerequisites

Before starting, ensure you have:

- **Node.js 18+** and **npm 8+** installed
- **Oracle Cloud Infrastructure (OCI) account** with [Free Tier access](https://signup.oraclecloud.com/)
- **Basic terminal/command line** familiarity
- **Text editor** for configuration files

### 5-Minute Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-username/career-navigator.git
   cd career-navigator
   npm install
   ```

2. **Create Oracle Database** (5 minutes)
   ```bash
   # Open the detailed guide in your browser
   open docs/deployment/mcp-server/oci-provisioning-guide.md
   
   # Create 2 Autonomous Database instances:
   # - career-navigator-dev (development)
   # - career-navigator-prod (production)
   ```

3. **Configure Environment**
   ```bash
   # Copy example files
   cp .env.example .env.development
   cp .env.example .env.production
   
   # Edit with your database credentials
   nano .env.development
   ```

4. **Deploy Database Schema**
   ```bash
   # Deploy to development
   npm run db:migrate:dev
   
   # Test connectivity
   npm run db:health
   ```

5. **Load Sample Data**
   ```bash
   npm run db:seed:dev
   ```

6. **Start MCP Server**
   ```bash
   npm run mcp:dev
   ```

**✅ Your MCP server is now running and ready for AI conversations!**

## System Architecture

### Overview

Career Navigator MCP uses a **three-tier data architecture** designed for optimal AI conversation performance:

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Assistant (Claude)                    │
│                     ↕ Model Context Protocol                    │
├─────────────────────────────────────────────────────────────────┤
│                    Career Navigator MCP Server                  │
│  ┌─────────────────┬─────────────────┬─────────────────────────┐│
│  │   Quick Context │ Detailed Profile│   Full Experiences      ││
│  │     < 10ms      │     < 50ms      │      < 200ms            ││
│  │                 │                 │                         ││
│  │ • Executive     │ • Career        │ • Complete experience   ││
│  │   summary       │   progression   │   records               ││
│  │ • Key skills    │ • Strengths     │ • Skills extraction     ││
│  │ • Current role  │   analysis      │ • Achievement metrics   ││
│  │ • Goals         │ • Industry      │ • Role mappings         ││
│  │                 │   experience    │ • Impact quantification ││
│  └─────────────────┴─────────────────┴─────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                   Oracle Autonomous Database                    │
│                        (Your OCI Account)                       │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

**Core Tables:**
- **`experiences_detailed`** - Complete professional experiences with rich metadata
- **`profile_summaries`** - Aggregated career analysis (singleton pattern)
- **`quick_summaries`** - Optimized context for rapid AI retrieval (singleton pattern)

**Supporting Tables:**
- **`skills_mapping`** - Skills taxonomy with market demand data
- **`career_paths`** - Industry-specific career progression tracks
- **`role_profiles`** - Detailed job role specifications

**Performance Features:**
- **Oracle JSON** support for flexible experience metadata
- **Function-based indexes** on JSON fields for sub-10ms queries
- **Connection pooling** optimized for MCP conversation patterns
- **Singleton constraints** ensuring single-user data integrity

### Data Flow

1. **Experience Input** → Store in `experiences_detailed` with skills extraction
2. **Profile Aggregation** → Analyze experiences → Update `profile_summaries`
3. **Quick Summary Generation** → Optimize for AI context → Update `quick_summaries`
4. **MCP Tool Calls** → Retrieve appropriate tier based on conversation needs

## Deployment Guide

### Step 1: Oracle Cloud Setup

1. **Create OCI Account**
   - Go to [Oracle Cloud Free Tier](https://signup.oraclecloud.com/)
   - Complete registration (no credit card required for Always Free)
   - Verify email and access the OCI Console

2. **Provision Autonomous Databases**
   
   **Development Database:**
   ```
   Display Name: career-navigator-dev
   Database Name: CAREERDEV
   Workload Type: Transaction Processing
   Deployment: Shared Infrastructure (Always Free: ON)
   Database Version: Latest (19c/21c)
   OCPU: 1 (fixed)
   Storage: 20 GB (fixed)
   Password: Create strong password (save securely)
   Network Access: Secure access from everywhere
   ```

   **Production Database:**
   ```
   Display Name: career-navigator-prod  
   Database Name: CAREERPROD
   (Same settings as dev with different password)
   ```

3. **Download Wallet Files**
   - Navigate to each database → Database Connection → Download Wallet
   - Set wallet password (save securely)
   - Extract to `./wallets/dev-wallet/` and `./wallets/prod-wallet/`

### Step 2: Environment Configuration

1. **Create Environment Files**
   ```bash
   cp .env.example .env.development
   cp .env.example .env.production
   ```

2. **Configure Development Environment (.env.development)**
   ```bash
   NODE_ENV=development
   
   # Database Configuration (from OCI Console)
   OCI_DB_DEV_HOST=adb.us-ashburn-1.oraclecloud.com
   OCI_DB_DEV_SERVICE_NAME=g1234567_careerdev_high.adb.oraclecloud.com
   OCI_DB_DEV_USERNAME=ADMIN
   OCI_DB_DEV_PASSWORD=YourDevPassword123!
   OCI_DB_DEV_WALLET_PATH=./wallets/dev-wallet
   
   # MCP Configuration
   MCP_ENCRYPTION_KEY=your-32-character-encryption-key-here
   LOG_LEVEL=debug
   ENABLE_QUERY_LOGGING=true
   ```

3. **Configure Production Environment (.env.production)**
   ```bash
   NODE_ENV=production
   
   # Database Configuration
   OCI_DB_PROD_HOST=adb.us-ashburn-1.oraclecloud.com
   OCI_DB_PROD_SERVICE_NAME=g1234567_careerprod_high.adb.oraclecloud.com
   OCI_DB_PROD_USERNAME=ADMIN
   OCI_DB_PROD_PASSWORD=YourProdPassword456!
   OCI_DB_PROD_WALLET_PATH=./wallets/prod-wallet
   
   # MCP Configuration
   MCP_ENCRYPTION_KEY=different-prod-encryption-key-here
   LOG_LEVEL=info
   ENABLE_QUERY_LOGGING=false
   ```

### Step 3: Database Schema Deployment

1. **Test Connections**
   ```bash
   npm run db:test-connection
   ```

2. **Deploy Schema**
   ```bash
   # Deploy to development
   npm run db:migrate:dev
   
   # Deploy to production
   npm run db:migrate:prod
   ```

3. **Verify Deployment**
   ```bash
   npm run db:health
   ```

### Step 4: Data Seeding (Development)

```bash
# Load realistic sample data for testing
npm run db:seed:dev
```

**Sample data includes:**
- 6 professional experiences (work, education, projects, volunteering)
- Comprehensive profile summary with career progression
- Optimized quick summary for AI conversations
- Skills analysis and career path data

### Step 5: MCP Server Startup

```bash
# Start in development mode
npm run mcp:dev

# Or start in production mode
npm run mcp:prod
```

**Server will display:**
```
🚀 Career Navigator MCP Server started in development mode
   Database: g1234567_careerdev_high.adb.oraclecloud.com
   Tools: store_experience, get_quick_context, get_detailed_profile, ...
   Performance Targets: 10ms/50ms/200ms (Quick/Profile/Detailed)
```

### Step 6: Integration with AI Assistant

**For Claude Desktop App:**

1. **Add to Claude Configuration**
   ```json
   {
     "mcpServers": {
       "career-navigator": {
         "command": "node",
         "args": ["/path/to/career-navigator/server/mcp-server.js"],
         "env": {
           "NODE_ENV": "development"
         }
       }
     }
   }
   ```

2. **Restart Claude Desktop**

3. **Test MCP Integration**
   Start a conversation in Claude:
   ```
   "Can you help me with career planning? Please check my quick context first."
   ```

## Using the MCP Server

### For AI Conversations

Once your MCP server is running, you can have contextual career conversations with AI assistants:

**Initial Context Retrieval:**
```
AI: "Let me get your professional context first."
→ Calls get_quick_context tool
→ Receives your executive summary, key skills, career goals
→ Conversation proceeds with full context about your background
```

**Career Analysis:**
```
You: "What are my strongest technical skills?"
AI: "Let me analyze your detailed profile..."
→ Calls get_detailed_profile tool
→ Reviews your technical progression across experiences
→ Provides personalized skills assessment
```

**Experience-Specific Discussions:**
```
You: "Tell me about my leadership experience"
AI: "I'll search through your experiences..."
→ Calls search_experiences with leadership filters
→ Finds relevant experiences and achievements
→ Discusses specific leadership examples from your background
```

### MCP Tools Reference

#### Core Data Management

**`store_experience`** - Add Professional Experience
```javascript
// Example usage in AI conversation:
// "I just finished a new project, let me add it to my profile"

{
  title: "Senior Software Engineer",
  organization: "TechCorp Solutions", 
  description: "Led development of cloud-native applications...",
  startDate: "2022-03-01",
  endDate: "2024-01-15",
  isCurrent: false,
  experienceType: "work",
  extractedSkills: [
    { name: "JavaScript", category: "technical", proficiency: "advanced" }
  ],
  keyHighlights: [
    { description: "Reduced deployment time by 60%", impact: "high" }
  ]
}
```

**`search_experiences`** - Find Specific Experiences
```javascript
// Search filters available:
{
  query: "leadership",              // Text search
  experienceType: "work",           // Filter by type
  isCurrent: true,                  // Current experiences only
  dateFrom: "2020-01-01",          // Date range
  dateTo: "2024-12-31",
  limit: 10                        // Results limit
}
```

#### Context Retrieval (Performance Optimized)

**`get_quick_context`** - Instant AI Context (< 10ms)
```javascript
// Returns optimized summary for AI conversations:
{
  executiveSummary: "Experienced software engineer with 4+ years...",
  keySkills: ["JavaScript", "React", "Leadership", "AWS"],
  careerGoals: "Seeking technical leadership role...", 
  yearsExperience: 4,
  currentRole: "Senior Software Engineer",
  industries: ["Technology", "Fintech"],
  responseTime: "8ms"
}
```

**`get_detailed_profile`** - Comprehensive Analysis (< 50ms)
```javascript
// Returns full career analysis:
{
  coreStrengths: {
    technical: ["JavaScript", "Python", "System Design"],
    leadership: ["Team Management", "Mentoring", "Project Leadership"]
  },
  careerProgression: {
    timeline: [/* career progression analysis */],
    growthPattern: "Technical depth → Product impact → Team leadership"
  },
  // ... comprehensive profile data
}
```

#### Analysis & Recommendations

**`get_skills_analysis`** - Skills Analysis Across Experiences
```javascript
// Analyzes skills frequency and growth:
{
  topSkills: [
    { skill: "JavaScript", frequency: 5 },
    { skill: "Leadership", frequency: 3 }
  ],
  categorizedSkills: {
    technical: [/* technical skills ranking */],
    soft: [/* soft skills ranking */]
  },
  skillsGrowthPotential: [/* recommended skills to develop */]
}
```

**`get_career_suggestions`** - AI-Powered Recommendations
```javascript
// Generates career path suggestions:
{
  careerSuggestions: [
    {
      careerPath: "Technical Leadership",
      alignment: "High",
      nextSteps: ["Leadership development", "System architecture"],
      growthOutlook: "Excellent"
    }
  ]
}
```

#### Profile Management

**`update_profile`** - Update Career Analysis
```javascript
// Update comprehensive profile data:
{
  coreStrengths: { /* updated strengths analysis */ },
  careerInterests: { /* career interests and goals */ },
  careerProgression: { /* progression timeline */ }
}
```

**`update_quick_summary`** - Optimize AI Context
```javascript
// Update rapid-access summary:
{
  executiveSummary: "Updated professional summary...",
  keySkills: ["Updated", "Skill", "List"],
  careerGoals: "Updated career objectives..."
}
```

### Conversation Examples

**Career Planning Session:**
```
You: "I want to transition into a tech leadership role. What should I focus on?"

AI: [Calls get_detailed_profile]
"Based on your profile, you have strong technical foundations with 4+ years 
of software engineering experience. I can see you've already led a team of 4 
developers and delivered 15+ features quarterly. 

For tech leadership transition, I recommend:
1. Expand your system architecture experience  
2. Develop strategic planning skills
3. Gain experience with cross-functional collaboration

Would you like me to search for specific leadership experiences in your 
background to build upon?"

You: "Yes, show me my leadership experiences"

AI: [Calls search_experiences with leadership filters]
"I found several leadership experiences:
- Led team of 4 developers at TechCorp (2022-2024)
- Mentored 7+ junior developers through various programs
- Teaching assistant experience showing educational leadership

These experiences demonstrate progressive leadership growth. Let me analyze 
how to position these for tech lead roles..."
```

**Skills Assessment:**
```
You: "What are my strongest technical skills and where should I improve?"

AI: [Calls get_skills_analysis]
"Your skills analysis shows:

**Strongest Technical Skills:**
- JavaScript (appears in 5 experiences, advanced proficiency)
- Python (4 experiences, advanced proficiency) 
- React/Node.js (3 experiences, advanced proficiency)

**Growth Opportunities:**
Based on market demand and your career goals, consider developing:
- Cloud Architecture (AWS/Azure certifications)
- System Design at scale
- DevOps and CI/CD practices

Your progression shows strong full-stack foundations. Adding cloud and 
architecture skills would position you well for senior/lead roles."
```

### Performance Monitoring

Monitor your MCP server performance:

```bash
# Check database health and performance
npm run db:health

# View performance targets:
# ✅ Quick context: 8ms (target: ≤10ms)  
# ✅ Detailed profile: 45ms (target: ≤50ms)
# ✅ Search experiences: 120ms (target: ≤200ms)
```

**Performance Dashboard Output:**
```
📊 Performance Results:
   Quick context: 8ms (target: ≤10ms) ✅
   Detailed profile: 45ms (target: ≤50ms) ✅  
   Search experiences: 120ms (target: ≤200ms) ✅

🏥 Database Health Check:
   Status: healthy
   Pool connections: 2/8 active
   Total queries: 1,247
   Average response: 32ms
   Error count: 0
```

## Available Scripts

### Database Management
```bash
# Health and connectivity
npm run db:health              # Comprehensive health check
npm run db:test-connection     # Test both dev/prod connections

# Schema management  
npm run db:migrate             # Deploy to current environment
npm run db:migrate:dev         # Deploy to development
npm run db:migrate:prod        # Deploy to production

# Data management
npm run db:seed               # Seed current environment
npm run db:seed:dev           # Seed development with sample data
```

### Environment Management
```bash
npm run env:dev               # Switch to development environment
npm run env:prod              # Switch to production environment

# Manual environment switching:
./scripts/switch-env.sh development
./scripts/switch-env.sh production
```

### MCP Server Operations
```bash
npm run mcp:start             # Start server (current environment)
npm run mcp:dev               # Start in development mode
npm run mcp:prod              # Start in production mode

# Development with auto-reload:
npm run dev                   # Start with nodemon for development
```

### Testing and Quality
```bash
npm test                      # Run all tests
npm run test:unit             # Unit tests only
npm run test:integration      # Integration tests with mocked data
npm run lint                  # ESLint code quality check
npm run type-check            # TypeScript validation
```

### Maintenance
```bash
npm run clean                 # Remove build artifacts and node_modules
npm run build                 # Build for production (if using TypeScript)
```

## Configuration

### Environment Variables

**Database Configuration:**
```bash
# Development Database
OCI_DB_DEV_HOST=your-instance.adb.region.oraclecloud.com
OCI_DB_DEV_PORT=1521
OCI_DB_DEV_SERVICE_NAME=your_service_name_high
OCI_DB_DEV_USERNAME=ADMIN
OCI_DB_DEV_PASSWORD=YourPassword123!  
OCI_DB_DEV_WALLET_PATH=./wallets/dev-wallet
OCI_DB_DEV_WALLET_PASSWORD=             # Usually empty for auto-login

# Production Database (similar structure with PROD prefix)
OCI_DB_PROD_HOST=...
OCI_DB_PROD_SERVICE_NAME=...
# etc.
```

**MCP Server Configuration:**
```bash
# Security
MCP_ENCRYPTION_KEY=your-32-char-key-here    # Required, 32+ characters
MCP_SESSION_TIMEOUT=3600000                 # 1 hour in milliseconds

# Logging
LOG_LEVEL=debug                             # debug/info/warn/error  
ENABLE_QUERY_LOGGING=true                   # Log SQL queries (dev only)
LOG_FILE=./logs/mcp-server.log             # Optional log file

# Performance  
ENABLE_PERFORMANCE_METRICS=true            # Track performance stats
PERFORMANCE_COLLECTION_INTERVAL=60000      # 1 minute
```

### Connection Pool Settings

Optimized for MCP conversation patterns:

```javascript
// Development Environment
pool: {
  min: 2,          // Minimum connections
  max: 8,          // Maximum connections  
  increment: 1,    // Connection increment
  timeout: 60000,  // Acquisition timeout (60s)
  idleTimeout: 300000  // Idle timeout (5 minutes)
}

// Production Environment  
pool: {
  min: 2,          // Minimum connections
  max: 15,         // Higher max for production
  increment: 2,    // Faster scaling
  timeout: 60000,
  idleTimeout: 300000
}
```

### Performance Targets

The system is tuned for these response times:

| Operation | Target | Use Case |
|-----------|--------|----------|
| Quick Context | < 10ms | Initial AI conversation context |
| Detailed Profile | < 50ms | Comprehensive career analysis |
| Experience Search | < 200ms | Specific experience queries |
| Store Experience | < 500ms | Adding new experiences |

## Performance & Monitoring

### Real-Time Performance Tracking

The MCP server includes built-in performance monitoring:

```bash
# Start server with performance logging
ENABLE_PERFORMANCE_METRICS=true npm run mcp:dev
```

**Performance Metrics Logged:**
```
📊 Performance Metrics (every 1 minute):
   Uptime: 1247s
   Tool calls: 156
   Average response time: 45ms
   Error rate: 0.6%
   Errors: 1

🔍 Database Performance:
   Pool utilization: 3/8 connections
   Active queries: 0
   Total queries: 1,247
   Average query time: 32ms
```

### Health Monitoring

**Automated Health Checks:**
```bash
# Comprehensive health monitoring
npm run db:health

# Expected output:
✅ Database connection successful
✅ All 6 required tables found  
✅ Custom indexes validated
✅ MCP performance targets met
✅ Quick context: 8ms ≤ 10ms target
✅ Detailed profile: 45ms ≤ 50ms target
✅ Experience search: 120ms ≤ 200ms target
```

### Performance Optimization

**If performance targets are not met:**

1. **Check Database Resources**
   ```bash
   # Monitor Oracle Cloud Console → Autonomous Database → Performance Hub
   # Look for CPU/memory utilization
   ```

2. **Optimize Connection Pool**
   ```javascript
   // Increase pool size in config/mcp-config.js
   pool: {
     min: 4,    // Increase minimum connections
     max: 20,   // Increase maximum connections
   }
   ```

3. **Review Query Performance**
   ```bash
   # Enable query logging for analysis
   ENABLE_QUERY_LOGGING=true npm run mcp:dev
   ```

4. **Database Tuning**
   ```sql
   -- Oracle automatically tunes, but you can check:
   SELECT sql_text, elapsed_time/1000000 as seconds 
   FROM v$sql 
   WHERE sql_text LIKE '%quick_summaries%'
   ORDER BY elapsed_time DESC;
   ```

## Troubleshooting

### Common Issues

**1. Database Connection Failures**

```bash
# Symptoms: "ORA-01017: invalid username/password"
# Solution: Check credentials in .env file

# Test connections
npm run db:test-connection

# Verify environment file
cat .env.development | grep OCI_DB_DEV_PASSWORD
```

**2. Wallet File Issues**

```bash
# Symptoms: "TNS-12541: TNS:no listener" 
# Solution: Verify wallet files are extracted correctly

ls -la wallets/dev-wallet/
# Should show: cwallet.sso, tnsnames.ora, sqlnet.ora, etc.

# Re-download wallet from OCI Console if files are missing
```

**3. Schema Not Found**

```bash
# Symptoms: "Table or view does not exist"
# Solution: Deploy database schema

npm run db:migrate:dev
npm run db:health    # Verify tables created
```

**4. Performance Issues**

```bash
# Symptoms: Response times > targets
# Solution: Check database and connection pool

npm run db:health    # Shows performance metrics

# If consistently slow:
# 1. Check Oracle Cloud Console → Performance Hub
# 2. Increase connection pool size  
# 3. Review query execution plans
```

**5. MCP Integration Issues**

```bash
# Symptoms: AI assistant can't connect to MCP server
# Solution: Verify MCP server is running and accessible

# Check server is running
ps aux | grep mcp-server

# Check logs for errors
npm run mcp:dev | grep ERROR

# Verify Claude Desktop configuration matches server settings
```

### Getting Help

**Diagnostic Commands:**
```bash
# Full system check
npm run db:health

# Test both environments  
npm run db:test-connection

# Check environment configuration
npm run env:dev && echo "Environment switched to development"

# Verify sample data
npm run db:seed:dev
```

**Log Analysis:**
```bash
# Enable detailed logging
LOG_LEVEL=debug ENABLE_QUERY_LOGGING=true npm run mcp:dev

# Review error patterns
grep ERROR logs/mcp-server.log | tail -20
```

**Support Resources:**
- 📚 **Documentation**: Complete guides in `docs/` directory
- 🔍 **Health Checks**: `npm run db:health` for diagnostics
- ⚡ **Performance**: Built-in monitoring and optimization guides
- 🛠️ **Scripts**: Automated troubleshooting with npm scripts

### FAQ

**Q: Can I use a different database instead of Oracle?**
A: The current implementation is optimized for Oracle Autonomous Database's JSON features and performance characteristics. Migration to PostgreSQL or other databases would require schema modifications.

**Q: How much does Oracle Autonomous Database cost?**  
A: The Always Free tier provides 2 databases with 20GB each at no cost forever. No credit card expiration or surprise charges.

**Q: Can multiple users share one MCP server?**
A: This implementation is designed for single-user use. Multi-user support would require authentication, data isolation, and schema modifications.

**Q: How do I backup my data?**
A: Oracle Autonomous Database includes automated backups. You can also export your data using the provided scripts or OCI Console.

**Q: Can I run this on a different cloud provider?**
A: The database layer could be adapted to other Oracle Database deployments, but the current configuration is optimized for OCI Autonomous Database features.

## Contributing

We welcome contributions to Career Navigator MCP! Here's how to get started:

### Development Setup

1. **Fork the Repository**
   ```bash
   git clone https://github.com/your-username/career-navigator.git
   cd career-navigator
   ```

2. **Set Up Development Environment**
   ```bash
   npm install
   cp .env.example .env.development
   # Configure your development database
   ```

3. **Run Tests**
   ```bash
   npm test                    # All tests
   npm run test:unit          # Unit tests only
   npm run test:integration   # Integration tests
   npm run lint              # Code quality
   ```

### Contribution Guidelines

**Code Standards:**
- Follow existing code style (ESLint + Prettier configured)
- Write tests for new features
- Update documentation for user-facing changes
- Use conventional commit messages

**Pull Request Process:**
1. Create feature branch (`git checkout -b feature/amazing-feature`)
2. Make changes and add tests
3. Run test suite (`npm test`)
4. Update documentation if needed
5. Submit pull request with clear description

**Areas for Contribution:**
- 🚀 **Performance optimizations** for query response times
- 🔧 **Additional MCP tools** for career management
- 📊 **Analytics and reporting** features  
- 🌐 **Database provider support** (PostgreSQL, MySQL)
- 📱 **API integrations** with job boards or career platforms
- 📚 **Documentation improvements** and examples

### License

MIT License - see [LICENSE](LICENSE) file for details.

### Version Information

- **Version**: 1.0.0
- **Node.js**: ≥18.0.0  
- **Oracle Database**: 19c/21c (Autonomous Database)
- **MCP SDK**: ^0.5.0

---

**🚀 Ready to enhance your AI career conversations with Career Navigator MCP!**

For detailed deployment instructions, see: [`docs/deployment/mcp-server/oci-provisioning-guide.md`](docs/deployment/mcp-server/oci-provisioning-guide.md)