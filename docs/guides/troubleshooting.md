# Pathfinder MCP Troubleshooting Guide

Complete troubleshooting guide for Pathfinder MCP server deployment, configuration, and operations.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Database Problems](#database-problems)
- [MCP Server Issues](#mcp-server-issues)
- [Performance Problems](#performance-problems)
- [AI Assistant Integration](#ai-assistant-integration)
- [Environment Configuration](#environment-configuration)
- [FAQ](#faq)
- [Getting Help](#getting-help)

## Quick Diagnostics

### System Health Check

Run this comprehensive diagnostic command first:

```bash
npm run db:health
```

**Expected Healthy Output:**
```
✅ Database connection successful
✅ All 6 required tables found  
✅ Custom indexes validated
✅ MCP performance targets met
✅ Quick context: 8ms ≤ 10ms target
✅ Detailed profile: 45ms ≤ 50ms target
✅ Experience search: 120ms ≤ 200ms target

📊 Database Health:
   Status: healthy
   Pool connections: 2/8 active
   Total queries: 1,247
   Average response: 32ms
   Error count: 0
```

### Quick Fix Commands

```bash
# Test all connections
npm run db:test-connection

# Restart environment
npm run env:dev
npm run mcp:dev

# Check logs
npm run mcp:dev | grep ERROR

# Rebuild schema
npm run db:migrate:dev
```

## Common Issues

### 1. "Command not found" Errors

**Symptoms:**
```bash
$ npm run db:health
npm ERR! missing script: db:health
```

**Cause:** Outdated package.json or incorrect directory

**Solution:**
```bash
# Ensure you're in the right directory
pwd
# Should show: /path/to/pathfinder

# Check if package.json exists and has scripts
ls -la package.json
cat package.json | grep -A 20 '"scripts"'

# If missing, ensure you're in the project root
cd /path/to/pathfinder

# Reinstall dependencies
npm install
```

### 2. Node.js Version Issues

**Symptoms:**
```bash
Error: Requires Node.js 18 or higher
```

**Solution:**
```bash
# Check current version
node --version

# If < 18, install Node.js 18+
# Using nvm (recommended):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Verify version
node --version  # Should show v18.x.x or higher
```

### 3. Missing Environment Files

**Symptoms:**
```bash
Error: Environment configuration not found
```

**Solution:**
```bash
# Check if environment files exist
ls -la .env*

# Create from example if missing
cp .env.example .env.development
cp .env.example .env.production

# Edit with your actual credentials
nano .env.development
```

## Database Problems

### 1. Connection Failures

**Symptoms:**
```
ORA-01017: invalid username/password; logon denied
TNS-12541: TNS:no listener
ORA-12514: TNS:listener does not currently know of service
```

**Diagnosis:**
```bash
# Test specific connection details
npm run db:test-connection

# Check environment variables
echo $NODE_ENV
cat .env.development | grep OCI_DB_DEV

# Verify wallet files
ls -la wallets/dev-wallet/
# Should show: cwallet.sso, tnsnames.ora, sqlnet.ora, etc.
```

**Solutions:**

**A. Invalid Credentials:**
```bash
# Verify credentials in OCI Console
# Database Details → Connection → Database Connection
# Username should be: ADMIN
# Password: Your database password (case sensitive)

# Update .env.development
nano .env.development
# Fix: OCI_DB_DEV_PASSWORD=YourCorrectPassword123!
```

**B. TNS/Connection Issues:**
```bash
# Re-download wallet files from OCI Console
# 1. Go to Oracle Cloud Console
# 2. Navigate to your Autonomous Database
# 3. Database Connection → Download Wallet
# 4. Extract to correct directory

# Remove old wallet
rm -rf wallets/dev-wallet/*

# Extract new wallet
unzip Wallet_yourdb.zip -d wallets/dev-wallet/

# Verify extraction
ls -la wallets/dev-wallet/
# Should show multiple .ora files
```

**C. Service Name Issues:**
```bash
# Check tnsnames.ora for correct service names
cat wallets/dev-wallet/tnsnames.ora

# Update .env with exact service name from tnsnames.ora
# Format: yourdb_high = (DESCRIPTION=...)
# Use: OCI_DB_DEV_SERVICE_NAME=yourdb_high
```

### 2. Schema/Table Not Found

**Symptoms:**
```
ORA-00942: table or view does not exist
Table 'experiences_detailed' doesn't exist
```

**Solution:**
```bash
# Deploy database schema
npm run db:migrate:dev

# Verify tables created
npm run db:health

# If migration fails, check logs
npm run db:migrate:dev 2>&1 | tee migration.log
cat migration.log
```

**Manual Schema Check:**
```sql
-- Connect to database and check tables
SELECT table_name FROM user_tables ORDER BY table_name;

-- Should show:
-- CAREER_PATHS
-- EXPERIENCES_DETAILED  
-- PROFILE_SUMMARIES
-- QUICK_SUMMARIES
-- ROLE_PROFILES
-- SKILLS_MAPPING
```

### 3. Permission Issues

**Symptoms:**
```
ORA-01031: insufficient privileges
Access denied for user 'ADMIN'
```

**Solution:**
```bash
# Verify you're using ADMIN user (required for Oracle Autonomous)
grep ADMIN .env.development

# ADMIN should have all necessary privileges by default
# If issues persist, recreate database instance in OCI Console
```

### 4. Database Resource Limits

**Symptoms:**
```
ORA-00018: maximum number of sessions exceeded
Database connection timeout
```

**Solution:**
```bash
# Check connection pool settings in config/mcp-config.js
# Reduce max connections if needed:

pool: {
  min: 1,
  max: 5,  # Reduced from default
  increment: 1,
  timeout: 30000
}

# Always Free tier limits:
# - 20 concurrent connections
# - 2 OCPUs
# - Check Oracle Cloud Console → Performance Hub
```

## MCP Server Issues

### 1. Server Won't Start

**Symptoms:**
```bash
$ npm run mcp:dev
Error: Cannot find module '@modelcontextprotocol/sdk'
```

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Verify MCP SDK installation
npm list @modelcontextprotocol/sdk
# Should show version ^0.5.0 or similar
```

### 2. MCP Tools Not Available

**Symptoms:**
- AI assistant shows "No tools available"
- MCP server starts but tools don't register

**Diagnosis:**
```bash
# Start server with debug logging
LOG_LEVEL=debug npm run mcp:dev

# Look for tool registration messages:
# "Registered tool: store_experience"
# "Registered tool: get_quick_context"
# etc.
```

**Solutions:**
```bash
# Check server/mcp-server.js exists and is valid
ls -la server/mcp-server.js

# Verify tool definitions
grep -n "setRequestHandler.*tools" server/mcp-server.js

# Restart with clean environment
npm run env:dev
npm run mcp:dev
```

### 3. Performance Issues

**Symptoms:**
```
Quick context: 45ms (target: ≤10ms) ⚠️
Detailed profile: 120ms (target: ≤50ms) ⚠️
```

**Diagnosis:**
```bash
# Enable query logging
ENABLE_QUERY_LOGGING=true npm run mcp:dev

# Monitor Oracle Cloud Console → Performance Hub
# Check CPU and memory utilization
```

**Solutions:**

**A. Database Optimization:**
```bash
# Increase connection pool
# Edit config/mcp-config.js:
pool: {
  min: 4,    # Increase minimum
  max: 12,   # Increase maximum
  increment: 2
}
```

**B. Index Optimization:**
```sql
-- Check if indexes exist
SELECT index_name, table_name FROM user_indexes 
WHERE table_name IN ('QUICK_SUMMARIES', 'PROFILE_SUMMARIES', 'EXPERIENCES_DETAILED');

-- Rebuild indexes if needed
ALTER INDEX idx_quick_singleton REBUILD;
ALTER INDEX idx_profile_singleton REBUILD;
```

**C. Data Optimization:**
```bash
# If too much sample data, reduce it
npm run db:seed:dev  # Re-seed with standard sample size

# Check data volume
npm run db:health
# Experience count should be reasonable (< 100 for testing)
```

## AI Assistant Integration

### 1. Claude Desktop Can't Connect

**Symptoms:**
- Claude Desktop shows "MCP server not responding"
- Tools never appear in Claude interface

**Diagnosis:**
```bash
# Verify MCP server is running
ps aux | grep mcp-server
# Should show running Node.js process

# Check if server is listening
netstat -an | grep LISTEN | grep node
```

**Solution:**

**A. Check Claude Desktop Configuration:**
```json
// In Claude Desktop settings:
{
  "mcpServers": {
    "pathfinder": {
      "command": "node",
      "args": ["/full/path/to/pathfinder/server/mcp-server.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

**B. Use Absolute Paths:**
```bash
# Get full path
pwd
# Use this full path in Claude Desktop config

# Example: "/Users/username/pathfinder/server/mcp-server.js"
```

**C. Test MCP Server Independently:**
```bash
# Start server and watch for startup messages
npm run mcp:dev

# Should show:
# "🚀 Pathfinder MCP Server started in development mode"
# "Database: connected"
# "Tools: 8 tools registered"
```

### 2. Tools Execute But Return Errors

**Symptoms:**
- Tools appear in Claude but fail when executed
- Error messages about database or missing data

**Solution:**
```bash
# Ensure sample data is loaded
npm run db:seed:dev

# Test tools manually
npm run db:health

# Check logs for specific errors
npm run mcp:dev 2>&1 | grep ERROR
```

### 3. Performance Slow in AI Conversations

**Symptoms:**
- Long delays when AI calls MCP tools
- Claude shows "thinking" for extended periods

**Solution:**
```bash
# Check performance targets
npm run db:health

# If targets are exceeded:
# 1. Optimize database connection pool
# 2. Check Oracle Cloud Console for resource usage
# 3. Consider upgrading from Always Free to paid tier
```

## Environment Configuration

### 1. Wrong Environment Active

**Symptoms:**
```
Connected to production database (expected development)
```

**Solution:**
```bash
# Check current environment
echo $NODE_ENV
cat .env | head -5

# Switch to development
npm run env:dev

# Verify switch
echo "Current environment: $NODE_ENV"
npm run db:health | grep Environment
```

### 2. Environment Variables Not Loading

**Symptoms:**
```
Error: OCI_DB_DEV_HOST is not defined
```

**Solution:**
```bash
# Check if .env files exist
ls -la .env*

# Check if variables are set
cat .env.development | grep OCI_DB_DEV_HOST

# Source environment manually
source .env.development
echo $OCI_DB_DEV_HOST

# Check for syntax errors in .env
# No spaces around = sign
# Quotes around values with spaces
```

### 3. Mixed Environment Settings

**Symptoms:**
- Some settings from dev, others from prod
- Unexpected database connections

**Solution:**
```bash
# Clean environment
unset $(grep -v '^#' .env.development | sed -E 's/(.*)=.*/\1/' | xargs)

# Switch cleanly
npm run env:dev

# Verify all settings
env | grep OCI_DB | sort
```

## FAQ

### Database Questions

**Q: How much does Oracle Autonomous Database cost after free tier?**

A: The Always Free tier is forever free (2 databases, 20GB each). Paid tiers start at ~$0.20/hour per OCPU when running. You can stop/start databases to control costs.

**Q: Can I use PostgreSQL instead of Oracle?**

A: Current implementation is optimized for Oracle's JSON features. PostgreSQL migration would require:
- Schema modifications (JSON → JSONB)
- Query updates (Oracle → PostgreSQL syntax)
- Connection pooling changes (oracledb → pg)

**Q: How do I backup my data?**

A: Multiple options:
```bash
# Automated: Oracle Autonomous includes automatic backups
# Manual export: Use OCI Console → Tools → Data Pump
# Script export: npm run db:export (if implemented)
```

**Q: Can I use multiple databases for different projects?**

A: Yes, but requires configuration changes:
```bash
# Create separate .env files per project
.env.project1
.env.project2

# Switch between projects
cp .env.project1 .env.development
npm run env:dev
```

### Performance Questions

**Q: Why are my response times slower than targets?**

A: Common causes:
1. **Network latency** - Oracle instance in different region
2. **Connection pool** - Too few connections for load
3. **Data volume** - Too many experiences (>1000)
4. **Resource limits** - Always Free tier CPU constraints

**Q: How can I improve performance?**

A: Optimization strategies:
```bash
# 1. Regional optimization
# Create database in same region as your location

# 2. Connection tuning
# Increase pool size in config/mcp-config.js

# 3. Data optimization
# Limit experiences to relevant ones only

# 4. Upgrade consideration
# Move to paid tier for dedicated resources
```

**Q: What are realistic performance expectations?**

A: Expected ranges:
- **Always Free**: 5-15ms quick context, 30-80ms detailed profile
- **Paid Tier**: 2-8ms quick context, 15-40ms detailed profile
- **Network factors**: +5-20ms depending on distance to Oracle region

### Integration Questions

**Q: Can I use this with other AI assistants besides Claude?**

A: Yes, any MCP-compatible assistant:
- **OpenAI ChatGPT** - Via MCP adapters
- **Custom applications** - Using MCP SDK
- **Future assistants** - That support MCP protocol

**Q: How do I integrate with my existing career tools?**

A: Integration approaches:
1. **Data import** - Scripts to import from LinkedIn, resume parsers
2. **API integration** - Connect to job boards, ATS systems
3. **Export features** - Generate resumes, reports from stored data

**Q: Can multiple people use one MCP server?**

A: Current design is single-user only. Multi-user requires:
- User authentication system
- Data isolation (add user_id fields)
- Connection pooling updates
- Security enhancements

### Troubleshooting Commands

**Q: What diagnostic commands should I run?**

A: Standard diagnostic sequence:
```bash
# 1. System check
node --version  # Should be 18+
npm --version   # Should be 8+

# 2. Environment check
pwd             # Correct directory
ls package.json # Project files exist
echo $NODE_ENV  # Environment set

# 3. Database check
npm run db:test-connection  # Both environments
npm run db:health          # Current environment

# 4. MCP server check
npm run mcp:dev | head -20  # Startup messages

# 5. Performance check
npm run db:health | grep "target"  # Performance results
```

**Q: How do I reset everything?**

A: Complete reset procedure:
```bash
# 1. Stop all processes
pkill -f mcp-server

# 2. Clean dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Reset database (WARNING: Destroys data)
npm run db:migrate:dev  # Rebuilds schema
npm run db:seed:dev     # Loads sample data

# 4. Reset environment
npm run env:dev
npm run mcp:dev

# 5. Verify
npm run db:health
```

## Getting Help

### Log Analysis

**Enable Detailed Logging:**
```bash
# Maximum logging
LOG_LEVEL=debug ENABLE_QUERY_LOGGING=true npm run mcp:dev > debug.log 2>&1

# Monitor in real-time
tail -f debug.log | grep -E "(ERROR|WARN|Performance)"
```

**Common Log Patterns:**
```bash
# Database connection issues
grep -i "ora-" debug.log

# Performance problems
grep "Performance" debug.log

# MCP tool errors
grep "Tool execution failed" debug.log
```

### Support Resources

1. **Documentation**
   - 📚 [Main README](../../README.md) - Complete setup guide
   - 🏗️ [Architecture Guide](../development/architecture.md) - Technical details
   - 🛠️ [MCP Tools Reference](mcp-tools-reference.md) - Tool usage

2. **Diagnostic Scripts**
   ```bash
   npm run db:health              # Comprehensive health check
   npm run db:test-connection     # Test all connections
   npm run env:dev               # Environment switching
   ```

3. **Community Support**
   - 🐛 [GitHub Issues](https://github.com/your-repo/pathfinder/issues)
   - 💬 [Discord Community](https://discord.gg/your-server)
   - 📖 [Oracle Documentation](https://docs.oracle.com/en/cloud/paas/autonomous-database/)

### Creating Bug Reports

**Include This Information:**
```bash
# System info
uname -a
node --version
npm --version

# Environment
echo $NODE_ENV
cat .env.development | grep -v PASSWORD

# Health check
npm run db:health 2>&1

# Error logs (last 50 lines)
npm run mcp:dev 2>&1 | tail -50
```

**Example Bug Report Template:**
```markdown
## Environment
- OS: macOS 13.4
- Node.js: v18.16.0  
- Environment: development
- Database: Oracle Autonomous (Always Free)

## Issue
Brief description of the problem

## Steps to Reproduce
1. npm run db:health
2. npm run mcp:dev
3. Error occurs when...

## Error Logs
```
Paste error output here
```

## Expected vs Actual
- Expected: Performance target <10ms
- Actual: 45ms response time
```

---

This troubleshooting guide covers the most common issues and solutions. For complex problems, use the diagnostic commands and create detailed bug reports with the information above.