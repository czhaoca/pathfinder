# Resume Generation API Endpoints

## Overview

The Resume Generation API provides AI-powered resume creation and optimization services. These endpoints generate professional resumes in multiple formats (PDF, DOCX, TXT) with ATS optimization and customizable templates.

## Authentication

All resume endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Base URL

```
/api/resume
```

## Endpoints

### 1. Generate Resume

Generate a professional resume based on user experiences and profile data.

**Endpoint:** `POST /api/resume/generate`

**Request Body:**
```json
{
  "template": "modern",  // Options: modern, classic, executive, creative
  "format": "pdf",       // Options: pdf, docx, txt
  "includePhoto": false,
  "sections": {
    "summary": true,
    "experience": true,
    "education": true,
    "skills": true,
    "certifications": true,
    "achievements": true
  },
  "experienceIds": ["exp-1", "exp-2"],  // Optional: specific experiences to include
  "targetRole": "Senior Software Engineer",  // Optional: for ATS optimization
  "keywords": ["JavaScript", "React", "AWS"]  // Optional: for keyword optimization
}
```

**Response:**
```json
{
  "resumeId": "resume-123",
  "downloadUrl": "https://api.pathfinder.com/resume/download/resume-123",
  "expiresIn": 3600,  // Download link expires in 1 hour
  "format": "pdf",
  "pages": 2,
  "atsScore": 0.85,  // ATS compatibility score (0-1)
  "suggestions": [
    "Consider adding more quantifiable achievements",
    "Include relevant certifications for target role"
  ]
}
```

### 2. Preview Resume

Generate a preview of the resume in HTML format for editing.

**Endpoint:** `POST /api/resume/preview`

**Request Body:** Same as Generate Resume endpoint

**Response:**
```json
{
  "previewId": "preview-123",
  "html": "<html>...</html>",
  "sections": {
    "header": {
      "name": "John Doe",
      "title": "Senior Software Engineer",
      "contact": {
        "email": "john@example.com",
        "location": "San Francisco, CA"
      }
    },
    "summary": "Experienced software engineer...",
    "experience": [
      {
        "title": "Senior Software Engineer",
        "organization": "Tech Corp",
        "dates": "Jan 2020 - Present",
        "highlights": ["Led team of 5 engineers", "Reduced load time by 40%"]
      }
    ],
    "skills": {
      "technical": ["JavaScript", "React", "Node.js"],
      "soft": ["Leadership", "Communication"]
    }
  }
}
```

### 3. Update Resume Section

Update a specific section of an existing resume preview.

**Endpoint:** `PUT /api/resume/preview/:previewId/section`

**Path Parameters:**
- `previewId` (string): Preview ID from preview endpoint

**Request Body:**
```json
{
  "section": "summary",
  "content": "Results-driven software engineer with 10+ years of experience..."
}
```

**Response:**
```json
{
  "message": "Section updated successfully",
  "previewId": "preview-123",
  "updatedSection": "summary"
}
```

### 4. Get Resume Templates

Get available resume templates with descriptions.

**Endpoint:** `GET /api/resume/templates`

**Response:**
```json
{
  "templates": [
    {
      "id": "modern",
      "name": "Modern Professional",
      "description": "Clean, contemporary design suitable for tech roles",
      "preview": "https://api.pathfinder.com/resume/templates/modern/preview.png",
      "features": ["ATS-optimized", "Single column", "Clean typography"],
      "bestFor": ["Software Engineers", "Product Managers", "Data Scientists"]
    },
    {
      "id": "classic",
      "name": "Classic Professional",
      "description": "Traditional format preferred by conservative industries",
      "features": ["Timeless design", "Easy to scan", "Professional appearance"],
      "bestFor": ["Finance", "Law", "Government"]
    }
  ]
}
```

### 5. Optimize for ATS

Analyze and optimize resume content for Applicant Tracking Systems.

**Endpoint:** `POST /api/resume/optimize-ats`

**Request Body:**
```json
{
  "resumeContent": "...", // Plain text resume content
  "targetRole": "Senior Software Engineer",
  "jobDescription": "..." // Optional: specific job description to match
}
```

