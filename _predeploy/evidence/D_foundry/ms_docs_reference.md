# Microsoft Documentation Reference - Captured 2025-12-26

## Azure AI Foundry Workflows

### Available Templates
| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Human in the loop** | Asks user a question and awaits input | Approval requests, user info |
| **Sequential** | Passes results from one agent to next | Pipelines, multi-stage |
| **Group chat** | Dynamic control between agents | Escalation, expert handoff |

### Node Types
- Agent: Invoke an agent
- Logic: if/else, go to, for each
- Data transformation: Set variables, parse values
- Basic chat: Send messages, ask questions

### Strict JSON Schema Output
- Configure in "Invoke agent" node → Details → Text format → JSON Schema
- Set `"strict": true` in schema
- Save output as variable via Action settings

## Azure AI Foundry Capability Hosts

### Required Resources (BYO Model)
| Property | Purpose | Resource |
|----------|---------|----------|
| `threadStorageConnections` | Agent definitions, chat threads | Cosmos DB |
| `vectorStoreConnections` | Vector storage, search | AI Search |
| `storageConnections` | File uploads, blobs | Storage Account |

### Hierarchy
1. Service defaults (Microsoft-managed)
2. Account-level capability host (shared defaults)
3. Project-level capability host (overrides account)

### CRITICAL: Updates Not Supported
- To modify: DELETE existing → RECREATE with new config
- All resources must be same region as VNet

## Azure AI Foundry Hosted Agents

### Status: PREVIEW (NOT GA)
- Billing postponed until Feb 1, 2026 or later
- NOT recommended for production use
- Only North Central US region supported
- Cannot use with private networking

### Production Risks
- Preview status with no GA commitment
- Limited replicas: 2-5 per deployment
- Identity reconfiguration required after publishing
- Data sovereignty concerns with non-Microsoft servers

### Recommended Alternatives for Production
1. Self-hosted containers (ACI/AKS)
2. Prompt-based agents in Foundry (no containerization)
3. Azure Functions + custom HTTP endpoints
4. OpenAI Assistants API directly
