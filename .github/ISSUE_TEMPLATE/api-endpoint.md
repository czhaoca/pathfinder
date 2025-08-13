---
name: API Endpoint
about: New or modified API endpoint
title: 'feat: [API] '
labels: api, enhancement
assignees: ''

---

## 📋 Description
Brief description of the API endpoint change.

## 🎯 Endpoint Details

### Method & Path
```
METHOD /api/path/to/endpoint
```

### Request
```json
{
  "field": "value"
}
```

### Response
```json
{
  "success": true,
  "data": {}
}
```

### Error Responses
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found

## 🔒 Authentication & Authorization
- [ ] Requires authentication
- [ ] Required roles: 
- [ ] Rate limiting: 
- [ ] Special permissions: 

## 📊 Implementation Details

### Backend Changes
```javascript
// Route handler implementation
```

### Database Queries
```sql
-- Required queries
```

### Validation Rules
- Field validations
- Business logic validations

## 🧪 Testing Requirements
- [ ] Unit tests
- [ ] Integration tests
- [ ] Load testing
- [ ] Security testing

## 📚 Documentation Updates
- [ ] API reference
- [ ] OpenAPI/Swagger spec
- [ ] Postman collection
- [ ] Code examples

## ⚠️ Breaking Changes
List any breaking changes to existing endpoints.

## 🔗 Dependencies
- Frontend: #
- Database: #
- Related endpoints: #

## 📈 Performance Requirements
- Expected response time: 
- Max payload size: 
- Caching strategy: