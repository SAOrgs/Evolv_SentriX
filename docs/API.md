# SentriX - API Documentation

The backend is built using FastAPI. The REST APIs act as the contract between the compound risk engine and the frontend visualizer.

## Contract Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/zones` | GET | Returns the 5 plant zones and their floorplan coordinates (0–1000 space). |
| `/api/permits` | GET | Returns currently active permits, including fire watch status. |
| `/api/risk-scores` | GET | Returns the current compound risk score (0-100) per zone. |
| `/api/risk-scores/history` | GET | Returns the time series of risk scores (accumulated across ticks). Optional filters: `zone_id`, `hours`. |
| `/api/alerts` | GET | Returns zones currently above the alert threshold (default 60), including the plain-English explanation, trigger signals, and RAG-retrieved regulatory citation. Optional filter: `threshold`. |
| `/api/lead-time` | GET | Returns the demo headline metric per zone: how many ticks/minutes earlier the compound score crossed the alert threshold compared to a single-sensor hard alarm. |
| `/api/simulate/advance` | POST | Advances the simulation by 1 tick and returns the enriched state (raw state + risk scores + alerts). |
| `/api/simulate/reset` | POST | Resets the simulation to tick 0. |
| `/api/emergency/trigger` | POST | Triggers the emergency response flow. Returns a drafted incident report, evacuation instructions, and mocked alert channels. Parameters: `zone_id`, optional `threshold`. |

## Error Handling
- All endpoints are wrapped in `try/except` and return empty structures (e.g., `[]`) on failure to prevent UI crashes.
- Global exception handlers manage unexpected JSON error responses.
- The emergency endpoint returns a `400 Bad Request` if the zone is below the emergency threshold, and `404 Not Found` if the zone ID is invalid.

## CORS Configuration
CORS is explicitly enabled for:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Create React App alternative)
