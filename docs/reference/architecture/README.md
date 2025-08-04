# Technical Stack Documentation

This section covers the technology choices, implementation decisions, and technical architecture that powers Pathfinder.

## Technology Philosophy

Pathfinder is built on four core technical principles:

1. **Privacy First** - User data sovereignty and complete control
2. **Flexibility** - Support for multiple deployment and integration options  
3. **Performance** - Optimized for responsive user experience
4. **Extensibility** - Modular architecture supporting add-ons and customization

## Stack Overview

[![Technical Stack Architecture](../../assets/mermaid/technical-stack-architecture.png)](../../assets/diagrams/technical-stack-architecture.mmd)

## Core Technologies

### Backend Stack

#### Node.js + TypeScript
**Why Node.js?**
- **Unified Language**: JavaScript/TypeScript across frontend and backend
- **Rich Ecosystem**: Extensive npm package ecosystem
- **Performance**: V8 engine optimization and non-blocking I/O
- **AI Integration**: Excellent support for AI/ML service integration

```typescript
// Example: Core API structure
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// REST API
app.use('/api/v1', apiRoutes);

// WebSocket for real-time features
wss.on('connection', handleWebSocketConnection);

// MCP Server integration
app.use('/mcp', mcpServerMiddleware);
```

#### Express.js Framework
- **Minimalist**: Lightweight and flexible web framework
- **Middleware Ecosystem**: Rich middleware for authentication, validation, etc.
- **Performance**: Fast routing and request handling
- **WebSocket Support**: Easy integration with real-time features

#### Database Layer
**Primary: PostgreSQL**
- **JSONB Support**: Native JSON storage for flexible schemas
- **Full-Text Search**: Built-in search capabilities
- **ACID Compliance**: Strong consistency guarantees
- **Extensibility**: Support for custom functions and extensions

**Caching: Redis**
- **In-Memory Performance**: Sub-millisecond response times
- **Session Storage**: Secure session and token management
- **Pub/Sub**: Real-time communication between services
- **Data Structures**: Rich data types for complex caching

### Frontend Stack

#### React + Next.js
**Why React?**
- **Component Architecture**: Reusable, maintainable UI components
- **Ecosystem**: Vast library ecosystem and community
- **Performance**: Virtual DOM and optimization tools
- **Developer Experience**: Excellent tooling and debugging

**Why Next.js?**
- **Server-Side Rendering**: Better SEO and initial load performance
- **API Routes**: Built-in API capabilities
- **Static Generation**: Pre-built pages for better performance
- **Developer Experience**: Hot reloading, built-in optimization

```typescript
// Example: Career exploration component
import React, { useState, useEffect } from 'react';
import { useCareerAnalysis } from '@/hooks/useCareerAnalysis';

export const CareerExplorer: React.FC = () => {
  const [userProfile, setUserProfile] = useState(null);
  const { analyzeCareerPaths, loading, results } = useCareerAnalysis();

  useEffect(() => {
    if (userProfile) {
      analyzeCareerPaths(userProfile);
    }
  }, [userProfile]);

  return (
    <div className="career-explorer">
      {/* Career exploration UI */}
    </div>
  );
};
```

#### Styling & UI
**Tailwind CSS**
- **Utility-First**: Rapid UI development
- **Responsive Design**: Mobile-first responsive utilities
- **Customization**: Easy theming and brand customization
- **Performance**: Purged CSS for minimal bundle sizes

**Component Library**
- **Headless UI**: Accessible, unstyled UI components
- **Radix UI**: Low-level UI primitives
- **Custom Components**: Pathfinder-specific components

### AI Integration

#### LLM Service Integration
**Multi-Provider Support**
```typescript
interface LLMProvider {
  name: string;
  generateResponse(prompt: string, context: any): Promise<string>;
  estimateCost(tokens: number): number;
}

class OpenAIProvider implements LLMProvider {
  async generateResponse(prompt: string, context: any) {
    // OpenAI API integration
  }
}

class AnthropicProvider implements LLMProvider {
  async generateResponse(prompt: string, context: any) {
    // Anthropic API integration
  }
}

class LocalLLMProvider implements LLMProvider {
  async generateResponse(prompt: string, context: any) {
    // Local LLM integration (Ollama, etc.)
  }
}
```

#### Vector Database
**Pinecone/Weaviate/ChromaDB**
- **Semantic Search**: Find similar experiences and skills
- **Embeddings Storage**: Store and query text embeddings
- **Similarity Matching**: Match users with similar career paths
- **Recommendation Engine**: Power AI-driven recommendations

### Security Stack

#### Authentication & Authorization
**JWT + Refresh Token Pattern**
```typescript
interface AuthTokens {
  accessToken: string;  // Short-lived (15 minutes)
  refreshToken: string; // Long-lived (30 days)
  userId: string;
  permissions: string[];
}

class AuthService {
  async authenticate(credentials: LoginCredentials): Promise<AuthTokens> {
    // Validate credentials
    // Generate tokens
    // Return secure tokens
  }
  
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Validate refresh token
    // Generate new token pair
    // Rotate refresh token
  }
}
```

