# Contributing to Career Navigator

Thank you for your interest in contributing to Career Navigator! This guide will help you get started with contributing to the project.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Process](#development-process)
4. [Coding Standards](#coding-standards)
5. [Pull Request Process](#pull-request-process)
6. [Reporting Issues](#reporting-issues)

## Code of Conduct

### Our Pledge

We are committed to providing a friendly, safe, and welcoming environment for all contributors, regardless of experience level, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, nationality, or other similar characteristics.

### Expected Behavior

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

1. Fork the repository on GitHub
2. Clone your fork locally:
```bash
git clone https://github.com/your-username/career-navigator.git
cd career-navigator
```

3. Add the upstream repository:
```bash
git remote add upstream https://github.com/original-org/career-navigator.git
```

4. Set up your development environment following the [Development Setup Guide](./development-setup.md)

### Finding Something to Work On

- Check the [GitHub Issues](https://github.com/your-org/career-navigator/issues) for open issues
- Look for issues labeled `good first issue` or `help wanted`
- Review the [Project Roadmap](../features/README.md#upcoming-features)
- Propose new features by creating an issue first

## Development Process

### 1. Create a Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name
# Or for bugs: git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Write clean, readable code
- Follow the coding standards
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all tests
npm run test

# Run linting
npm run lint

# Type checking
npm run typecheck
```

### 4. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: <type>(<scope>): <subject>

# Examples:
git commit -m "feat(auth): add two-factor authentication"
git commit -m "fix(api): resolve database connection timeout"
git commit -m "docs(readme): update installation instructions"
git commit -m "refactor(frontend): simplify state management"
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 5. Push Your Changes

```bash
git push origin feature/your-feature-name
```

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

```typescript
/**
 * Calculates the user's career progression score
 * @param experiences - Array of user experiences
 * @returns Career progression score (0-100)
 */
export function calculateCareerScore(experiences: Experience[]): number {
  // Implementation
}
```

### React Components

- Use functional components with hooks
- Follow single responsibility principle
- Extract reusable logic into custom hooks
- Use proper TypeScript types for props

```typescript
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ onClick, children, variant = 'primary', disabled = false }: ButtonProps) {
  // Component implementation
}
```

### Database

- Follow naming conventions (snake_case for tables/columns)
- Always include migrations for schema changes
- Add appropriate indexes for performance
- Document complex queries

### API Design

- Follow RESTful principles
- Use consistent error responses
- Version APIs when making breaking changes
- Document all endpoints

## Pull Request Process

### Before Submitting

1. **Update Documentation**: If you've changed APIs, update the relevant documentation
2. **Add Tests**: Ensure your changes are covered by tests
3. **Run Full Test Suite**: `npm run test`
4. **Check Code Quality**: `npm run lint && npm run typecheck`
5. **Update CHANGELOG**: Add your changes under "Unreleased"

### Submitting a Pull Request

1. Push your branch to your fork
2. Go to the main repository on GitHub
3. Click "New Pull Request"
4. Select your fork and branch
5. Fill out the PR template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

### Review Process

1. Automated checks will run (tests, linting, etc.)
2. A maintainer will review your code
3. Address any feedback
4. Once approved, your PR will be merged

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Environment**: OS, Node version, browser
2. **Steps to Reproduce**: Clear, numbered steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Screenshots**: If applicable
6. **Error Messages**: Complete error output

### Feature Requests

For feature requests, include:

1. **Problem Statement**: What problem does this solve?
2. **Proposed Solution**: How would you implement it?
3. **Alternatives**: Other solutions considered
4. **Additional Context**: Mockups, examples, etc.

## Development Tips

### Running Specific Tests

```bash
# Run tests for a specific file
npm run test -- auth.test.ts

# Run tests in watch mode
npm run test -- --watch

# Run with coverage
npm run test -- --coverage
```

### Debugging

- Use VS Code debugger configurations
- Add `console.log` statements (remove before committing)
- Use React Developer Tools for frontend debugging
- Check network tab for API issues

### Performance Considerations

- Profile before optimizing
- Consider pagination for large datasets
- Use proper database indexes
- Implement caching where appropriate

## Getting Help

- **Discord**: Join our community server
- **GitHub Discussions**: Ask questions
- **Documentation**: Check existing docs first
- **Issue Comments**: Ask for clarification on issues

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Given credit in commit messages

Thank you for contributing to Career Navigator! 🎉