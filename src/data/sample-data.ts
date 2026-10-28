import { PresetBenchmark } from '../types/evaluator';

export const PRESET_BENCHMARKS: PresetBenchmark[] = [
  {
    id: 'preset-task-4',
    title: 'Task 4/48: JWT Auth & Session Expiration',
    category: 'Backend',
    currentTaskNumber: 4,
    attemptNumber: 1,
    internName: 'Alex Rivera',
    internEmail: 'venkatesan8121972@gmail.com',
    taskName: 'Task #4: Secure JWT Authentication Service',
    expectedStatus: 'NEEDS_REVISION',
    notes: 'Missing token expiration handling and rate limiting on /login.',
    benchmarkRequirements: `1. BENCHMARK REQUIREMENTS
- Implement POST /api/auth/register with bcrypt password hashing (min 10 salt rounds)
- Implement POST /api/auth/login returning a signed JWT access token and refresh token
- Implement token expiration: Access token (15 min) and Refresh token (7 days) with HTTP-only cookie storage
- Enforce IP-based rate limiting on /api/auth/login (max 5 failed attempts per 15 min window)
- Protect /api/users/profile route using an auth middleware verifying JWT signature
- Provide automated unit/integration tests with >80% code coverage`,
    internSubmission: `2. INTERN SUBMISSION
Repository: github.com/alexrivera/auth-service-submission
PR: #3 "Feature: Authentication endpoints"

Hey team! I finished the authentication task. Here is what I implemented:
1. Created POST /api/auth/register: Passwords are encrypted using bcrypt with salt rounds of 10.
2. Created POST /api/auth/login: Generates a JWT using jwt.sign({ id: user.id }, process.env.JWT_SECRET). Currently returning the token in the JSON body.
3. Protected /api/users/profile with authMiddleware that extracts the Bearer token from headers and calls jwt.verify().
4. Test suite: Added 6 Jest tests covering registration and successful login. Coverage report shows 84% statement coverage.

Notes:
- I haven't added the refresh token or token expiration yet because I wanted to check if 15 minutes is too short for local testing.
- Rate limiting is not yet added to the login route; I will look into express-rate-limit next sprint.`,
  },
  {
    id: 'preset-task-12',
    title: 'Task 12/48: React 19 Accessible Design System',
    category: 'Frontend',
    currentTaskNumber: 12,
    attemptNumber: 2,
    internName: 'Maya Lin',
    internEmail: 'maya.lin@internship-program.org',
    taskName: 'Task #12: Accessible Component Library & Dark Mode',
    expectedStatus: 'PASSED',
    notes: 'Exemplary submission exceeding all benchmark criteria with 100% WCAG AA compliance. Ready to advance to Task 13.',
    benchmarkRequirements: `1. BENCHMARK REQUIREMENTS
- Build reusable Button, Modal Dialog, and Combobox components in React with Tailwind CSS
- Full keyboard navigation support (Tab order, Escape to close modal, Arrow keys in combobox)
- Strict WCAG 2.1 AA accessibility compliance (aria-expanded, aria-controls, focus trap on open modal)
- Theme toggle supporting Light, Dark, and System preference with zero layout shift
- Document each component with props table and interactive playground in Storybook
- Write automated accessibility tests using axe-core and Vitest with zero violations`,
    internSubmission: `2. INTERN SUBMISSION
Repository: github.com/mayalin/design-system-core
PR: #12 "Production: Core Accessible Components and Theme Engine"

Implemented deliverables:
1. Components:
   - Button with variants (primary, secondary, destructive, ghost, outline) and loading spinner state.
   - Modal Dialog with native <dialog> wrapper, automated focus-trap, and backdrop blur.
   - Combobox with virtualized option list, multi-select, and full keyboard navigation (Up/Down arrow traversal, Enter to select, Esc to dismiss).
2. Accessibility (a11y):
   - Integrated @axe-core/react in test pipeline. Zero violations across all states.
   - Added appropriate aria-* attributes: aria-expanded, aria-activedescendant, aria-modal="true", role="combobox".
3. Theming:
   - Built custom useTheme hook persisting user selection to localStorage and listening to prefers-color-scheme media query. Zero flash of unstyled theme on load.
4. Documentation & Tests:
   - Storybook deployed with interactive controls and autodocs.
   - 18 Vitest unit tests and axe accessibility regression tests passing in CI.`,
  },
  {
    id: 'preset-task-24',
    title: 'Task 24/48: Dockerized Kafka & FastAPI Ingestion',
    category: 'Data',
    currentTaskNumber: 24,
    attemptNumber: 1,
    internName: 'David Zhang',
    internEmail: 'david.zhang@internship-program.org',
    taskName: 'Task #24: Streaming Data Ingestion & Docker Infrastructure',
    expectedStatus: 'NEEDS_REVISION',
    notes: 'Missing dead-letter queue (DLQ) and container healthchecks.',
    benchmarkRequirements: `1. BENCHMARK REQUIREMENTS
- Implement FastAPI ingestion endpoint accepting batches of up to 500 JSON telemetry events
- Validate event payloads against Pydantic schema with strict type coercion and error reporting
- Produce validated events to Kafka topic 'telemetry-stream' with partitioning by device_id
- Implement Dead Letter Queue (DLQ) topic 'telemetry-dlq' for malformed or unprocessable payloads
- Containerize application with multi-stage Dockerfile and docker-compose.yml including Zookeeper & Kafka
- Add Docker healthchecks for web service and Kafka broker before traffic ingestion begins`,
    internSubmission: `2. INTERN SUBMISSION
Repository: github.com/davidzhang/telemetry-pipeline
PR: #8 "Data Ingestion Pipeline v1"

Summary of progress:
- FastAPI app initialized with POST /api/v1/telemetry/batch. It accepts up to 500 events in a single payload.
- TelemetryPayload schema defined with Pydantic v2 (device_id: UUID, timestamp: datetime, metrics: dict).
- Kafka producer using aiokafka sends valid events to 'telemetry-stream' using device_id.bytes as partition key.
- Multi-stage Dockerfile created with python:3.12-slim base image reducing image size to 142MB.
- docker-compose.yml runs FastAPI, Kafka, and Zookeeper services.

Known gaps:
- Dead Letter Queue (DLQ): If schema validation fails, the endpoint currently returns HTTP 422 with validation errors instead of routing to a DLQ topic.
- Healthcheck commands are missing from docker-compose.yml service definitions.`,
  },
  {
    id: 'preset-task-48',
    title: 'Task 48/48 (Final): Production Kubernetes & Multi-Region Capstone',
    category: 'DevOps',
    currentTaskNumber: 48,
    attemptNumber: 1,
    internName: 'Elena Rostova',
    internEmail: 'elena.rostova@internship-program.org',
    taskName: 'Task #48: Multi-Region Kubernetes & Production Capstone Release',
    expectedStatus: 'PASSED',
    notes: 'Final capstone milestone! Triggers GENERATE_COMPLETION_CERTIFICATE and INTERNSHIP_COMPLETED.',
    benchmarkRequirements: `1. BENCHMARK REQUIREMENTS
- Deploy multi-region Kubernetes cluster with automated geo-DNS failover across US and EU
- Implement zero-downtime blue-green deployment pipeline with ArgoCD and automated rollback on 5xx spike
- Enforce mTLS encryption between all microservices using Istio Service Mesh
- Configure Prometheus and Grafana dashboards tracking p99 latency (<20ms SLA) and error budgets
- Execute automated chaos engineering tests (pod termination, network latency injection) with zero dropped sessions`,
    internSubmission: `2. INTERN SUBMISSION
Repository: github.com/elenarostova/capstone-k8s-platform
PR: #48 "Production Release: Multi-region Kubernetes & Chaos Hardening"

Completed final capstone deliverables:
1. Multi-region cluster live in us-east1 and europe-west1 with Cloudflare geo-DNS routing.
2. ArgoCD blue-green canary rollout pipeline verified with automated rollback triggers.
3. Istio service mesh configured with STRICT mTLS enabled across all namespaces.
4. Prometheus & Grafana alerting live with p99 latency benchmarked at 14.8ms.
5. Executed Chaos Mesh tests simulating 30% node failure; zero dropped customer connections observed.`,
  },
];
