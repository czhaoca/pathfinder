# Progressive Profile Collection System

## Overview

The Progressive Profile Collection System implements a sophisticated approach to gathering user profile data incrementally, minimizing friction during onboarding while ensuring necessary data is collected when features require it.

## Key Features

### 1. Dynamic Field Requirements
- **Essential Fields**: Required at registration (email, name, password)
- **Feature-Specific Fields**: Requested only when accessing features that need them
- **Optional Fields**: Can be skipped and completed later
- **Field Groups**: Logical grouping (personal, professional, preferences)

### 2. Profile Completeness Tracking
- **Real-time Calculation**: Percentage-based completion tracking
- **Weighted Scoring**: Essential fields carry more weight than optional ones
- **Visual Indicators**: Progress bars and completion circles
- **Breakdown by Category**: Essential, Professional, Optional

### 3. Feature Access Control
- **Gate Component**: Controls access based on profile completeness
- **Non-blocking Prompts**: Users can skip non-critical fields
- **Alternative Fields**: Multiple fields can satisfy a requirement
- **Graceful Degradation**: Limited access when requirements not met

### 4. Smart Data Collection
- **Progressive Forms**: Multi-step wizards for field collection
- **Inline Editing**: Update fields without leaving current context
- **Field Suggestions**: AI-powered recommendations for next fields
- **Import Capabilities**: LinkedIn and resume data import

## Architecture

### Database Schema

```sql
-- Profile field definitions
pf_profile_fields
  - field_id (PRIMARY KEY)
  - field_name (UNIQUE)
  - field_type (text, email, phone, date, select, etc.)
  - field_group (personal, professional, preferences)
  - validation_rules (JSON)
  - is_essential (Y/N)
  - encryption_required (Y/N)

-- Feature requirements mapping
pf_feature_field_requirements
  - requirement_id (PRIMARY KEY)
  - feature_key
  - field_id (FOREIGN KEY)
  - requirement_level (required, recommended, optional)
  - alternative_fields (JSON)

-- User profile data
pf_user_profile_data
  - data_id (PRIMARY KEY)
  - user_id (FOREIGN KEY)
  - field_id (FOREIGN KEY)
  - field_value
  - field_value_encrypted
  - verified (Y/N)
  - source (manual, import, api)

-- Completion tracking
pf_user_profile_completion
  - user_id (PRIMARY KEY)
  - total_fields
  - completed_fields
  - completion_percentage
  - profile_score
  - fields_skipped (JSON)
```

### Backend Services

#### ProfileFieldsService
- Manages field definitions and requirements
- Validates field values
- Handles encryption for sensitive fields
- Checks feature access requirements

#### ProfileCompletionService
- Calculates completion percentages
- Generates field suggestions
- Manages collection prompts
- Handles data imports

### Frontend Components

#### ProgressiveProfileForm
- Multi-step form wizard
- Real-time validation
- Skip functionality
- Progress tracking

#### ProfileCompletionIndicator
- Visual completion display
- Interactive breakdown
- Click to edit functionality

#### FeatureAccessGate
- Wraps features requiring profile data
- Shows requirements when blocked
- Launches profile collection

## API Endpoints

### Profile Management
```
GET    /api/progressive-profile/fields         # Get field definitions
GET    /api/progressive-profile/data           # Get user profile
PATCH  /api/progressive-profile/data           # Update profile (partial)
GET    /api/progressive-profile/completion     # Get completion stats
GET    /api/progressive-profile/suggestions    # Get field suggestions
```

### Feature Access
```
GET    /api/progressive-profile/feature-access/:featureKey  # Check access
```

### Prompts & Import
```
GET    /api/progressive-profile/prompts        # Get pending prompts
POST   /api/progressive-profile/prompts        # Create prompt
PATCH  /api/progressive-profile/prompts/:id    # Update response
POST   /api/progressive-profile/import         # Import external data
```

## Usage Examples

### 1. Protecting a Feature

```tsx
import { FeatureAccessGate } from '@/components/profile/FeatureAccessGate';

function AdvancedSearch() {
  return (
    <FeatureAccessGate 
      featureKey="advanced_search"
      featureName="Advanced Search"
      allowSkip={false}
    >
      <SearchInterface />
    </FeatureAccessGate>
  );
}
```

