# Documentation

This directory contains comprehensive documentation for the RTS AI Development Template, covering all aspects of the template's architecture, patterns, and best practices.

## Overview

The RTS AI Development Template provides a **consistent, scalable foundation** for building modern applications with standardized patterns across development, deployment, and operations. The template emphasizes:

- **Consistency**: Uniform patterns across all technologies and project types
- **Developer Experience**: Streamlined workflows from development to production  
- **Scalability**: Architecture that grows with your project needs
- **Best Practices**: Security, performance, and operational excellence built-in

## Documentation Structure

### Core Architecture Documents

| Document | Purpose | Key Concepts |
|----------|---------|--------------|
| **[Project Architecture](project-architecture.md)** | High-level organizational patterns and project management principles | Project independence, consistent structure, technology flexibility |
| **[Feature Architecture](feature-architecture.md)** | Internal code organization for applications (React, NestJS, etc.) | Self-contained features, all code in features/ directory |
| **[Docker](docker.md)** | Container patterns, orchestration strategies, and development workflows | Service-oriented containerization, development-production parity |

### Infrastructure & Configuration

| Document | Purpose | Key Concepts |
|----------|---------|--------------|
| **[Terraform](terraform.md)** | Infrastructure as Code patterns, modules, and deployment | Atomic/composite modules, environment management, remote state |
| **[Environment Configuration](environment-configuration.md)** | Configuration management, environment variables, and secrets handling | Single source of truth, layered configuration, security-first |
| **[Keycloak](keycloak.md)** | Authentication and authorization with Keycloak | Cookie-based auth, backend proxy pattern, RBAC, global guards |

### Automation & Workflows

| Document | Purpose | Key Concepts |
|----------|---------|--------------|
| **[Task Automation](task-automation.md)** | Standardized build, deployment, and operational commands using Taskfile | Hierarchical namespaces, environment integration, workflow orchestration |
| **[Testing](testing.md)** | Testing patterns, strategies, and automation for code quality | Test pyramid, unit/integration/E2E tests, boundary testing, task integration |

## Getting Started

### For New Projects
1. Start with **[Project Architecture](project-architecture.md)** to understand the overall organizational approach
2. Review **[Feature Architecture](feature-architecture.md)** for application code organization patterns
3. Set up your development environment using **[Docker](docker.md)** and **[Task Automation](task-automation.md)**

### For Infrastructure
1. Begin with **[Terraform](terraform.md)** for infrastructure deployment patterns
2. Configure your environments using **[Environment Configuration](environment-configuration.md)**
3. Use **[Task Automation](task-automation.md)** for deployment workflows

### For Development Teams
1. **[Feature Architecture](feature-architecture.md)** - How to organize your application code
2. **[Docker](docker.md)** - Local development with containers
3. **[Task Automation](task-automation.md)** - Standard commands and workflows
4. **[Keycloak](keycloak.md)** - Authentication and authorization patterns
5. **[Testing](testing.md)** - Writing and running tests for quality assurance

## Key Design Principles

### Consistency Across Technologies
- **Same organizational patterns** whether building React frontends, NestJS backends, or managing infrastructure
- **Predictable command structure** using hierarchical task automation
- **Uniform containerization** approach for all services

### Developer Experience Focus
- **Simple local setup** with automated environment configuration
- **Live development** with hot reload and instant feedback
- **Standardized commands** that work identically across all projects and environments

### Production-Ready Patterns
- **Security-first** configuration management with proper secrets handling
- **Scalable architecture** that supports growth from prototype to production
- **Operational excellence** with built-in monitoring, health checks, and deployment automation

### Technology Flexibility
- **Use the right tool** for each project's requirements while maintaining consistent patterns
- **Framework agnostic** - patterns work with React, Vue, NestJS, FastAPI, Spring Boot, etc.
- **Cloud provider flexible** - currently AWS-focused but patterns extend to other providers

## Architecture Patterns Summary

### Project Organization
- **Projects/** - Independent applications and services, each with complete functionality
- **Consistent structure** - Same directory layout regardless of technology stack
- **Container-first development** - All application services (backend, frontend, keycloak) run in Docker

### Code Organization
- **Feature-based architecture** - All code organized as self-contained features
- **Everything in features** - No separate pages/endpoints directories, all code lives in features/
- **Reusable components** - Features can be easily moved between projects

### Infrastructure Management
- **Atomic/Composite modules** - Two-tier infrastructure abstraction for reusability
- **Environment-specific configuration** - Separate state and configuration per environment
- **Automated deployments** - Task-based orchestration of complex deployment workflows

### Configuration Management
- **Single source of truth** - Root `.env` file for all sensitive configuration
- **Layered approach** - Environment variables + service-specific configuration  
- **Security-first** - Secrets separated from code, proper rotation strategies

## Quick Reference

### Common Tasks
```bash
# Start local development
task project-name:local:start

# Deploy to development environment
task deploy-dev

# View service logs
task service-name:local:logs

# Infrastructure planning
task terraform:aws:plan-dev

# Run tests
task backend:local:test          # Backend unit tests
task frontend:local:test         # Frontend unit tests
task test:integration            # All integration tests
task e2e:test                    # E2E tests
```

### Directory Navigation
- **Frontend projects**: `projects/frontend/`
- **Backend services**: `projects/backend/`
- **E2E tests**: `projects/e2e/`
- **Infrastructure code**: `terraform/aws/`
- **Automation scripts**: `scripts/`
- **Project templates**: `project-templates/`

### Configuration Files
- **Root environment**: `.env` (create from template)
- **Task automation**: `Taskfile.yml` (root and per-project)
- **Container orchestration**: `docker-compose.yml` (per project)
- **Infrastructure**: `terraform/aws/environments/`

## Support & Contribution

This documentation is designed to be comprehensive yet practical. Each document includes:
- **Core concepts** and design philosophy
- **Practical examples** and implementation patterns  
- **Best practices** and common pitfalls to avoid
- **Integration points** with other parts of the system

For questions or improvements to the documentation, refer to the main project README or contribution guidelines.

---

*This template provides a foundation for building scalable, maintainable applications with consistent patterns across the entire development lifecycle.*
