# Project Architecture

High-level organizational patterns and principles for consistent project management across technologies.

## Architecture Overview

This template provides **consistent project organization patterns** that work across any technology stack, project type, and deployment environment. Each project maintains independence while sharing common structural and operational patterns.

### Key Project Principles

- **Project Independence**: Each project owns its functionality and configuration
- **Consistent Patterns**: Same structure across all technologies and project types
- **Container-First**: All projects run in Docker for development and deployment
- **Task Automation**: Standardized build, test, and deployment workflows

### Project Types

| Type | Purpose | Examples | Development | Deployment |
|------|---------|----------|-------------|------------|
| **Applications** | User-facing interfaces | React, Vue, Angular | Docker container | Docker container (ECS) |
| **Services** | Backend logic and APIs | FastAPI, NestJS, Spring Boot | Docker container | Docker container (ECS) |
| **Infrastructure** | Supporting services | Databases, message queues | Docker container | Managed service (RDS) |
| **Tools** | Development utilities | CLI tools, build systems | Docker container | Docker container |

## Directory Structure

```
projects/
├── docker-compose.yml         # Project orchestration
├── user-dashboard/            # Example frontend application
├── auth-service/              # Example backend service
├── notification-service/      # Example backend service
├── analytics-db/              # Example database project
└── monitoring-tools/          # Example utility project
```

**Standard Project Structure**:

**For Services & Infrastructure**:
```
project-name/
├── app/                       # Application source code
├── dockerfiles/               # Container definitions  
├── docker-compose.yml         # Project configuration
└── Taskfile.yml              # Project automation
```

**For Frontend Applications**:
```
project-name/
├── app/                       # Application source code
├── dockerfiles/               # Container definitions
├── docker-compose.yml         # Service configuration
└── Taskfile.yml              # Build and deployment automation
```

## Key Project Management Principles

### 1. Consistent Project Structure
- **Standard Layout**: All projects follow the same directory organization
- **Unified Containerization**: All application services use Docker (backend, frontend, keycloak)
- **Task Automation**: Standardized build, test, and deployment commands
- **Environment Parity**: Same patterns work across development, staging, and production

### 2. Development Environment Strategy
- **All Services in Docker**: Docker Compose orchestrates all application services
- **Consistent Deployment**: Same containerization approach for local and production
- **Cross-Platform**: Consistent behavior regardless of host operating system
- **Production Ready**: Identical container patterns from development to production

### 3. Project Communication
- **Network Isolation**: Projects communicate through well-defined network interfaces
- **API Contracts**: Clear interfaces between projects when they need to interact
- **Configuration Management**: Environment-specific settings through `.env` files
- **Health Monitoring**: Standard health check endpoints for operational visibility

### 4. Technology Flexibility
- **Technology Choice**: Use the right tool for each project's requirements
- **Consistent Patterns**: Same organizational structure regardless of programming language
- **Template System**: Pre-configured templates for common technology stacks
- **Interoperability**: Projects can be developed and deployed independently

## Code Organization

All projects follow the [Feature Architecture](feature-architecture.md) pattern:

```
src/
└── features/
    ├── auth/                  # Complete authentication feature
    ├── user-dashboard/        # Dashboard feature with pages
    ├── api-client/            # Shared HTTP client feature
    └── ui-components/         # Shared design system
```

**Key Principle**: All code lives inside features. There are no separate `pages/` or `endpoints/` directories. Features can be either full-stack (with pages/endpoints) or shared utilities (components/services/clients).

This creates **consistent mental models** across all technologies and team members, with a single organizing principle: features.