### 2. Showing Profile Completion

```tsx
import { ProfileCompletionIndicator } from '@/components/profile/ProfileCompletionIndicator';

function Dashboard() {
  return (
    <div className="dashboard">
      <ProfileCompletionIndicator 
        size="medium"
        showDetails={true}
      />
      {/* Other dashboard content */}
    </div>
  );
}
```

### 3. Collecting Profile Data

```tsx
import { ProgressiveProfileForm } from '@/components/profile/ProgressiveProfileForm';

function ProfileWizard({ fields, onComplete }) {
  return (
    <ProgressiveProfileForm
      requiredFields={fields}
      onComplete={onComplete}
      featureKey="profile_setup"
      mode="wizard"
    />
  );
}
```

## Field Validation

### Built-in Validators
- **Email**: RFC-compliant email validation
- **Phone**: International phone number formats
- **Date**: ISO date format
- **URL**: Valid URL format
- **Pattern**: Custom regex patterns

### Custom Validation Rules
```javascript
{
  required: true,
  minLength: 10,
  maxLength: 500,
  pattern: "^[A-Z][a-z]+$",
  patternMessage: "Must start with capital letter",
  min: 0,
  max: 100
}
```

## Security Considerations

### Data Protection
- **Field-level Encryption**: Sensitive fields encrypted at rest
- **User-specific Keys**: Each user has unique encryption keys
- **Audit Logging**: All profile changes logged
- **Access Control**: Role-based field visibility

### Privacy
- **Minimal Collection**: Only collect what's needed
- **Transparent Purpose**: Clear messaging about data use
- **User Control**: Ability to skip/delete fields
- **GDPR Compliance**: Right to access and deletion

## Performance Optimization

### Caching Strategy
- **Field Definitions**: Cached for 1 hour
- **User Profiles**: Cached for 15 minutes
- **Completion Stats**: Cached per session
- **Invalidation**: Automatic on updates

### Lazy Loading
- **On-demand Fields**: Load only when needed
- **Progressive Enhancement**: Basic fields first
- **Batch Updates**: Group field updates
- **Debounced Saves**: Prevent excessive API calls

## Configuration

### Setting Feature Requirements

```javascript
// Admin API to set requirements
await progressiveProfileAPI.setFeatureRequirements('resume_builder', [
  {
    fieldId: 'field_123',
    requirementLevel: 'required',
    customMessage: 'Work history needed for resume'
  },
  {
    fieldId: 'field_456',
    requirementLevel: 'recommended',
    alternativeFields: ['field_789']
  }
]);
```

### Field Definition

```javascript
// Create a new field
await progressiveProfileAPI.createField({
  fieldName: 'years_experience',
  fieldLabel: 'Years of Experience',
  fieldType: 'number',
  fieldGroup: 'professional',
  validationRules: {
    required: true,
    min: 0,
    max: 50
  },
  helpText: 'Total years of professional experience',
  isEssential: false,
  encryptionRequired: false
});
```

## Testing

### Unit Tests
- Field validation logic
- Completion calculations
- Score algorithms
- Import mappings

### Integration Tests
- Progressive collection flow
- Feature access checking
- Cache invalidation
- Database transactions

### E2E Tests
- Complete profile wizard
- Feature gate interactions
- Import workflows
- Skip/remind scenarios

## Monitoring

### Key Metrics
- **Completion Rate**: Percentage of users completing profiles
- **Drop-off Points**: Where users abandon collection
- **Skip Rate**: Frequency of field skipping
- **Time to Complete**: Average completion time

### Alerts
- High skip rates for essential fields
- Validation error spikes
- Import failures
- Performance degradation

## Future Enhancements

1. **Machine Learning**
   - Predict likely field values
   - Optimize field ordering
   - Personalized suggestions

2. **Advanced Import**
   - PDF resume parsing
   - Social media imports
   - API integrations

3. **Gamification**
   - Completion badges
   - Streak tracking
   - Peer comparisons

4. **Smart Defaults**
   - Industry-based defaults
   - Location-based suggestions
   - Role-specific templates