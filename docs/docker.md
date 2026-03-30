# Docker

Container patterns, orchestration strategies, and development workflows.

## Container Architecture Philosophy

The template uses a **service-oriented containerization approach** that treats all application components uniformly:

- **Service Uniformity**: All application services (backend, frontend, keycloak) run in Docker containers
- **Development-Production Parity**: Same containerization patterns work across all environments
- **Orchestration Simplicity**: Consistent service management regardless of underlying technology
- **Environment Integration**: Seamless integration with configuration and automation systems

### Services in Docker

All application services run in Docker containers both locally and in production:

- **Backend**: NestJS API service in Docker (local and ECS)
- **Frontend**: React application with nginx in Docker (local and ECS)
- **Keycloak**: Authentication service in Docker (local and ECS)
- **Database**: PostgreSQL in Docker (local only, RDS in production)

## Container Patterns

### Service Structure
Each service follows a consistent containerization pattern:
- **Application Source**: Service-specific business logic and dependencies
- **Container Definitions**: Environment-specific container configurations (development vs production)
- **Orchestration Configuration**: Service coordination and networking setup
- **Automation Integration**: Task-based lifecycle management

### Container Types

**Development Containers**:
- **Live Development**: Hot reload and file watching for rapid iteration
- **Debug Capabilities**: Extended tooling and debugging support
- **Volume Mounting**: Direct file system access for immediate feedback
- **Development Dependencies**: Additional tooling not needed in production

**Production Containers**:
- **Optimized Builds**: Multi-stage builds for minimal image size
- **Security Hardening**: Minimal attack surface with non-root users
- **Performance Focus**: Optimized for runtime efficiency
- **Health Monitoring**: Built-in health check capabilities

## Orchestration Patterns

### Service Orchestration
Services are coordinated through consistent orchestration patterns:
- **Unified Project Naming**: All services belong to the same logical project namespace
- **Network Integration**: Services communicate through well-defined network interfaces
- **Dependency Management**: Services declare and manage their dependencies explicitly
- **Environment Inheritance**: Consistent environment variable propagation across services

### Development Workflow Integration
Container orchestration supports efficient development workflows:
- **Incremental Startup**: Start core services first, add supporting services as needed
- **Live Reload**: File changes trigger appropriate container restart or hot reload
- **Resource Isolation**: Each service maintains its own resource allocation and configuration
- **State Persistence**: Important data persists across development sessions

## Development Patterns

### Live Development
Container-based development enables rapid iteration:
- **File System Mounting**: Source code changes are immediately available inside containers
- **Automatic Restart**: Services restart when code changes are detected
- **Development Tooling**: Containers include necessary development dependencies and debugging tools
- **Port Management**: Consistent port allocation prevents conflicts and enables predictable access

### Service Communication
Services communicate through well-defined patterns:
- **Network Isolation**: Services operate within isolated network environments
- **Service Discovery**: Services can locate and communicate with each other through consistent naming
- **Health Monitoring**: Services expose health endpoints for operational visibility
- **Dependency Coordination**: Services start in appropriate order based on dependencies

## Container Management

### Service Lifecycle
Container lifecycle follows consistent patterns:
- **Startup**: Services initialize with proper dependency ordering
- **Monitoring**: Health checks and log aggregation provide operational visibility
- **Updates**: Code and configuration changes trigger appropriate restart strategies
- **Shutdown**: Clean service termination with proper resource cleanup

### Resource Management
Efficient resource utilization through:
- **Selective Service Startup**: Only run services currently needed for development
- **Resource Isolation**: Each service manages its own memory, CPU, and storage requirements
- **Data Persistence**: Important data volumes persist across container restarts
- **Clean Shutdown**: Proper resource cleanup when services are stopped

## Best Practices

### Container Design
- **Single Responsibility**: Each container focuses on one service or capability
- **Environment Parity**: Same container patterns work across development and production
- **Security First**: Containers run with minimal privileges and secure defaults
- **Health Monitoring**: All services provide health check endpoints

### Development Workflow
- **Incremental Development**: Start with core services, add complexity as needed
- **State Management**: Preserve important data across development sessions
- **Network Consistency**: Use predictable networking patterns for service communication
- **Resource Efficiency**: Balance development convenience with system resource usage

For related container concepts:
- **Task Integration**: [Task Automation](../workflows/task-automation.md)
- **Environment Management**: [Environment Configuration](environment-configuration.md)
- **Development Workflows**: [Local Development](../workflows/local-development.md)
```bash
# Check application logs
task user-backend:local:logs

# Restart application with rebuild
task user-backend:local:restart

# Check module health individually
curl http://localhost:3000/health

# Debug database connectivity (from within application)
task user-backend:local:shell
# Inside container: check DATABASE_URL connection
```

### Port Conflicts
```bash
# Find what's using a port
lsof -i :3000  # or 8000, 8080 depending on framework

# Kill conflicting process
kill -9 $(lsof -t -i:3000)
```

### Module Integration Issues
```bash
# Verify all modules loaded correctly
curl http://localhost:3000/health | jq '.modules'

# Check module-specific endpoints
curl http://localhost:3000/api/auth/login   # From cognito-auth module
curl http://localhost:3000/api/users        # From user-management module

# Inspect auto-generated configuration
docker exec projects-user-backend env | grep -E "(DATABASE|COGNITO|S3)"
```

## Benefits of Simplified Container Architecture

### **Reduced Complexity**
- **Single application container** instead of multiple microservice containers
- **Fewer networking concerns** with direct database access from application
- **Simplified service discovery** with known support service addresses

### **Improved Development Experience**
- **Unified logging** from single application with all modules
- **Easier debugging** with all business logic in one container
- **Module hot reloading** for rapid development iteration

### **Operational Advantages**
- **Fewer containers to monitor** and manage
- **Simplified deployment** with single application backend
- **Reduced resource usage** compared to multiple microservice containers
- **Easier scaling** at the application level vs individual microservices

This Docker configuration provides a modern, efficient foundation for developing and deploying composed applications while maintaining the flexibility to scale and evolve the architecture as needed.

### Container Issues
```bash
# View container logs
docker logs projects-service-name

# Get shell access
task service-name:local:shell

# Rebuild containers
task service-name:local:restart
```

### Network Problems
```bash
# Inspect network
docker network inspect projects_app_network

# Recreate network
docker network rm projects_app_network
docker network create projects_app_network
```
