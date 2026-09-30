# Project Overview

## Introduction

This project is a full-stack JavaScript calendarization application designed for Session 8 of the AI Accelerated Engineering Bootcamp.

## Architecture

The project follows a monorepo architecture with:

- `packages/frontend/`: React-based web application
- `packages/backend/`: Express.js API server with in-memory storage

Testing coverage spans unit, integration, and UI end-to-end validation across frontend and backend behaviors.

## Technology Stack

### Frontend

- React 18
- Material-UI (MUI) v5 - Modern component library
- @mui/icons-material - Icon components
- @emotion/react & @emotion/styled - CSS-in-JS styling (required by MUI)
- React Query (TanStack Query) v5 - Data fetching and state management
- React Testing Library - Component testing
- Playwright - UI end-to-end testing for critical user journeys
- ESLint for code quality

### Backend

- Node.js
- Express.js
- Jest and Supertest for testing
- ESLint for code quality

### Development Tools

- npm workspaces for monorepo management
- GitHub Actions for automated validation
- GitHub Codespaces for consistent development environment

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- GitHub Copilot access

### Installation

1. Fork this repository
2. Open in GitHub Codespaces (recommended) or clone locally
3. Run `npm install` at the root to install all dependencies
4. Follow the GitHub Issue instructions that appear after forking

### Running the Application

```bash
# Start both frontend and backend
npm run start

# Run tests for all packages
npm test

# Run linting
npm run lint

# Run UI end-to-end tests
npm run test:ui
```

## Development Philosophy

This exercise emphasizes **iterative problem-solving with AI**:

- Don't try to fix everything at once
- Use tests as your guide
- Let errors inform your next step
- Build incrementally and validate continuously
- Learn to read and interpret test failures
- Practice clear communication with AI assistants
- Prioritize critical-path UI scenarios with automated browser tests

## License

MIT License - See LICENSE file for details