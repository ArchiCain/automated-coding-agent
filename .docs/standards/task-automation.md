# Task Automation

Automation patterns, workflow organization, and command standardization using Taskfile.

## Automation Philosophy

This repo uses [Taskfile](https://taskfile.dev) to provide consistent automation across all services and environments:

- **Namespace Organization**: Hierarchical command structure for predictable workflows
- **Environment Integration**: Automatic environment variable loading and management
- **Cross-Platform Consistency**: Same commands work across different operating systems and project types
- **Complexity Encapsulation**: Simple commands that handle complex underlying operations

## Task Organization Patterns

### Hierarchical Namespace Structure
Commands follow a predictable pattern that scales from simple to complex projects:

```
service-name:environment:action
│           │           │
│           │           └─ What to do (start, stop, build, deploy, etc.)
│           └─ Where to run (local, dev, staging, prod)
└─ Which service (api-gateway, user-service, frontend, etc.)
```

This structure provides intuitive command discovery and consistent behavior across all services.

### Environment Namespaces
Commands are organized by deployment target:
- **`local:*`**: Development operations on local machine
- **`dev:*`**: Operations targeting development cloud environment
- **`staging:*`**: Operations targeting staging environment (when implemented)
- **`prod:*`**: Operations targeting production environment (when implemented)

### Standard Action Types
Common actions that apply across services and environments:
- **Lifecycle Operations**: start, stop, restart, health checks
- **Development Operations**: logs, shell access, debugging
- **Build Operations**: build, test, lint, format
- **Deployment Operations**: push, deploy, rollback

## Automation Patterns

### Environment Variable Integration
Task automation automatically loads environment configuration, ensuring all commands have access to necessary credentials, configuration, and infrastructure values without manual setup.

### Service Discovery
Task commands automatically discover available services and environments through the hierarchical namespace, enabling tab completion and consistent command patterns.

### Cross-Service Operations
Project-wide operations coordinate multiple services through standardized interfaces, enabling complex workflows with simple commands.

## Task Discovery and Usage

### Command Discovery
The hierarchical namespace enables intuitive command discovery:
- **List all tasks**: View complete command inventory
- **Tab completion**: Progressive discovery of available commands
- **Help system**: Built-in documentation for each command

### Workflow Integration
Tasks integrate seamlessly with development workflows:
- **IDE Integration**: Commands can be run from development environment
- **CI/CD Integration**: Same commands work in automated environments
- **Team Consistency**: All team members use identical commands regardless of local setup

## Implementation Patterns

### Service Integration
Each service provides a standardized Taskfile that integrates with the root automation system, ensuring consistent behavior while allowing service-specific customization.

### Complex Workflow Orchestration
Multi-step operations are encapsulated into single commands that handle dependencies, error handling, and cleanup automatically.

### Error Handling and Recovery
Tasks include appropriate error handling and recovery mechanisms, providing clear feedback when operations fail and guidance for resolution.

## Best Practices

### Command Design
- **Intuitive Naming**: Commands follow predictable patterns for easy discovery
- **Idempotent Operations**: Commands can be run multiple times safely
- **Clear Feedback**: Operations provide appropriate status and error information
- **Consistent Behavior**: Similar operations work identically across all services

### Workflow Organization
- **Logical Grouping**: Related commands are organized within appropriate namespaces
- **Dependency Management**: Commands handle prerequisites automatically
- **Environment Awareness**: Commands adapt behavior based on target environment

For related standards:
- **Environment Integration**: [Environment Configuration](environment-configuration.md)
- **Infrastructure**: See `infrastructure/.docs/`

## Actual Task Hierarchy

The root `Taskfile.yml` includes project-level Taskfiles:

```
task up                    # Start Minikube + build + deploy + tunnel
task up:build-and-deploy   # Build images + deploy (internal)
task build:all             # Build all Docker images
task deploy:apply          # Deploy via Helmfile
task status                # Show cluster status
task tunnel                # Start Traefik ingress tunnel
task close                 # Stop tunnel
task reset:up              # Wipe and redeploy from scratch

# Per-project tasks (included from project Taskfiles)
task backend:local:start:dev    # Start backend dev server
task frontend:local:run         # Start frontend dev server

# Infrastructure tasks
task minikube:start             # Start local K8s cluster
task env:create -- {name}       # Create sandbox namespace
task env:destroy -- {name}      # Destroy sandbox namespace
```

## Best Practices

### Task Naming
- Use consistent prefixes (`local:`, `remote:`, etc.)
- Descriptive action names (`start`, `stop`, `build`, `deploy`, `test`)
- Hyphenated multi-word names (`build-and-deploy`, `type-check`)

### Documentation
- Always include `desc` for task description
- Use meaningful variable names
- Add comments for complex operations

### Dependencies
```yaml
tasks:
  local:build:
    desc: "Build the project"
    cmds:
      - npm run build

  local:test:
    desc: "Run tests (builds first)"
    deps:
      - local:build
    cmds:
      - npm test
```
