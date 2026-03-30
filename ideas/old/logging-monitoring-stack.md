# Logging, Monitoring & Metrics Stack

> **Purpose:** Self-hosted observability stack for logging, monitoring, and metrics
> **Status:** Planning
> **Last Updated:** 2025-01-08

---

## Overview

This document outlines a fully self-hosted observability solution that works identically in local development and AWS deployment. The stack provides:

- **Centralized Logging** - Structured logs from all services
- **Metrics Collection** - Performance data, resource usage, custom metrics
- **Distributed Tracing** - Request flow across services
- **Status Page** - Client-facing service status
- **Alerting** - Notifications for incidents and thresholds

---

## Stack Components

### The "Grafana LGTM Stack"

| Component | Purpose | Resource Usage | License |
|-----------|---------|----------------|---------|
| **Grafana** | Unified dashboards & alerting | Light | AGPL-3.0 |
| **Loki** | Log aggregation | Light-Medium | AGPL-3.0 |
| **Tempo** | Distributed tracing | Light | AGPL-3.0 |
| **Prometheus** | Metrics collection | Light-Medium | Apache-2.0 |
| **Uptime Kuma** | Status page for clients | Very Light | MIT |
| **OpenTelemetry Collector** | Telemetry pipeline | Light | Apache-2.0 |
| **PostgreSQL Exporter** | Database metrics | Very Light | Apache-2.0 |

All components are open source, Docker-ready, and self-hosted.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Services                            │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│   Backend    │   Frontend   │   Keycloak   │    Database       │
│   (NestJS)   │   (React)    │              │   (PostgreSQL)    │
└──────┬───────┴──────┬───────┴──────┬───────┴─────────┬─────────┘
       │              │              │                 │
       ▼              ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   OpenTelemetry Collector                       │
│            (receives logs, metrics, traces)                     │
└──────┬──────────────┬──────────────┬────────────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│   Loki   │   │Prometheus│   │  Tempo   │
│  (logs)  │   │(metrics) │   │ (traces) │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     └──────────────┼──────────────┘
                    ▼
             ┌──────────┐
             │ Grafana  │  ← Unified UI for everything
             └──────────┘

