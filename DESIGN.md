# SentriX – Design Decisions, Trade-offs & Scalability

## 1. Design Philosophy

Traditional industrial safety systems evaluate gas sensors, permits, maintenance records, and worker information independently. SentriX is designed around a different philosophy: **correlating multiple weak safety signals to detect compound risks before any individual system raises a critical alarm.**

The architecture therefore prioritizes:

- Early warning over post-incident detection
- Explainability over black-box predictions
- Modular components over tightly coupled logic
- Offline resilience for unreliable industrial networks
- Production-friendly APIs and extensibility

---

# 2. Major Design Decisions

## 2.1 Agent-Based Architecture

### Decision

Separate the analysis into independent domain agents:

- Gas Agent
- Permit Agent
- Maintenance & Shift Agent

An Orchestrator combines their outputs.

### Why?

Each safety domain has different rules, thresholds, and reasoning.

Keeping them independent allows:
- isolated testing
- independent improvements
- easier maintenance
- future addition of new agents

Examples:
- CCTV Agent
- Weather Agent
- PPE Compliance Agent
- IoT Equipment Health Agent

### Alternative Considered

A single monolithic rule engine.

### Why Rejected

A monolithic system quickly becomes difficult to maintain as safety rules increase.

Every new rule would affect unrelated logic and increase complexity.

---

## 2.2 Compound Risk Fusion instead of Independent Alerts

### Decision

Generate alerts only after correlating multiple safety signals.

### Why?

Industrial accidents rarely occur because of a single factor.

Instead they result from combinations such as:
- rising gas
- active hot-work
- missing fire watch
- overdue maintenance

Correlating these signals provides earlier detection than independent threshold alarms.

### Alternative Considered

Alert directly from every sensor.

### Why Rejected

Produces excessive false alarms and misses dangerous combinations.

---

## 2.3 Rule-Based Risk Scoring

### Decision

Use deterministic weighted scoring.

### Why?

Industrial environments require explainable decisions.

Every increase in risk score can be traced back to specific safety conditions.

This makes auditing significantly easier.

### Alternative Considered

Machine Learning classification.

### Why Rejected

The project does not have sufficient labelled industrial incident data.

Black-box predictions are difficult for safety officers to trust.

Rule-based scoring also performs consistently during demonstrations.

---

## 2.4 LLM for Explanation, Not Decision Making

### Decision

LLMs generate explanations and emergency reports.

Core risk scoring remains deterministic.

### Why?

Safety-critical decisions should remain predictable and reproducible.

The LLM improves readability without controlling safety logic.

### Benefits

- deterministic alerts
- explainable outputs
- no hallucination affecting decisions

---

## 2.5 Retrieval-Augmented Generation (RAG)

### Decision

Ground regulatory explanations using retrieved industrial safety documents.

### Why?

Safety recommendations should reference actual regulations rather than relying only on LLM knowledge.

The retrieval layer improves trust and reduces hallucinations.

---

## 2.6 Synthetic Data Simulator

### Decision

Use a scripted plant simulator.

### Why?

Real industrial datasets are confidential.

The simulator provides:
- reproducible demonstrations
- controlled hazard progression
- measurable early-warning lead time

---

## 2.7 REST API Based Backend

### Decision

Expose all functionality using FastAPI.

### Why?

REST APIs allow easy integration with:
- dashboards
- SCADA adapters
- mobile applications
- enterprise software

---

## 2.8 Stateless Frontend

### Decision

Keep business logic entirely inside the backend.

The frontend only visualizes data.

### Why?

Separating visualization from analysis simplifies maintenance and enables multiple client applications.

---

# 3. Trade-offs

## Explainability vs Predictive Accuracy

We prioritized explainability.

Machine learning may improve prediction accuracy but would significantly reduce transparency.

For industrial safety, explainable decisions are often preferred.

---

## Early Detection vs False Positives

The system intentionally generates alerts before traditional thresholds.

