# Documentation Standards

This document outlines the standards and conventions for documentation in the Career Navigator project.

## Structure

Documentation is organized into the following categories:

```
docs/
├── user-guides/          # End-user documentation
├── platform/            # Feature and product documentation
├── deployment/          # Deployment and operational guides
├── development/         # Technical documentation
├── addons/             # Add-on module documentation
└── DOCUMENTATION-STANDARDS.md
```

## Writing Guidelines

### Markdown Standards

- Use clear, concise language
- Include table of contents for longer documents
- Use proper heading hierarchy (H1 for title, H2 for major sections)
- Include code examples where appropriate
- Use consistent formatting for code blocks, file paths, and commands

### Code Documentation

- Include inline comments for complex logic
- Document API endpoints with examples
- Provide setup and configuration instructions
- Include troubleshooting sections

## Diagram Standards

### Mermaid Diagrams

All diagrams should follow our Mermaid workflow:

1. **Source Files**: Create `.mmd` files in `assets/` folder relative to the markdown file
2. **PNG Generation**: Convert to PNG using our scripts
3. **Markdown Reference**: Link to PNG files, not inline Mermaid code

#### Structure Example:
```
docs/section/
├── document.md
└── assets/
    ├── diagram.mmd       # Source file
    └── diagram.png       # Generated image
```

#### Conversion Commands:
```bash
# Convert single file
./scripts/mermaid-to-png.sh docs/section/assets/diagram.mmd

# Using Node.js script
node scripts/mermaid-converter.js docs/section/assets/diagram.mmd
```

#### Markdown Reference:
```markdown
![Diagram Title](./assets/diagram.png)
```

### Diagram Best Practices

- Use descriptive titles and labels
- Keep diagrams focused and uncluttered
- Use consistent color schemes
- Include legends when necessary
- Maintain both source and generated files in version control

## File Naming

- Use lowercase with hyphens for file names: `user-authentication.md`
- Use descriptive names that reflect content
- Group related files in appropriate subdirectories
- Use consistent naming patterns within sections

## Version Control

- Commit both source (`.mmd`) and generated (`.png`) files
- Update diagrams when making architectural changes
- Include meaningful commit messages for documentation changes
- Review documentation changes as part of code reviews

## Maintenance

- Regular review of documentation for accuracy
- Update diagrams when system changes occur
- Archive outdated documentation appropriately
- Ensure examples and code snippets remain functional

## Tools

- **Mermaid**: For creating diagrams
- **Markdown**: For documentation content
- **Our Scripts**: For automated PNG generation
- **Git**: For version control and collaboration