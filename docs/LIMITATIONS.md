# SentriX - Limitations & Hackathon Scope

## Hackathon Scope (What We Built)
✅ Synthetic data generator (deterministic, reproducible)  
✅ Three domain agents (rule-based, no LLM, fast)  
✅ Orchestrator fusion (explicit synergy rules + Claude reasoning)  
✅ Regulatory RAG (21-doc corpus, Chroma, grounded citations)  
✅ FastAPI backend (all contract endpoints live)  
✅ Mocked emergency response (drafted incident reports)  
✅ Lead-time metric (compound vs single-sensor)  

## Out of Scope (Explicitly Not Built)
❌ CCTV / computer-vision (architecture-slide mention only)  
❌ Real SMS/PA/app notification integrations  
❌ Production database (SQLite/in-memory is used for the demo)  
❌ Real plant data validation (100% synthetic, labeled as such)  
❌ Multi-tenancy, authentication, role-based access control  
❌ Scalability tuning (optimized for 5 zones, 30 ticks, single-user demo)  

## Current Limitations
- **Rule Weights:** Rule weights and scoring multipliers are manually configured and hardcoded.
- **Synthetic Data:** Relies entirely on synthetic demonstration data, which lacks the noise and entropy of real-world sensors.
- **Mocked Workflows:** Emergency notification workflow is mocked.
- **Deployment:** Single-process deployment without persistent databases or message queues.
- **Integrations:** No live SCADA integration, CCTV pipelines, or enterprise IT integrations.
- **Corpus Size:** Regulatory corpus is currently limited to 21 documents for proof of concept.