This may slightly increase precautionary alerts but provides valuable response time.

---

## Deterministic Rules vs Adaptive Learning

Rule-based systems require manual tuning.

However they provide predictable behaviour and easier regulatory validation.

Future versions can incorporate adaptive learning while keeping rule-based safeguards.

---

## Local Processing vs Cloud Processing

Current prototype performs processing locally.

Advantages:
- lower latency
- works during network disruptions
- reduced bandwidth usage

Trade-off:
Cloud analytics can provide larger-scale historical analysis.

---

## In-Memory Storage vs Database

Current implementation stores simulation state in memory.

Advantages:
- simpler architecture
- faster development
- sufficient for hackathon demonstration

Trade-off:
Production systems should use persistent databases.

---

## Mock Emergency Services

Emergency notifications are currently simulated.

Advantages:
- safe demonstrations
- no dependency on external services

Trade-off:
Production deployment would integrate with:
- SMS gateways
- Email
- PA systems
- SCADA alarms
- Incident management platforms

---

# 4. Scalability

## Horizontal Agent Scaling

Each domain agent operates independently.

Future agents can be added without modifying existing logic.

Example:

Gas Agent
↓

Permit Agent
↓

Maintenance Agent
↓

Weather Agent

↓

CCTV Agent

↓

Equipment Health Agent

↓

Orchestrator

---

## Plant Scale

The simulator currently models five zones.

The architecture can support hundreds of zones because every zone is evaluated independently before orchestration.

Processing complexity grows approximately linearly with the number of zones.

---

## Multi-Plant Deployment

The backend can support multiple plants by maintaining separate plant contexts.

Example:

Plant A

Plant B

Plant C

Each plant maintains its own:
- sensors
- permits
- maintenance records
- risk history

---

## Distributed Deployment

Future deployments can separate services:

Frontend

↓

API Gateway

↓

Risk Service

↓

RAG Service

↓

Emergency Service

↓

Database

↓

Notification Service

Each service can scale independently.

---

## Streaming Data

Instead of polling APIs, future deployments can consume:
- Kafka
- MQTT
- OPC-UA
- Azure IoT Hub
- Industrial IoT gateways

This enables real-time processing of industrial telemetry.

---

## Historical Analytics

Persistent storage enables:
- incident trends
- predictive maintenance
- recurring hotspot detection
- audit reports
- compliance dashboards

---

## Enterprise Integration

The modular REST architecture allows integration with:
- SCADA systems
- Industrial IoT platforms
- SAP PM
- IBM Maximo
- ServiceNow
- Existing Permit-to-Work systems
- Enterprise monitoring and alerting platforms

---

# 5. Security Considerations

Although simplified for demonstration, production deployment should include:
- Authentication
- Role-based access control
- HTTPS
- Audit logging
- API rate limiting
- Secure secret management
- Encrypted regulatory document storage

---

# 6. Current Limitations

- Rule weights are manually configured.
- Uses synthetic demonstration data.
- Emergency notification workflow is mocked.
- Single-process deployment.
- No persistent database.
- No live SCADA integration.
- No CCTV or computer vision pipeline.
- Regulatory corpus is limited.

---

# 7. Future Improvements

- Reinforcement learning for adaptive risk scoring.
- Time-series forecasting of hazardous conditions.
- Live IoT sensor integration.
- Digital twin simulation.
- Multi-language emergency reports.
- Computer vision for PPE compliance.
- Drone-assisted hazard inspection.
- Automatic incident ticket generation.
- Edge deployment on industrial edge computing platforms.
- Multi-plant centralized monitoring.

---

# 8. Summary

SentriX is designed as a modular, explainable, and extensible industrial safety platform. Instead of relying on isolated sensor thresholds, it correlates multiple operational signals to detect compound risks earlier, provides grounded regulatory explanations, and exposes a scalable architecture that can evolve from a hackathon prototype into an enterprise-grade industrial safety solution.