**Response:**
```json
{
  "originalScore": 0.65,
  "optimizedScore": 0.88,
  "improvements": [
    {
      "type": "keywords",
      "suggestion": "Add these keywords: microservices, CI/CD, agile",
      "impact": "high"
    },
    {
      "type": "formatting",
      "suggestion": "Use standard section headers: Work Experience instead of Professional Journey",
      "impact": "medium"
    }
  ],
  "optimizedContent": "...", // Improved resume content
  "keywordMatch": {
    "matched": ["JavaScript", "React", "Team Leadership"],
    "missing": ["Kubernetes", "Python", "Scrum"],
    "coverage": 0.75
  }
}
```

### 6. Download Resume

Download a generated resume file.

**Endpoint:** `GET /api/resume/download/:resumeId`

**Path Parameters:**
- `resumeId` (string): Resume ID from generate endpoint

**Response:**
- Binary file download with appropriate content type
- Content-Type: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, or text/plain
- Content-Disposition: attachment; filename="john-doe-resume.pdf"

### 7. Get Resume History

Get list of previously generated resumes.

**Endpoint:** `GET /api/resume/history`

**Query Parameters:**
- `limit` (number, optional): Number of results (default: 10)
- `offset` (number, optional): Pagination offset

**Response:**
```json
{
  "resumes": [
    {
      "resumeId": "resume-123",
      "createdAt": "2024-01-31T10:00:00Z",
      "template": "modern",
      "format": "pdf",
      "targetRole": "Senior Software Engineer",
      "downloadUrl": "https://api.pathfinder.com/resume/download/resume-123",
      "expiresAt": "2024-01-31T11:00:00Z"
    }
  ],
  "total": 15,
  "hasMore": true
}
```

### 8. Generate Cover Letter

Generate a matching cover letter based on resume and job details.

**Endpoint:** `POST /api/resume/cover-letter`

**Request Body:**
```json
{
  "resumeId": "resume-123",  // Optional: base on existing resume
  "companyName": "Tech Corp",
  "jobTitle": "Senior Software Engineer",
  "jobDescription": "...",
  "tone": "professional",  // Options: professional, enthusiastic, conversational
  "length": "medium"       // Options: short, medium, long
}
```

**Response:**
```json
{
  "coverLetterId": "letter-456",
  "content": "Dear Hiring Manager...",
  "downloadUrl": "https://api.pathfinder.com/resume/cover-letter/letter-456",
  "wordCount": 350,
  "readingTime": "1.5 minutes",
  "keyPointsHighlighted": [
    "10 years of experience matching job requirements",
    "Specific achievement: reduced load time by 40%",
    "Leadership experience with 5-person team"
  ]
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid template",
  "message": "Template 'custom' is not available"
}
```

### 402 Payment Required
```json
{
  "error": "Quota exceeded",
  "message": "Monthly resume generation limit reached. Upgrade to Pro for unlimited resumes."
}
```

### 500 Internal Server Error
```json
{
  "error": "Generation failed",
  "message": "Unable to generate resume. Please try again."
}
```

## Rate Limiting

- Resume generation: 10 requests per hour
- Preview generation: 30 requests per hour
- Template listing: 100 requests per hour
- Download: 50 requests per hour

## Best Practices

1. **Use Preview First**: Generate a preview to review and edit before creating the final document.

2. **Target Role Optimization**: Always provide a target role for better ATS optimization.

3. **Template Selection**: Choose templates based on industry and role requirements.

4. **Keyword Optimization**: Include relevant keywords from job descriptions for better ATS scores.

5. **Format Considerations**:
   - PDF: Best for visual consistency
   - DOCX: Best for ATS systems
   - TXT: Fallback for maximum compatibility

## AI-Powered Features

The resume generation service uses OpenAI GPT-4 for:
- Professional summary generation
- Achievement quantification and enhancement
- Skill extraction and categorization
- ATS optimization suggestions
- Cover letter personalization

## Future Enhancements

- LinkedIn profile import
- Real-time collaboration
- A/B testing for different versions
- Industry-specific templates
- Multi-language support
- Video resume generation