#### Encryption
**Multiple Encryption Layers**
- **Transport**: TLS 1.3 for all communications
- **Application**: Field-level encryption for sensitive data
- **Database**: Transparent Data Encryption (TDE)
- **Client**: Client-side encryption before transmission

## Deployment Architecture

### Container Strategy
**Docker + Docker Compose**
```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - db
      - redis
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=career_navigator
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Cloud Deployment Options

#### User-Controlled Cloud (Recommended)
**Oracle Cloud Infrastructure (OCI) Free Tier**
- **Always Free Database**: 2 ATP databases with 20GB each
- **Compute**: 2 micro instances with 1GB RAM each
- **Networking**: 10TB outbound data transfer per month
- **Storage**: 200GB total block storage

**Cloudflare Integration**
- **CDN**: Global content delivery network
- **DDoS Protection**: Built-in DDoS mitigation
- **Edge Functions**: Serverless compute at the edge
- **Analytics**: Performance and security analytics

#### Alternative Cloud Options
**AWS Free Tier**
- **EC2**: 750 hours of t2.micro instances
- **RDS**: 750 hours of db.t2.micro database
- **S3**: 5GB storage with 20,000 GET requests
- **CloudFront**: 50GB data transfer out

**Google Cloud Free Tier**
- **Compute Engine**: f1-micro instance (1 per region)
- **Cloud SQL**: db-f1-micro with 30GB HDD
- **Cloud Storage**: 5GB regional storage
- **Cloud Functions**: 2M invocations per month

### Performance Optimization

#### Caching Strategy
**Multi-Level Caching**
```typescript
interface CacheStrategy {
  // Level 1: Application memory cache
  memory: NodeCache;
  
  // Level 2: Redis distributed cache
  redis: RedisClient;
  
  // Level 3: CDN edge cache
  cdn: CloudflareAPI;
}

class CacheManager {
  async get(key: string): Promise<any> {
    // Try memory cache first
    let value = this.memory.get(key);
    if (value) return value;
    
    // Try Redis cache
    value = await this.redis.get(key);
    if (value) {
      this.memory.set(key, value, 300); // 5 min memory cache
      return value;
    }
    
    // Cache miss - return null
    return null;
  }
}
```

#### Database Optimization
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Optimized queries with proper indexing
- **Read Replicas**: Separate read and write operations
- **Partitioning**: User-based data partitioning for scale

## Development Tools & Workflow

### Development Environment
**Dev Container Support**
```json
{
  "name": "Pathfinder Dev",
  "dockerComposeFile": "docker-compose.dev.yml",
  "service": "app",
  "workspaceFolder": "/workspace",
  "extensions": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ],
  "postCreateCommand": "npm install"
}
```

### Testing Strategy
**Multi-Level Testing**
```typescript
// Unit Tests - Jest
describe('CareerAnalyzer', () => {
  test('should analyze career progression', () => {
    const analyzer = new CareerAnalyzer();
    const result = analyzer.analyzeProgression(mockExperiences);
    expect(result.progression_score).toBeGreaterThan(0.7);
  });
});

// Integration Tests - Supertest
describe('API Integration', () => {
  test('GET /api/v1/profile should return user profile', async () => {
    const response = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);
    
    expect(response.body).toHaveProperty('career_summary');
  });
});

// E2E Tests - Playwright
test('complete career exploration flow', async ({ page }) => {
  await page.goto('/career-exploration');
  await page.fill('[data-testid="interests-input"]', 'technology, leadership');
  await page.click('[data-testid="analyze-button"]');
  await expect(page.locator('[data-testid="results"]')).toBeVisible();
});
```

### Code Quality Tools
**ESLint + Prettier + TypeScript**
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error"
  }
}
```

## Monitoring & Observability

### Application Monitoring
**Prometheus + Grafana**
- **Metrics Collection**: Custom business metrics and system metrics
- **Alerting**: Proactive alerting on performance and errors
- **Dashboards**: Real-time visibility into system health
- **SLA Monitoring**: Track service level objectives

### Logging Strategy
**Structured Logging with Winston**
```typescript
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

### Error Tracking
**Sentry Integration**
- **Error Monitoring**: Automatic error capture and alerting
- **Performance Monitoring**: Transaction performance tracking
- **Release Tracking**: Error tracking across deployments
- **User Context**: Error correlation with user actions

## Scalability Considerations

### Horizontal Scaling
**Microservices Architecture (Future)**
- **Service Decomposition**: Split by business domain
- **API Gateway**: Centralized routing and authentication
- **Service Mesh**: Inter-service communication management
- **Load Balancing**: Intelligent traffic distribution

### Database Scaling
**Sharding Strategy**
- **User-Based Sharding**: Partition data by user ID
- **Geographic Sharding**: Partition by user location
- **Feature Sharding**: Separate services for different features
- **Cross-Shard Queries**: Aggregation across shards

### Caching at Scale
**Distributed Caching**
- **Redis Cluster**: Distributed Redis for high availability
- **Cache Warming**: Proactive cache population
- **Intelligent Invalidation**: Smart cache invalidation strategies
- **Cache Hierarchies**: Multi-tier caching for optimal performance

---

*The Pathfinder technical stack is designed for scalability, maintainability, and user privacy while providing the performance needed for responsive AI-powered career guidance.*