# Environment Configuration

Configuration patterns, environment management strategies, and secrets handling.

## Configuration Philosophy

This repo uses a layered configuration approach that promotes:

- **Security-first**: Sensitive data separated from code and version control
- **Environment-specific**: Different configurations for local, development, staging, and production
- **Developer-friendly**: Simple local setup with explicit configuration requirements
- **Infrastructure-aware**: Seamless integration between local and cloud environments
- **Fail-fast**: Missing configuration causes clear errors at startup, not silent failures

## Configuration Layers

The system employs a two-layer configuration strategy that simplifies management while maintaining security:

### Root Environment Layer (Single `.env` File)
A single `.env` file at the repository root contains:
- **Sensitive Configuration**: Credentials, API keys, and secrets that must not be version controlled
- **Terraform Outputs**: Infrastructure values generated from deployments that services need to reference
- **Project Identity**: Fundamental settings like project name, environment, and region

This single-file approach eliminates configuration fragmentation and provides one source of truth for all sensitive and infrastructure-generated values.

### Service Configuration Layer (Helm Values + Taskfile)
Each service's configuration is split between:
- **Helm chart values**: Non-sensitive config like ports, replica counts, resource limits
- **Helmfile environment overrides**: Per-environment values (dev, mac-mini, prod)
- **Taskfile `dotenv`**: Automatic `.env` loading for local development commands

This separation ensures that sensitive data never appears in version control while keeping service-specific configuration co-located with the deployment definition.

## Configuration Patterns

### Single Source of Truth
The root `.env` file serves as the single source of truth for:
- **Sensitive Data**: All credentials and secrets across all services
- **Infrastructure Values**: Outputs from Terraform deployments (database URLs, service endpoints, resource identifiers)
- **Cross-Service Configuration**: Values that multiple services need to share

### Service-Specific Configuration
Helm chart `values.yaml` files contain non-sensitive defaults for:
- **Deployment Configuration**: Ports, replica counts, resource limits, image references
- **Non-sensitive Defaults**: Feature flags, logging levels, health check paths
- **Environment Variable References**: Helmfile's `requiredEnv` pulls sensitive values from `.env` at deploy time

### Infrastructure Integration
Terraform deployments automatically update the root `.env` file with generated infrastructure values, ensuring services automatically receive updated endpoints, credentials, and resource identifiers without manual configuration updates.

## Security Patterns

### Secrets Management
**Local Development**: Root environment file contains all secrets, excluded from version control with strong, unique values for each environment.

**Production Environments**: Cloud-native secret management with automated rotation, access controls, and audit logging.

### Environment Isolation
Different environments maintain separate configurations, credentials, and resource naming to prevent accidental cross-environment access or data leakage.

## Configuration Integration Patterns

### Task Automation Integration
The task automation system automatically handles environment variable loading and makes configuration available to all operations, eliminating the need for manual environment management.

### Infrastructure Configuration Bridge
Environment variables seamlessly translate into infrastructure configuration, enabling consistent settings between local development and deployed environments.

### Service Configuration Inheritance
Services receive configuration through multiple channels - direct environment variables, configuration files, and inherited project settings - providing flexibility while maintaining consistency.

## No-Defaults Policy

**Critical Rule**: This codebase enforces a strict **no-defaults policy** for environment variables.

### Policy Statement

**NEVER provide default values for environment variables in application code.**

### Rationale

Default values for configuration variables hide configuration errors and can lead to:
- **Silent failures**: Applications running with incorrect configuration
- **Security risks**: Services connecting to wrong databases or using incorrect credentials
- **Hard-to-debug issues**: Problems that only manifest in specific environments
- **Configuration drift**: Different behavior between environments due to hidden defaults

### Implementation

**❌ INCORRECT - Never do this:**
```typescript
const host = process.env.DATABASE_HOST || "localhost";
const apiUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";
```

**✅ CORRECT - Always do this:**
```typescript
const host = process.env.DATABASE_HOST;
const apiUrl = import.meta.env.VITE_BACKEND_URL;

// Validate at startup
if (!host) {
  throw new Error('DATABASE_HOST must be set in .env file');
}
```

### Validation Strategy

All services implement startup validation that:
1. **Checks for required environment variables** before initializing
2. **Throws clear, actionable errors** listing missing variables
3. **References the .env.template** to guide developers
4. **Fails immediately** rather than proceeding with invalid configuration

### Example Validation

```typescript
// Validate required environment variables
const requiredEnvVars = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_USERNAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}. ` +
    'Please ensure all variables are set in your .env file using .env.template as reference.'
  );
}
```

### Benefits

This policy ensures:
- **Explicit configuration**: All required variables must be in `.env`
- **Early error detection**: Configuration errors found at startup, not runtime
- **Clear error messages**: Developers know exactly what's missing
- **Environment parity**: Same validation in all environments
- **Single source of truth**: All configuration comes from `.env`, no hidden fallbacks

## Best Practices

### Configuration Management
- **Separate Concerns**: Keep sensitive data separate from business configuration
- **Environment Parity**: Maintain similar configuration patterns across all environments
- **Validation First**: Validate configuration at service startup before proceeding
- **No Defaults**: Never provide default values for environment variables (see No-Defaults Policy above)
- **Explicit Configuration**: All required variables must be defined in `.env` file

### Security Considerations
- **Principle of Least Privilege**: Each service receives only necessary configuration
- **Rotation Strategy**: Plan for regular credential rotation in production environments
- **Audit Trail**: Maintain visibility into configuration changes and access patterns

For related standards:
- **Task Integration**: [Task Automation](task-automation.md)
- **Infrastructure**: See `infrastructure/.docs/`
