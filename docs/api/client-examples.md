# API Client Implementation Examples

This guide provides complete implementation examples for integrating with the Pathfinder API in JavaScript, Python, and cURL.

## Table of Contents

1. [JavaScript/TypeScript Client](#javascripttypescript-client)
2. [Python Client](#python-client)
3. [cURL Examples](#curl-examples)
4. [React Integration](#react-integration)
5. [Node.js Backend Integration](#nodejs-backend-integration)

## JavaScript/TypeScript Client

### Complete Client Implementation

```typescript
// pathfinder-client.ts
import crypto from 'crypto';

interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

interface LoginResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    refresh_token: string;
    expires_at: string;
  };
}

interface Experience {
  id: string;
  title: string;
  company: string;
  start_date: string;
  end_date?: string;
  description: string;
  skills: string[];
}

class PathfinderClient {
  private baseUrl: string;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(baseUrl: string = 'https://api.pathfinder.app/api') {
    this.baseUrl = baseUrl;
  }

  // Authentication Methods
  
  async login(username: string, password: string): Promise<User> {
    // Generate client salt
    const salt = crypto.randomBytes(32).toString('hex');
    
    // Hash password with salt
    const hash = crypto
      .createHash('sha256')
      .update(password + salt)
      .digest('hex');

    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: {
        username,
        password_hash: hash,
        client_salt: salt
      }
    });

    // Store tokens
    this.token = response.data.token;
    this.refreshToken = response.data.refresh_token;
    
    // Schedule token refresh
    this.scheduleTokenRefresh();
    
    return response.data.user;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearTokens();
    }
  }

  async register(userData: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role?: string;
  }): Promise<{ user: User; password_retrieval_token: string }> {
    const response = await this.request<any>('/auth/register', {
      method: 'POST',
      body: userData
    });
    
    return response.data;
  }

  // Profile Methods
  
  async getProfile(): Promise<User> {
    const response = await this.request<{ data: { profile: User } }>('/profile');
    return response.data.profile;
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    const response = await this.request<{ data: { profile: User } }>('/profile', {
      method: 'PUT',
      body: updates
    });
    return response.data.profile;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const salt = crypto.randomBytes(32).toString('hex');
    
    const currentHash = crypto
      .createHash('sha256')
      .update(currentPassword + salt)
      .digest('hex');
    
    const newHash = crypto
      .createHash('sha256')
      .update(newPassword + salt)
      .digest('hex');

    await this.request('/profile/change-password', {
      method: 'POST',
      body: {
        current_password_hash: currentHash,
        new_password_hash: newHash,
        client_salt: salt
      }
    });
  }

  // Experience Methods
  
  async getExperiences(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ experiences: Experience[]; pagination: any }> {
    const queryString = new URLSearchParams(params as any).toString();
    const url = `/experiences${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request<any>(url);
    return response.data;
  }

  async createExperience(experience: Omit<Experience, 'id'>): Promise<Experience> {
    const response = await this.request<{ data: { experience: Experience } }>('/experiences', {
      method: 'POST',
      body: experience
    });
    return response.data.experience;
  }

  async updateExperience(id: string, updates: Partial<Experience>): Promise<Experience> {
    const response = await this.request<{ data: { experience: Experience } }>(`/experiences/${id}`, {
      method: 'PUT',
      body: updates
    });
    return response.data.experience;
  }

  async deleteExperience(id: string): Promise<void> {
    await this.request(`/experiences/${id}`, { method: 'DELETE' });
  }

  // Chat Methods
  
  async sendChatMessage(message: string, context?: any): Promise<{
    response: string;
    message_id: string;
    suggestions?: string[];
  }> {
    const response = await this.request<any>('/chat/message', {
      method: 'POST',
      body: { message, context }
    });
    return response.data;
  }

  async getChatHistory(sessionId?: string): Promise<any[]> {
    const url = sessionId ? `/chat/history?session_id=${sessionId}` : '/chat/history';
    const response = await this.request<any>(url);
    return response.data.messages;
  }

  // CPA-PERT Methods
  
  async analyzeExperience(experienceId: string): Promise<any> {
    const response = await this.request<any>('/cpa-pert/analyze-experience', {
      method: 'POST',
      body: { experience_id: experienceId }
    });
    return response.data;
  }

  async generatePERTResponse(experienceId: string, competencyArea: string): Promise<any> {
    const response = await this.request<any>('/cpa-pert/generate-response', {
      method: 'POST',
      body: { experience_id: experienceId, competency_area: competencyArea }
    });
    return response.data.response;
  }

  // Resume Methods
  
  async generateResume(options: {
    template: string;
    experience_ids?: string[];
    target_role?: string;
    format?: 'pdf' | 'docx' | 'html';
  }): Promise<{ resume_id: string; download_url: string }> {
    const response = await this.request<any>('/resume/generate', {
      method: 'POST',
      body: options
    });
    return response.data;
  }

  // Analytics Methods
  
  async getSkillsProgression(startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const url = `/analytics/skills-progression${params.toString() ? `?${params}` : ''}`;
    const response = await this.request<any>(url);
    return response.data;
  }

  // Admin Methods
  
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }): Promise<{ users: User[]; pagination: any }> {
    const queryString = new URLSearchParams(params as any).toString();
    const url = `/admin/users${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request<any>(url);
    return response.data;
  }

  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    user_id?: string;
    event_type?: string;
  }): Promise<any> {
    const queryString = new URLSearchParams(params as any).toString();
    const url = `/admin/audit-logs${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request<any>(url);
    return response.data;
  }

  // Helper Methods
  
  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: any;
      skipAuth?: boolean;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, skipAuth = false } = options;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (!skipAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    const fetchOptions: RequestInit = {
      method,
      headers
    };
    
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${this.baseUrl}${path}`, fetchOptions);
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('X-RateLimit-Reset');
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter}`);
    }
    
    // Handle authentication errors
    if (response.status === 401 && !skipAuth) {
      // Try to refresh token
      await this.refreshAccessToken();
      
      // Retry request with new token
      headers['Authorization'] = `Bearer ${this.token}`;
      const retryResponse = await fetch(`${this.baseUrl}${path}`, fetchOptions);
      
      if (!retryResponse.ok) {
        throw new Error(`Request failed: ${retryResponse.statusText}`);
      }
      
      return retryResponse.json();
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }
    
    return response.json();
  }

  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    // Refresh 1 minute before expiry (14 minutes)
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken().catch(() => {
        this.clearTokens();
      });
    }, 14 * 60 * 1000);
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await this.request<any>('/auth/refresh', {
      method: 'POST',
      skipAuth: true,
      body: { refresh_token: this.refreshToken }
    });
    
    this.token = response.data.token;
    this.scheduleTokenRefresh();
  }

  private clearTokens(): void {
    this.token = null;
    this.refreshToken = null;
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

export default PathfinderClient;
```

### Usage Examples

```javascript
// Initialize client
const client = new PathfinderClient('http://localhost:3000/api');

// Login
async function example() {
  try {
    // Login
    const user = await client.login('john_doe', 'secure_password123');
    console.log('Logged in as:', user.username);
    
    // Get profile
    const profile = await client.getProfile();
    console.log('Profile:', profile);
    
    // Create experience
    const experience = await client.createExperience({
      title: 'Senior Developer',
      company: 'Tech Corp',
      start_date: '2020-01-01',
      end_date: '2023-12-31',
      description: 'Led development team',
      skills: ['JavaScript', 'Python', 'AWS']
    });
    console.log('Created experience:', experience.id);
    
    // Analyze for CPA competencies
    const analysis = await client.analyzeExperience(experience.id);
    console.log('Competency analysis:', analysis);
    
    // Generate resume
    const resume = await client.generateResume({
      template: 'professional',
      experience_ids: [experience.id],
      format: 'pdf'
    });
    console.log('Resume URL:', resume.download_url);
    
    // Chat with AI
    const chatResponse = await client.sendChatMessage(
      'How can I improve my experience description?'
    );
    console.log('AI Response:', chatResponse.response);
    
    // Logout
    await client.logout();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

example();
```

## Python Client

### Complete Client Implementation

```python
# pathfinder_client.py
import hashlib
import secrets
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import requests
from threading import Timer
from urllib.parse import urlencode

class PathfinderClient:
    """Complete Python client for Pathfinder API."""
    
    def __init__(self, base_url: str = "https://api.pathfinder.app/api"):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.refresh_timer: Optional[Timer] = None
        self.session = requests.Session()
    
    # Authentication Methods
    
    def login(self, username: str, password: str) -> Dict[str, Any]:
        """Authenticate with the API."""
        # Generate client salt
        salt = secrets.token_hex(32)
        
        # Hash password with salt
        password_hash = hashlib.sha256(
            (password + salt).encode()
        ).hexdigest()
        
        response = self._request(
            "POST",
            "/auth/login",
            json={
                "username": username,
                "password_hash": password_hash,
                "client_salt": salt
            },
            skip_auth=True
        )
        
        # Store tokens
        self.token = response["data"]["token"]
        self.refresh_token = response["data"]["refresh_token"]
        
        # Schedule token refresh
        self._schedule_token_refresh()
        
        return response["data"]["user"]
    
    def logout(self) -> None:
        """Logout and clear tokens."""
        try:
            self._request("POST", "/auth/logout")
        finally:
            self._clear_tokens()
    
    def register(
        self,
        username: str,
        email: str,
        first_name: str,
        last_name: str,
        role: str = "user"
    ) -> Dict[str, Any]:
        """Register a new user (admin only)."""
        response = self._request(
            "POST",
            "/auth/register",
            json={
                "username": username,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "role": role
            }
        )
        return response["data"]
    
    # Profile Methods
    
    def get_profile(self) -> Dict[str, Any]:
        """Get current user profile."""
        response = self._request("GET", "/profile")
        return response["data"]["profile"]
    
    def update_profile(self, **updates) -> Dict[str, Any]:
        """Update user profile."""
        response = self._request("PUT", "/profile", json=updates)
        return response["data"]["profile"]
    
    def change_password(
        self,
        current_password: str,
        new_password: str
    ) -> None:
        """Change user password."""
        salt = secrets.token_hex(32)
        
        current_hash = hashlib.sha256(
            (current_password + salt).encode()
        ).hexdigest()
        
        new_hash = hashlib.sha256(
            (new_password + salt).encode()
        ).hexdigest()
        
        self._request(
            "POST",
            "/profile/change-password",
            json={
                "current_password_hash": current_hash,
                "new_password_hash": new_hash,
                "client_salt": salt
            }
        )
    
    # Experience Methods
    
    def get_experiences(
        self,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get user experiences."""
        params = {"page": page, "limit": limit}
        if search:
            params["search"] = search
        
        response = self._request("GET", "/experiences", params=params)
        return response["data"]
    
    def create_experience(
        self,
        title: str,
        company: str,
        start_date: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Create a new experience."""
        data = {
            "title": title,
            "company": company,
            "start_date": start_date,
            **kwargs
        }
        
        response = self._request("POST", "/experiences", json=data)
        return response["data"]["experience"]
    
    def update_experience(
        self,
        experience_id: str,
        **updates
    ) -> Dict[str, Any]:
        """Update an experience."""
        response = self._request(
            "PUT",
            f"/experiences/{experience_id}",
            json=updates
        )
        return response["data"]["experience"]
    
    def delete_experience(self, experience_id: str) -> None:
        """Delete an experience."""
        self._request("DELETE", f"/experiences/{experience_id}")
    
    # Chat Methods
    
    def send_chat_message(
        self,
        message: str,
        context: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Send a message to the AI assistant."""
        data = {"message": message}
        if context:
            data["context"] = context
        
        response = self._request("POST", "/chat/message", json=data)
        return response["data"]
    
    def get_chat_history(
        self,
        session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get chat history."""
        params = {}
        if session_id:
            params["session_id"] = session_id
        
        response = self._request("GET", "/chat/history", params=params)
        return response["data"]["messages"]
    
    # CPA-PERT Methods
    
    def analyze_experience(
        self,
        experience_id: str
    ) -> Dict[str, Any]:
        """Analyze experience for CPA competencies."""
        response = self._request(
            "POST",
            "/cpa-pert/analyze-experience",
            json={"experience_id": experience_id}
        )
        return response["data"]
    
    def generate_pert_response(
        self,
        experience_id: str,
        competency_area: str
    ) -> Dict[str, Any]:
        """Generate PERT response for experience."""
        response = self._request(
            "POST",
            "/cpa-pert/generate-response",
            json={
                "experience_id": experience_id,
                "competency_area": competency_area
            }
        )
        return response["data"]["response"]
    
    # Resume Methods
    
    def generate_resume(
        self,
        template: str,
        experience_ids: Optional[List[str]] = None,
        target_role: Optional[str] = None,
        format: str = "pdf"
    ) -> Dict[str, Any]:
        """Generate a resume."""
        data = {
            "template": template,
            "format": format
        }
        
        if experience_ids:
            data["experience_ids"] = experience_ids
        if target_role:
            data["target_role"] = target_role
        
        response = self._request("POST", "/resume/generate", json=data)
        return response["data"]
    
    # Analytics Methods
    
    def get_skills_progression(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get skills progression analytics."""
        params = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        
        response = self._request(
            "GET",
            "/analytics/skills-progression",
            params=params
        )
        return response["data"]
    
    # Admin Methods
    
    def get_users(
        self,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        role: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get all users (admin only)."""
        params = {"page": page, "limit": limit}
        if search:
            params["search"] = search
        if role:
            params["role"] = role
        
        response = self._request("GET", "/admin/users", params=params)
        return response["data"]
    
    def get_audit_logs(
        self,
        page: int = 1,
        limit: int = 50,
        user_id: Optional[str] = None,
        event_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get audit logs (site_admin only)."""
        params = {"page": page, "limit": limit}
        if user_id:
            params["user_id"] = user_id
        if event_type:
            params["event_type"] = event_type
        
        response = self._request(
            "GET",
            "/admin/audit-logs",
            params=params
        )
        return response["data"]
    
    # Helper Methods
    
    def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        json: Optional[Dict] = None,
        skip_auth: bool = False
    ) -> Dict[str, Any]:
        """Make an API request."""
        url = f"{self.base_url}{path}"
        
        headers = {}
        if not skip_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        response = self.session.request(
            method,
            url,
            params=params,
            json=json,
            headers=headers
        )
        
        # Handle rate limiting
        if response.status_code == 429:
            retry_after = response.headers.get("X-RateLimit-Reset")
            raise Exception(f"Rate limit exceeded. Retry after {retry_after}")
        
        # Handle authentication errors
        if response.status_code == 401 and not skip_auth:
            # Try to refresh token
            self._refresh_access_token()
            
            # Retry request with new token
            headers["Authorization"] = f"Bearer {self.token}"
            response = self.session.request(
                method,
                url,
                params=params,
                json=json,
                headers=headers
            )
        
        response.raise_for_status()
        return response.json()
    
    def _schedule_token_refresh(self):
        """Schedule automatic token refresh."""
        if self.refresh_timer:
            self.refresh_timer.cancel()
        
        # Refresh 1 minute before expiry (14 minutes)
        self.refresh_timer = Timer(14 * 60, self._refresh_access_token)
        self.refresh_timer.daemon = True
        self.refresh_timer.start()
    
    def _refresh_access_token(self):
        """Refresh the access token."""
        if not self.refresh_token:
            raise Exception("No refresh token available")
        
        try:
            response = self._request(
                "POST",
                "/auth/refresh",
                json={"refresh_token": self.refresh_token},
                skip_auth=True
            )
            
            self.token = response["data"]["token"]
            self._schedule_token_refresh()
            
        except Exception:
            self._clear_tokens()
            raise
    
    def _clear_tokens(self):
        """Clear stored tokens."""
        self.token = None
        self.refresh_token = None
        
        if self.refresh_timer:
            self.refresh_timer.cancel()
            self.refresh_timer = None
    
    def __del__(self):
        """Cleanup on deletion."""
        if self.refresh_timer:
            self.refresh_timer.cancel()


# Example usage
if __name__ == "__main__":
    # Initialize client
    client = PathfinderClient("http://localhost:3000/api")
    
    try:
        # Login
        user = client.login("john_doe", "secure_password123")
        print(f"Logged in as: {user['username']}")
        
        # Get profile
        profile = client.get_profile()
        print(f"Profile: {profile}")
        
        # Create experience
        experience = client.create_experience(
            title="Senior Developer",
            company="Tech Corp",
            start_date="2020-01-01",
            end_date="2023-12-31",
            description="Led development team",
            skills=["Python", "Django", "PostgreSQL"]
        )
        print(f"Created experience: {experience['id']}")
        
        # Analyze for CPA competencies
        analysis = client.analyze_experience(experience["id"])
        print(f"Competency analysis: {analysis}")
        
        # Generate resume
        resume = client.generate_resume(
            template="professional",
            experience_ids=[experience["id"]],
            format="pdf"
        )
        print(f"Resume URL: {resume['download_url']}")
        
        # Chat with AI
        chat_response = client.send_chat_message(
            "How can I improve my experience description?"
        )
        print(f"AI Response: {chat_response['response']}")
        
        # Get analytics
        skills = client.get_skills_progression()
        print(f"Skills progression: {skills}")
        
    except Exception as e:
        print(f"Error: {e}")
    
    finally:
        # Logout
        client.logout()
        print("Logged out")
```

## cURL Examples

### Authentication

```bash
# Login
PASSWORD="secure_password123"
SALT=$(openssl rand -hex 32)
HASH=$(echo -n "${PASSWORD}${SALT}" | sha256sum | awk '{print $1}')

LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"john_doe\",
    \"password_hash\": \"${HASH}\",
    \"client_salt\": \"${SALT}\"
  }")

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.refresh_token')

echo "Token: $TOKEN"

# Refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{
    \"refresh_token\": \"${REFRESH_TOKEN}\"
  }"

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### Profile Management

```bash
# Get profile
curl -X GET http://localhost:3000/api/profile \
  -H "Authorization: Bearer $TOKEN"

# Update profile
curl -X PUT http://localhost:3000/api/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Smith",
    "phone": "+1-555-123-4567"
  }'

# Change password
NEW_PASSWORD="new_secure_password456"
SALT=$(openssl rand -hex 32)
CURRENT_HASH=$(echo -n "${PASSWORD}${SALT}" | sha256sum | awk '{print $1}')
NEW_HASH=$(echo -n "${NEW_PASSWORD}${SALT}" | sha256sum | awk '{print $1}')

curl -X POST http://localhost:3000/api/profile/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"current_password_hash\": \"${CURRENT_HASH}\",
    \"new_password_hash\": \"${NEW_HASH}\",
    \"client_salt\": \"${SALT}\"
  }"
```

### Experience Management

```bash
# List experiences
curl -X GET "http://localhost:3000/api/experiences?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Create experience
EXPERIENCE_ID=$(curl -s -X POST http://localhost:3000/api/experiences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Developer",
    "company": "Tech Corp",
    "start_date": "2020-01-01",
    "end_date": "2023-12-31",
    "description": "Led development of cloud-native applications",
    "skills": ["AWS", "Kubernetes", "Python"]
  }' | jq -r '.data.experience.id')

echo "Created experience: $EXPERIENCE_ID"

# Update experience
curl -X PUT http://localhost:3000/api/experiences/$EXPERIENCE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Led development team and architected cloud solutions"
  }'

# Delete experience
curl -X DELETE http://localhost:3000/api/experiences/$EXPERIENCE_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Chat & AI

```bash
# Send chat message
curl -X POST http://localhost:3000/api/chat/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How can I improve my resume for a senior developer position?"
  }'

# Get chat history
curl -X GET http://localhost:3000/api/chat/history \
  -H "Authorization: Bearer $TOKEN"
```

### CPA-PERT

```bash
# Analyze experience
curl -X POST http://localhost:3000/api/cpa-pert/analyze-experience \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"experience_id\": \"${EXPERIENCE_ID}\"
  }"

# Generate PERT response
curl -X POST http://localhost:3000/api/cpa-pert/generate-response \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"experience_id\": \"${EXPERIENCE_ID}\",
    \"competency_area\": \"Financial Reporting\"
  }"
```

### Resume Generation

```bash
# Generate resume
curl -X POST http://localhost:3000/api/resume/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template\": \"professional\",
    \"experience_ids\": [\"${EXPERIENCE_ID}\"],
    \"format\": \"pdf\"
  }"
```

### Admin Operations

```bash
# List users (admin only)
curl -X GET "http://localhost:3000/api/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Get audit logs (site_admin only)
curl -X GET "http://localhost:3000/api/admin/audit-logs?page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN"

# Register new user (admin only)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "new_user",
    "email": "new@example.com",
    "first_name": "New",
    "last_name": "User",
    "role": "user"
  }'
```

## React Integration

### React Hook for API

```jsx
// usePathfinder.js
import { useState, useEffect, useCallback } from 'react';
import PathfinderClient from './pathfinder-client';

const client = new PathfinderClient(process.env.REACT_APP_API_URL);

export function usePathfinder() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const userData = await client.login(username, password);
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    
    try {
      await client.logout();
      setUser(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getProfile = useCallback(async () => {
    setLoading(true);
    
    try {
      const profile = await client.getProfile();
      setUser(profile);
      return profile;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    loading,
    error,
    login,
    logout,
    getProfile,
    client
  };
}

// Usage in component
function LoginComponent() {
  const { login, loading, error } = usePathfinder();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await login(username, password);
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
```

## Node.js Backend Integration

### Express Middleware

```javascript
// pathfinder-middleware.js
const PathfinderClient = require('./pathfinder-client');

// Create client instance
const pathfinderClient = new PathfinderClient(process.env.PATHFINDER_API_URL);

// Middleware to attach client to request
function attachPathfinderClient(req, res, next) {
  req.pathfinder = pathfinderClient;
  next();
}

// Middleware to proxy Pathfinder authentication
async function proxyAuthentication(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Verify token with Pathfinder API
    req.pathfinder.token = token;
    const profile = await req.pathfinder.getProfile();
    req.user = profile;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Example route using Pathfinder
app.post('/api/experiences', 
  attachPathfinderClient,
  proxyAuthentication,
  async (req, res) => {
    try {
      const experience = await req.pathfinder.createExperience(req.body);
      res.json(experience);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

module.exports = {
  attachPathfinderClient,
  proxyAuthentication
};
```

## Error Handling

### Comprehensive Error Handler

```javascript
class APIErrorHandler {
  static handle(error, context = {}) {
    const errorCode = error.response?.data?.error;
    
    switch (errorCode) {
      case 'AUTHENTICATION_FAILED':
        // Redirect to login
        window.location.href = '/login';
        break;
        
      case 'INSUFFICIENT_PRIVILEGES':
        // Show permission denied message
        this.showNotification('You do not have permission for this action', 'error');
        break;
        
      case 'RATE_LIMIT_EXCEEDED':
        // Show rate limit message with retry time
        const resetTime = error.response.headers['x-ratelimit-reset'];
        const retryIn = new Date(resetTime) - new Date();
        this.showNotification(
          `Too many requests. Please wait ${Math.ceil(retryIn / 1000)} seconds`,
          'warning'
        );
        break;
        
      case 'VALIDATION_ERROR':
        // Show validation errors
        const errors = error.response?.data?.errors || [];
        errors.forEach(err => {
          this.showNotification(`${err.field}: ${err.message}`, 'error');
        });
        break;
        
      default:
        // Generic error
        this.showNotification(
          error.message || 'An unexpected error occurred',
          'error'
        );
    }
    
    // Log to monitoring service
    this.logError(error, context);
  }
  
  static showNotification(message, type) {
    // Implementation depends on your notification system
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
  
  static logError(error, context) {
    // Send to error tracking service (e.g., Sentry)
    console.error('API Error:', {
      error: error.message,
      code: error.response?.data?.error,
      status: error.response?.status,
      context
    });
  }
}
```

## Testing

### Jest Test Examples

```javascript
// pathfinder-client.test.js
import PathfinderClient from './pathfinder-client';

describe('PathfinderClient', () => {
  let client;
  
  beforeEach(() => {
    client = new PathfinderClient('http://localhost:3000/api');
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Authentication', () => {
    test('should login successfully', async () => {
      const user = await client.login('test_user', 'test_password');
      
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username', 'test_user');
      expect(client.token).toBeTruthy();
    });
    
    test('should handle login failure', async () => {
      await expect(
        client.login('invalid_user', 'wrong_password')
      ).rejects.toThrow('Invalid credentials');
    });
    
    test('should refresh token automatically', async () => {
      jest.useFakeTimers();
      
      await client.login('test_user', 'test_password');
      const originalToken = client.token;
      
      // Fast-forward 14 minutes
      jest.advanceTimersByTime(14 * 60 * 1000);
      
      // Token should be refreshed
      expect(client.token).not.toBe(originalToken);
      
      jest.useRealTimers();
    });
  });
  
  describe('Experiences', () => {
    beforeEach(async () => {
      await client.login('test_user', 'test_password');
    });
    
    test('should create experience', async () => {
      const experience = await client.createExperience({
        title: 'Test Position',
        company: 'Test Company',
        start_date: '2020-01-01'
      });
      
      expect(experience).toHaveProperty('id');
      expect(experience.title).toBe('Test Position');
    });
    
    test('should handle validation errors', async () => {
      await expect(
        client.createExperience({ title: '' })
      ).rejects.toThrow('Validation failed');
    });
  });
});
```

## Best Practices

1. **Always use HTTPS in production**
2. **Implement proper error handling and retry logic**
3. **Store tokens securely (avoid localStorage for sensitive apps)**
4. **Implement request/response interceptors for common operations**
5. **Use environment variables for API URLs**
6. **Implement proper timeout handling**
7. **Cache responses when appropriate**
8. **Use connection pooling for better performance**
9. **Implement circuit breaker pattern for resilience**
10. **Log all API interactions for debugging**

## Related Documentation

- [API Reference](./openapi.yaml)
- [Authentication Flow](./authentication-flow.md)
- [Error Codes](./error-codes.md)
- [Rate Limiting](./rate-limiting.md)