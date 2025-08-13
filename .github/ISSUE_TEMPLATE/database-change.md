---
name: Database Change
about: Database schema changes or migrations
title: 'feat: [DB] '
labels: database, enhancement
assignees: ''

---

## 📋 Description
Brief description of the database change.

## 🎯 Purpose
Why is this database change needed?

## 📊 Schema Changes

### New Tables
```sql
-- CREATE TABLE statements
```

### Modified Tables
```sql
-- ALTER TABLE statements
```

### Indexes
```sql
-- CREATE INDEX statements
```

## 🔄 Migration Strategy
- [ ] Forward migration script
- [ ] Rollback script
- [ ] Data migration requirements
- [ ] Downtime requirements

## 📈 Performance Impact
- Expected data volume
- Query performance considerations
- Index strategy
- Partitioning needs

## 🔒 Security Considerations
- Sensitive data handling
- Encryption requirements
- Audit logging needs
- Access control

## 🧪 Testing Requirements
- [ ] Migration testing on dev
- [ ] Performance testing
- [ ] Rollback testing
- [ ] Data integrity verification

## 📚 Documentation Updates
- [ ] Database schema docs
- [ ] ER diagrams
- [ ] Migration guide
- [ ] Troubleshooting guide

## ⚠️ Risks
- Data loss potential
- Performance degradation
- Compatibility issues

## 🔗 Dependencies
- Related to: #
- Depends on: #
- Blocks: #