┌──────────────┐
│ Uptime Kuma  │  ← Simple status page for clients
└──────────────┘
```

---

## Component Details

### 1. Logging: Grafana Loki

**What it does:**
- Aggregates logs from all services
- Indexes by labels (service name, environment, level) not full text
- Query language (LogQL) similar to Prometheus

**Why Loki over ELK:**
- Much lighter resource footprint
- No complex index management
- Native Grafana integration
- Simpler operations

**Integration points:**
- Backend: Pino logger with Loki transport
- Frontend: Browser errors via API endpoint
- Keycloak: Native log output capture
- Docker: Loki Docker driver or promtail sidecar

### 2. Metrics: Prometheus

**What it does:**
- Scrapes `/metrics` endpoints from services
- Time-series database for metrics
- Built-in alerting rules
- Service discovery support

**Metrics to collect:**
- HTTP request duration (p50, p95, p99)
- Request count by endpoint and status
- Active connections (HTTP, WebSocket)
- CPU and memory usage
- Custom business metrics

**Integration points:**
- Backend: `@willsoto/nestjs-prometheus` package
- Database: `postgres_exporter` for PostgreSQL metrics
- Node: `prom-client` for Node.js runtime metrics
- Keycloak: Built-in Prometheus metrics endpoint

### 3. Tracing: Grafana Tempo

**What it does:**
- Stores distributed traces
- Links requests across service boundaries
- Identifies slow operations and bottlenecks

**Why Tempo over Jaeger:**
- Lower resource requirements
- Native Grafana integration
- Compatible with OpenTelemetry, Jaeger, and Zipkin formats

**Integration points:**
- OpenTelemetry SDK in NestJS
- Automatic instrumentation for HTTP, database queries
- Trace context propagation headers

### 4. Dashboards & Alerts: Grafana

**What it does:**
- Unified UI for logs, metrics, and traces
- Customizable dashboards
- Alerting with multiple notification channels
- Role-based access control

**Key dashboards to create:**
- Service Overview (all services health at a glance)
- Backend API Performance (latency, errors, throughput)
- Database Performance (connections, query times, slow queries)
- Infrastructure (CPU, memory, disk across services)

**Alert examples:**
- Error rate > 1% for 5 minutes
- P95 latency > 2 seconds
- Service down (no metrics for 2 minutes)
- Database connections > 80% of max
- Disk usage > 85%

**Client access:**
- Create viewer role for clients
- Share specific dashboards
- Optional: Anonymous access to read-only dashboards

### 5. Status Page: Uptime Kuma

**What it does:**
- Simple, beautiful public status page
- Monitors endpoints (HTTP, TCP, DNS, Docker)
- Incident management and history
- Maintenance window scheduling

**Why Uptime Kuma:**
- Single Docker container
- No dependencies
- Beautiful UI out of the box
- Public page requires no authentication

**Monitors to configure:**
- Frontend: HTTPS check on app URL
- Backend: HTTPS check on `/health` endpoint
- Keycloak: HTTPS check on `/health` endpoint
- Database: TCP check (via backend health that includes DB)

**Client experience:**
- Bookmark public status page URL
- See current status (operational/degraded/down)
- View incident history
- Subscribe to updates (email/webhook)

### 6. OpenTelemetry Collector

**What it does:**
- Receives telemetry data from all services
- Processes and batches data
- Routes to appropriate backends (Loki, Prometheus, Tempo)

**Why use a collector:**
- Decouples applications from backends
- Can switch backends without code changes
- Handles retries and buffering
- Reduces connections from applications

---

## Data Flow

### Logs Flow
```
Application → Pino Logger → OTLP/HTTP → OTel Collector → Loki → Grafana
```

### Metrics Flow
```
Application → /metrics endpoint ← Prometheus scrape → Grafana
```

### Traces Flow
```
Application → OTLP/gRPC → OTel Collector → Tempo → Grafana
```

### Health Checks Flow
```
Uptime Kuma → HTTP GET /health → Service → Response → Status Page
```

---

## Resource Requirements

### Local Development

Additional containers in docker-compose:

| Service | CPU | Memory |
|---------|-----|--------|
| Grafana | 0.25 | 256 MB |
| Loki | 0.25 | 256 MB |
| Prometheus | 0.25 | 256 MB |
| Tempo | 0.25 | 256 MB |
| OTel Collector | 0.1 | 128 MB |
| Uptime Kuma | 0.1 | 128 MB |
| **Total** | **~1.2** | **~1.3 GB** |

### AWS Deployment

**Option A: Sidecar to existing ECS cluster**
- Add observability services as additional ECS services
- Shared ALB with path-based routing
- Uses existing infrastructure

**Option B: Dedicated EC2 instance (Recommended)**
- Single `t3.small` instance (~$15/month)
- All observability containers via Docker Compose
- Isolated from application infrastructure
- Easier to manage and scale independently

**Storage requirements:**
- Loki: ~1GB per million log lines (compressed)
- Prometheus: ~1-2 bytes per sample
- Tempo: ~100 bytes per span

**Retention recommendations:**
- Logs: 30 days (configurable)
- Metrics: 15 days high-resolution, 1 year downsampled
- Traces: 7 days (traces are high volume)

---

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Create `projects/observability/`**
   - `docker-compose.yml` with Grafana, Loki, Prometheus, Tempo, OTel Collector
   - Configuration files for each service
   - Pre-built Grafana dashboards (provisioned)

2. **Create `projects/status-page/`**
   - `docker-compose.yml` with Uptime Kuma
   - Initial monitor configurations

3. **Update root `docker-compose.yml`**
   - Add observability services to local stack
   - Configure networking between services

### Phase 2: Backend Integration

1. **Add structured logging**
   - Install and configure Pino
   - Create logging module with OTLP transport
   - Replace console.log with structured logger

2. **Add metrics endpoint**
   - Install `@willsoto/nestjs-prometheus`
   - Create `/metrics` endpoint
   - Add custom metrics (request duration, active connections)

3. **Add tracing**
   - Install OpenTelemetry SDK
   - Configure auto-instrumentation
   - Add trace context to logs

### Phase 3: Database Monitoring

1. **Enable pg_stat_statements**
   - Add to PostgreSQL configuration
   - Track query performance

2. **Deploy postgres_exporter**
   - Add to observability stack
   - Configure Prometheus scraping

3. **Create database dashboard**
   - Connection pool metrics
   - Query performance
   - Slow query identification

### Phase 4: AWS Deployment

1. **Create `terraform/aws/modules/observability/`**
   - EC2 instance or ECS services
   - Security groups
   - ALB integration
   - EFS for persistent storage

2. **Update environment configuration**
   - Add observability endpoints to `.env.template`
   - Configure service discovery

3. **Deploy and configure**
   - Apply Terraform
   - Configure Uptime Kuma monitors for production URLs
   - Set up alerting channels

### Phase 5: Alerting & Polish

1. **Configure alert rules**
   - Error rate thresholds
   - Latency thresholds
   - Resource utilization

2. **Set up notification channels**
   - Email
   - Slack/Discord webhook
   - PagerDuty (optional)

3. **Create client-facing dashboards**
   - Simplified overview dashboard
   - Configure viewer access

---

## Local URLs (After Implementation)

| Service | URL | Purpose |
|---------|-----|---------|
| Grafana | http://localhost:3001 | Dashboards, logs, metrics, traces |
| Prometheus | http://localhost:9090 | Metrics UI (optional, use Grafana) |
| Uptime Kuma | http://localhost:3002 | Status page admin |
| Status Page | http://localhost:3002/status/main | Public status page |
| Loki | http://localhost:3100 | Log ingestion (internal) |
| Tempo | http://localhost:3200 | Trace ingestion (internal) |
| OTel Collector | http://localhost:4318 | OTLP HTTP receiver |

---

## AWS URLs (After Implementation)

| Service | URL | Purpose |
|---------|-----|---------|
| Grafana | https://monitoring.{DNS_POSTFIX}.rtsdev.co | Dashboards |
| Status Page | https://status.{DNS_POSTFIX}.rtsdev.co | Public status |

---

## Security Considerations

### Authentication
- Grafana: Local auth or integrate with Keycloak (OIDC)
- Uptime Kuma: Local auth for admin, public page unauthenticated
- Prometheus/Loki/Tempo: Internal only, no direct access

### Network Security
- Observability stack in private subnet (AWS)
- ALB handles SSL termination
- Internal services communicate over private network

### Data Security
- Logs may contain sensitive data - configure scrubbing
- Metrics are generally safe
- Traces may contain request/response data - be cautious

---

## Decisions Needed

Before implementation, decide on:

1. **Deployment model**: ECS services or dedicated EC2 instance?
2. **Client access level**: Status page only, or Grafana dashboards too?
3. **Alerting destinations**: Email, Slack, webhook, other?
4. **Log retention period**: 7, 30, or 90 days?
5. **Grafana authentication**: Local users or Keycloak OIDC?

---

## Alternatives Considered

### Logging Alternatives

| Solution | Pros | Cons | Decision |
|----------|------|------|----------|
| ELK Stack | Powerful search, mature | Heavy resources, complex | Too heavy |
| Graylog | Good UI, alerts | Java-based, moderate resources | Viable but heavier than Loki |
| **Loki** | Lightweight, Grafana native | Less powerful search | **Selected** |

### Metrics Alternatives

| Solution | Pros | Cons | Decision |
|----------|------|------|----------|
| InfluxDB | Good for time-series | Different query language | Prometheus more standard |
| VictoriaMetrics | Prometheus-compatible, efficient | Less ecosystem | Good alternative |
| **Prometheus** | Industry standard, huge ecosystem | Requires scraping | **Selected** |

### Tracing Alternatives

| Solution | Pros | Cons | Decision |
|----------|------|------|----------|
| Jaeger | CNCF project, mature | Heavier than Tempo | Viable |
| Zipkin | Simple, lightweight | Older, less features | Tempo better |
| **Tempo** | Lightweight, Grafana native | Newer | **Selected** |

### Status Page Alternatives

| Solution | Pros | Cons | Decision |
|----------|------|------|----------|
| Cachet | Feature-rich | PHP, more complex | Too complex |
| Statping | Good features | Less maintained | Uptime Kuma better |
| **Uptime Kuma** | Simple, beautiful, active | Fewer features | **Selected** |

---

## References

- [Grafana Documentation](https://grafana.com/docs/)
- [Grafana Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Uptime Kuma GitHub](https://github.com/louislam/uptime-kuma)
- [NestJS Prometheus Module](https://github.com/willsoto/nestjs-prometheus)
- [Pino Logger](https://getpino.io/)
