# SentriX – Design Decisions & Scalability

## 1. Design Philosophy

Traditional industrial safety systems evaluate gas sensors, permits, maintenance records, and worker information independently. SentriX is designed around a different philosophy: **correlating multiple weak safety signals to detect compound risks before any individual system raises a critical alarm.**

The architecture therefore prioritizes:
- Early warning over post-incident detection
- Explainability over black-box predictions
- Modular components over tightly coupled logic
- Offline resilience for unreliable industrial networks
- Production-friendly APIs and extensibility

---

## 2. Major Design Decisions

### 2.1 Agent-Based Architecture
**Decision:** Separate analysis into independent domain agents (Gas, Permit, Maintenance) and an Orchestrator.
**Why:** Each domain has different rules. Independent agents allow isolated testing and easier future additions (e.g., CCTV Agent, Weather Agent). A monolithic rule engine was rejected due to maintainability issues.

### 2.2 Compound Risk Fusion vs Independent Alerts
**Decision:** Generate alerts only after correlating multiple safety signals.
**Why:** Industrial accidents rarely occur because of a single factor. Correlating signals (e.g., rising gas + active hot-work) provides earlier detection. The "+25 synergy bonus" rule is the core differentiator, pushing scores above alert thresholds before any single sensor breaches its hard limit.

### 2.3 Rule-Based Risk Scoring
**Decision:** Use deterministic weighted scoring.
**Why:** Industrial environments require explainable decisions. Every increase in risk score can be traced back to specific safety conditions, making auditing easier. ML classification was rejected due to lack of labelled incident data and the need for high trust.

### 2.4 LLM for Explanation, Not Decision Making
**Decision:** LLMs generate explanations and emergency reports. Core risk scoring remains deterministic.
**Why:** Safety-critical decisions must remain predictable and reproducible. The LLM is used only for reasoning/explanation (2–3 sentences per alert), ensuring deterministic alerts without hallucination affecting safety logic.

### 2.5 Retrieval-Augmented Generation (RAG)
**Decision:** Ground regulatory explanations using retrieved industrial safety documents (Chroma vector store).
**Why:** Safety recommendations must reference actual regulations (OISD, Factory Act) rather than relying on LLM knowledge alone. It improves trust and reduces hallucinations.

### 2.6 Synthetic Data Simulator
**Decision:** Use a scripted plant simulator.
**Why:** Real industrial datasets are confidential. A generator provides reproducible demonstrations and controlled hazard progression to prove the lead-time value proposition.

### 2.7 Stateless Frontend & REST API
**Decision:** Keep business logic in the FastAPI backend; frontend only visualizes data.
**Why:** Separates visualization from analysis, simplifying maintenance and enabling multiple future client applications (mobile, SCADA adapters).

### 2.8 Mock Emergency Services
**Decision:** Emergency notifications and incident reporting are drafted but channels are mocked.
**Why:** Built within a hackathon scope without access to real SMS gateways or PA systems. The Claude-drafted incident report is the real capability demonstrated.

---

## 3. Trade-offs

- **Explainability vs Predictive Accuracy:** Prioritized explainability. ML may improve accuracy but reduces transparency.
- **Early Detection vs False Positives:** Intentionally generates alerts before traditional thresholds, which may increase precautionary alerts but buys valuable response time.
- **Deterministic Rules vs Adaptive Learning:** Rules require manual tuning but provide predictable behaviour for regulatory validation.
- **Local Processing vs Cloud:** Processing is local for lower latency and resilience against network disruptions. Cloud analytics would be needed for large-scale historical analysis.
- **In-Memory Storage vs Database:** Stores state in-memory for speed and simplicity during the hackathon. Production requires a persistent database.

---

## 4. Scalability

- **Horizontal Agent Scaling:** New domain agents can be added without modifying existing logic.
- **Plant Scale:** Complexity grows linearly with the number of zones. The architecture can support hundreds of zones.
- **Multi-Plant Deployment:** The backend can support multiple plants by maintaining separate plant contexts.
- **Distributed Deployment:** Services (Frontend, API Gateway, Risk Service, RAG Service) can be separated and scaled independently.
- **Streaming Data:** Can be upgraded to consume Kafka, MQTT, or OPC-UA instead of API polling.

---

## 5. Security & Compliance Notes

### Data Privacy
- **All data is synthetic** → no real plant data, no PII, no GDPR/CCPA concerns. Regulatory clauses are public-domain.

### API Security (Production TODO)
- Current prototype has no authentication. Production requires JWT/OAuth, rate limiting, and role-based access control.

### LLM Safety
- System prompts enforce paraphrasing without inventing citations. Fallback templates guarantee deterministic output if the LLM is unavailable.

### Regulatory Disclaimer
- **This is a demonstration platform, not a certified safety system.** Real deployment requires IEC 61508/61511 functional safety certification, HAZOP analysis, and regulatory approval.
