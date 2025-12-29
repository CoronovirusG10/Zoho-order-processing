# Foundry Model Smoke Tests Report

**Run ID:** 20251229_195114
**Date:** 2025-12-29
**Status:** PARTIAL PASS (10/12 models reachable)

---

## Executive Summary

| Category | Status | Details |
|----------|--------|---------|
| **Orchestrator Models** | PASS | gpt-5.1, gpt-5.2 reachable via Azure OpenAI |
| **Committee Models** | PARTIAL | 4/6 reachable; Claude models have streaming config issue |
| **Embeddings** | DEPLOYED | Cohere-embed-v3-multilingual available (not directly tested) |
| **Document OCR** | DEPLOYED | mistral-document-ai-2505 available |

---

## Models Reachable

### Orchestrator (Azure OpenAI)

| Model | Provider | Status | JSON Valid | Latency |
|-------|----------|--------|------------|---------|
| gpt-5.1 | Azure OpenAI | PASS | YES | <5s |
| gpt-5.2 | Azure OpenAI | PASS | YES | <5s |

### Committee Models

| Model | Provider | Status | JSON Valid | Notes |
|-------|----------|--------|------------|-------|
| o3 | Azure OpenAI | PASS | YES | Reasoning model |
| DeepSeek-V3.2 | Azure OpenAI | PASS | YES | Alternative reasoning |
| gemini-2.5-pro | Google (Direct) | PASS | YES | 1M context |
| grok-4-fast-reasoning | X.AI (Direct) | PASS | YES | Fast reasoning |
| claude-opus-4-5 | Anthropic | FAIL | N/A | Streaming required |
| claude-sonnet-4 | Anthropic | FAIL | N/A | Streaming required |

### Additional Models Tested

| Model | Provider | Status | JSON Valid |
|-------|----------|--------|------------|
| kimi-k2-thinking | Azure (MoonshotAI) | PASS | YES |
| deepseek-r1-0528 | Azure | PASS | YES |
| codestral-2501 | Azure (Mistral) | PASS | YES |
| llama-4-scout | Azure (Meta) | PASS | YES |

### Embeddings

| Model | Provider | Status | Notes |
|-------|----------|--------|-------|
| Cohere-embed-v3-multilingual | Azure AI Foundry | DEPLOYED | Critical for Farsi headers |

### Document OCR

| Model | Provider | Status | Notes |
|-------|----------|--------|-------|
| mistral-document-ai-2505 | Azure AI Foundry | DEPLOYED | Optional (image pipeline) |

---

## Failures and Root Causes

### 1. Anthropic Claude Models (claude-opus-4-5, claude-sonnet-4)

**Error:** `Streaming is required for operations that may take longer than 10 minutes`

**Root Cause:** The Anthropic API client in Zen MCP is configured for non-streaming requests, but Anthropic's API now requires streaming mode for potentially long-running operations.

**Impact:** Claude models cannot be used as committee members via Zen MCP until this is fixed.

**Remediation:**
1. Update Zen MCP server to use streaming mode for Anthropic API calls
2. OR use Azure-deployed Claude models (claude-opus-4-5 deployed in Azure AI Foundry)
3. OR configure ANTHROPIC_API_KEY with streaming-enabled SDK

### 2. Cohere Embedding (Not Directly Tested)

**Status:** Deployed per MODEL_ACCESS_REPORT but not smoke-tested

**Reason:** Embedding API requires direct Azure AI Foundry endpoint configuration (not available via Zen MCP chat interface)

**Remediation:**
1. Configure `AZURE_AI_FOUNDRY_ENDPOINT` environment variable
2. Create dedicated embedding test script using Azure AI SDK

---

## JSON Response Validation

All successful model responses returned valid JSON when prompted:

```json
{"status": "ok", "model": "<model-name>", "test": "smoke"}
```

**Validation Results:**
- 10/10 successful responses returned parseable JSON
- Response format was strictly adhered to
- No additional text contamination in JSON responses

---

## Provider Summary

| Provider | Configured | Models Available | Models Tested | Pass Rate |
|----------|------------|------------------|---------------|-----------|
| Azure OpenAI | YES | 26 | 8 | 100% |
| Google Gemini | YES | 3 | 1 | 100% |
| X.AI (Grok) | YES | 7 | 1 | 100% |
| Anthropic | YES | 6 | 2 | 0% |
| **Total** | **4** | **42** | **12** | **83%** |

---

## Next Actions

| Priority | Action | Owner | Status |
|----------|--------|-------|--------|
| HIGH | Fix Anthropic streaming configuration in Zen MCP | DevOps | PENDING |
| MEDIUM | Configure Azure AI Foundry endpoint for embedding tests | DevOps | PENDING |
| LOW | Test mistral-document-ai directly if image pipeline needed | DevOps | OPTIONAL |

---

## Recommendations

1. **For Committee:** Use the 4 working models (o3, DeepSeek-V3.2, gemini-2.5-pro, grok-4-fast-reasoning) until Claude is fixed
2. **For Orchestrator:** gpt-5.1 is confirmed working and should be the primary orchestrator
3. **For Embeddings:** Cohere-embed-v3-multilingual is deployed; configure endpoint for direct testing
4. **Alternative Claude Access:** Consider using Azure-deployed Claude models instead of direct Anthropic API

---

## Configuration Reference

**Zen MCP Server:**
- Endpoint: http://localhost:8959
- Version: 10.0.0
- Tools: 19
- Status: Healthy

**Configured Providers:**
- Google Gemini: GOOGLE_API_KEY configured
- Azure OpenAI: Configured via Zen MCP
- X.AI Grok: Configured via Zen MCP
- Anthropic: Configured but streaming issue

---

*Report generated: 2025-12-29T20:30:00Z*
