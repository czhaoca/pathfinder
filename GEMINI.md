# Gemini Agent Guidelines for Career Navigator Project

This document outlines specific guidelines for the Gemini agent when interacting with the `career-navigator` codebase. Adhering to these principles will ensure consistency, maintainability, and alignment with the project's core values.

## General Principles

1.  **User-Centric Design**: Always prioritize the end-user experience. When implementing features or fixing bugs, consider the impact on user privacy, data sovereignty, and ease of use.
2.  **Privacy-First**: The project emphasizes "Privacy by Design" and "Zero-Knowledge Architecture." When handling data or implementing features, ensure that user data is protected, encrypted, and that the agent does not inadvertently expose or log sensitive information. Prioritize BYOK (Bring Your Own Keys) and end-to-end encryption principles.
3.  **Modularity and Extensibility**: Maintain the modular structure of the codebase. When adding new features, consider if they can be implemented as "Specialized Add-on Modules" as described in the `README.md`.
4.  **AI Integration**: When working with AI-related components, ensure compatibility with various AI integration options (API-based, self-hosted, MCP Integration) as outlined in the `README.md`. Avoid hardcoding AI service specifics.
5.  **Convention Adherence**: Before making any changes, thoroughly analyze existing code, tests, and configuration files to understand and adhere to established coding styles, architectural patterns, and naming conventions.

## Development Workflow

1.  **Understand**: Before acting, fully understand the request and the relevant codebase context. Utilize `search_file_content`, `glob`, `read_file`, and `read_many_files` to gather necessary information.
2.  **Plan**: Formulate a clear, concise plan. If the task involves code modification, identify relevant tests or plan to write new ones to ensure a safety net.
3.  **Implement**: Apply changes strictly following project conventions.
4.  **Verify (Tests)**: If applicable, run existing tests or newly created tests to verify functionality. Identify test commands by examining `README` files, `package.json`, or existing test execution patterns.
5.  **Verify (Standards)**: After code changes, always run project-specific build, linting, and type-checking commands (e.g., `npm run lint`, `tsc`). If unsure, ask the user for the correct commands.

## Specific Considerations

*   **File Paths**: Always use absolute paths for file operations.
*   **Shell Commands**: Explain critical `run_shell_command` executions that modify the file system or codebase.
*   **Commit Messages**: When preparing commits, follow the project's existing commit message style (check `git log`). Focus on "why" the change was made.
*   **Documentation**: If changes impact user-facing features or developer workflows, consider if updates to the `docs/` directory are necessary.

By following these guidelines, the Gemini agent will contribute effectively and safely to the `career-navigator` project.