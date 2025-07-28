# MCP Server Documentation

The Model Context Protocol (MCP) server enables seamless integration between Pathfinder and various AI language models, providing contextual access to user career data while maintaining privacy and security.

## Overview

The MCP server acts as a bridge between AI language models and the Pathfinder database, allowing for:

- **Contextual AI Conversations** with access to user career data
- **Privacy-Preserving** interactions through user-controlled infrastructure  
- **Multiple AI Provider Support** including OpenAI, Anthropic, and local models
- **Real-time Data Access** for dynamic career guidance and recommendations

## Architecture

[![MCP Server Architecture](../../assets/mermaid/mcp-server-architecture.png)](../../assets/diagrams/mcp-server-architecture.mmd)

## MCP Tools Available

### Core Career Navigation Tools

#### `get_user_profile()`
Returns user's career summary and current professional status.

```json
{
  "summary": "Senior Software Engineer with 8 years experience...",
  "current_role": "Senior Software Engineer",
  "key_skills": ["Python", "React", "AWS", "Team Leadership"],
  "career_goals": "Transition to Engineering Management",
  "years_experience": 8,
  "industries": ["Technology", "FinTech"]
}
```

#### `search_experiences(query, filters)`
Search through user's professional experiences with intelligent filtering.

```json
{
  "query": "leadership projects",
  "results": [
    {
      "id": "exp-123",
      "title": "Tech Lead - Mobile Platform",
      "company": "TechCorp",
      "relevance_score": 0.95,
      "key_highlights": ["Led team of 6 engineers", "Delivered platform ahead of schedule"],
      "duration": "18 months"
    }
  ]
}
```

#### `analyze_skill_development(skill_area)`
Analyze user's skill development trajectory and provide growth recommendations.

```json
{
  "skill_area": "leadership",
  "current_level": "intermediate",
  "development_trajectory": "steady_growth",
  "evidence": [
    "Led cross-functional projects",
    "Mentored junior developers",
    "Managed stakeholder communications"
  ],
  "growth_recommendations": [
    "Formal leadership training",
    "Larger team management experience",
    "Strategic decision-making exposure"
  ]
}
```

#### `suggest_career_paths(interests, constraints)`
Generate personalized career path recommendations based on current experience and goals.

```json
{
  "current_profile": "Senior Software Engineer",
  "suggested_paths": [
    {
      "path": "Engineering Manager",
      "fit_score": 0.88,
      "transition_timeline": "12-18 months",
      "required_skills": ["People management", "Strategic planning"],
      "current_readiness": "75%"
    },
    {
      "path": "Principal Engineer",
      "fit_score": 0.82,
      "transition_timeline": "18-24 months",
      "required_skills": ["System architecture", "Technical leadership"],
      "current_readiness": "68%"
    }
  ]
}
```

#### `generate_resume_content(job_description, format)`
Create tailored resume content for specific opportunities.

```json
{
  "job_description": "Senior Engineering Manager role...",
  "format": "executive_summary",
  "generated_content": {
    "professional_summary": "Results-driven Senior Software Engineer...",
    "key_achievements": [
      "Led development team of 12 engineers across 3 product lines",
      "Increased team productivity by 35% through process optimization"
    ],
    "relevant_skills": ["Team Leadership", "Agile Development", "Strategic Planning"],
    "ats_keywords": ["engineering management", "team leadership", "agile"]
  }
}
```

### Advanced Analysis Tools

#### `identify_achievement_gaps(target_role)`
Identify missing achievements needed for target career progression.

#### `recommend_networking_targets(career_goals)`
Suggest professional networking opportunities aligned with career objectives.

#### `analyze_market_positioning(industry, role_level)`
Compare user's profile against market standards and opportunities.

## Deployment Options

### Self-Hosted Deployment

#### [Self-Hosted MCP Setup](self-hosted-mcp.md)
Complete guide for setting up your own MCP server with personal AI subscriptions.

**Benefits:**
- **Cost Savings**: Use ChatGPT Plus/Claude Pro instead of pay-per-token APIs
- **Complete Privacy**: All processing on your infrastructure
- **Full Control**: Customize and extend functionality
- **No Usage Limits**: Leverage full subscription benefits

#### Quick Start
```bash
# Clone and setup MCP server
git clone https://github.com/czhaoca/pathfinder.git
cd mcp-server

# Configure environment
cp .env.example .env
# Edit .env with your database and AI service credentials

# Install and start
npm install
npm run start

# Connect to your AI client (ChatGPT Desktop, Claude Desktop, etc.)
```

### Cloud Deployment

#### Managed MCP Service
For users preferring a managed solution:

- **Hosted Infrastructure**: Fully managed MCP server deployment
- **Auto-Scaling**: Handles traffic spikes automatically
- **Security Updates**: Automatic security patches and updates
- **SLA Guarantees**: 99.9% uptime commitment

#### Enterprise Deployment
For organizations requiring advanced features:

- **Multi-Tenant**: Support for multiple users/organizations
- **SSO Integration**: Single sign-on with enterprise identity providers
- **Advanced Analytics**: Usage analytics and performance monitoring
- **Custom Integration**: API access for existing enterprise systems

## Security & Privacy

### Authentication & Authorization
- **User-Specific Access**: Each MCP session tied to specific user account
- **Token-Based Auth**: Short-lived tokens with automatic rotation
- **Permission Scoping**: Granular control over data access levels
- **Session Management**: Secure session handling with automatic cleanup

### Data Protection
- **Encryption in Transit**: All MCP communications encrypted with TLS 1.3
- **Encryption at Rest**: Database encryption with user-controlled keys
- **Zero Logging**: No logging of user data or AI interactions
- **Memory Clearing**: Automatic clearing of sensitive data from memory

### Privacy Guarantees
- **No Data Retention**: MCP server doesn't retain user data between sessions
- **User-Controlled Database**: All data stored in user's own database
- **Local Processing**: Option for completely local deployment
- **Audit Logging**: Complete audit trail of all data access

## Integration Examples

### ChatGPT Plus Integration
```javascript
// Custom GPT configuration
{
  "name": "Pathfinder Assistant",
  "description": "AI career coach with access to your professional experience",
  "instructions": "You are a career development assistant...",
  "mcp_server_url": "http://localhost:8080",
  "available_tools": [
    "get_user_profile",
    "search_experiences", 
    "analyze_skill_development",
    "suggest_career_paths"
  ]
}
```

### Claude Desktop Integration
```json
{
  "mcpSettings": {
    "servers": {
      "pathfinder": {
        "command": "node",
        "args": ["/path/to/pathfinder-mcp/index.js"],
        "env": {
          "DATABASE_URL": "postgresql://user:pass@localhost/career_nav",
          "ENCRYPTION_KEY": "user-provided-key"
        }
      }
    }
  }
}
```

### Local LLM Integration
```python
# Ollama + MCP integration
import requests
import json

def query_with_context(user_query, user_id):
    # Get user context from MCP
    context = requests.get(f"http://localhost:8080/context/{user_id}")
    
    # Combine with user query
    full_prompt = f"""
    User Context: {context.json()}
    
    User Query: {user_query}
    
    Please provide career guidance based on the user's background and experience.
    """
    
    # Send to local LLM
    response = requests.post("http://localhost:11434/api/generate", json={
        "model": "llama2",
        "prompt": full_prompt
    })
    
    return response.json()
```

## Performance Optimization

### Caching Strategy
- **Context Caching**: Cache frequently accessed user context
- **Query Result Caching**: Cache results of expensive analysis operations
- **Intelligent Invalidation**: Smart cache invalidation on data updates
- **Memory Management**: Efficient memory usage for large datasets

### Database Optimization
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Optimized queries for common MCP operations
- **Index Strategy**: Indexes optimized for MCP access patterns
- **Batch Operations**: Grouped database operations for better performance

## Monitoring & Observability

### Performance Metrics
- **Response Time**: Track MCP tool execution time
- **Throughput**: Monitor requests per second and concurrent users
- **Error Rates**: Track and alert on error conditions
- **Resource Usage**: Monitor CPU, memory, and database utilization

### Health Checks
- **Database Connectivity**: Verify database connection and query performance
- **AI Service Integration**: Test connectivity to configured AI services
- **Memory Usage**: Monitor for memory leaks and resource exhaustion
- **Security Validation**: Verify authentication and authorization systems

## Troubleshooting

### Common Issues
- **Connection Problems**: Database connectivity and network issues
- **Authentication Failures**: Token expiration and permission problems
- **Performance Issues**: Slow queries and resource constraints
- **Integration Problems**: AI service configuration and compatibility

### Debug Tools
- **Logging Configuration**: Detailed logging for troubleshooting
- **Performance Profiling**: Built-in performance analysis tools
- **Health Dashboard**: Real-time system status monitoring
- **Test Utilities**: Tools for testing MCP functionality

---

*The MCP server enables powerful AI-driven career guidance while maintaining user privacy and data sovereignty. Whether self-hosted or managed, it provides the foundation for intelligent career development conversations.*