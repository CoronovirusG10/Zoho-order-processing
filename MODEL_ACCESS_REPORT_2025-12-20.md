# Azure AI Foundry - Complete Model Access Report

**Generated**: 2025-12-20
**Data Source**: Azure AI Foundry API + Direct Provider APIs
**Subscription**: Azure subscription 1 (5bc1c173-058c-4d81-bed4-5610679d339f)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Deployments](#current-deployments)
3. [Azure AI Foundry Catalog (150 Models)](#azure-ai-foundry-catalog)
4. [Direct API Access - Full Provider Catalogs](#direct-api-access)
5. [Quota Increase Recommendations](#quota-increase-recommendations)
6. [Additional Provider Opportunities](#additional-provider-opportunities)

---

## Executive Summary

### Total Model Access

| Source | Models Available | Status |
|--------|------------------|--------|
| **Azure AI Foundry** | 150 | Deployed via Azure |
| **Google Gemini (Direct API)** | Full catalog | Direct API key |
| **Anthropic (Direct API)** | Full catalog | Direct API key |
| **xAI Grok (Direct API)** | Full catalog | Direct API key |
| **Potential: AWS Bedrock** | 100+ | Not deployed |

**Total Accessible Models**: 150+ Azure Foundry + Full Gemini + Full Anthropic + Full xAI catalogs

### Current Deployment Stats

| Metric | Value |
|--------|-------|
| Azure AI Foundry Resources | 8 |
| Active Deployments | 53 (2 failed) |
| Batch Deployments | 1 (gpt-4.1-mini-batch) |
| Regions Active | 4 |

---

## Current Deployments

### By Provider (Azure AI Foundry)

| Provider | Deployments | Total Capacity | Key Models |
|----------|-------------|----------------|------------|
| OpenAI | 38 | ~75,000+ | GPT-5.x, o3, Sora, DALL-E |
| Anthropic | 5 | 5,571 | Claude Opus/Sonnet/Haiku 4.x |
| DeepSeek | 5 | 8,550 | V3.x, R1 reasoning |
| xAI | 3 | 2,914 | Grok-3, Grok-4-reasoning |
| Mistral AI | 2 | 304 | Document AI, Codestral |
| Meta | 1 | 1,000 | Llama-4-Maverick |
| Microsoft | 1 | 1 | Phi-4-reasoning |
| Cohere | 1 | 1 | Embed-v3-multilingual |
| MoonshotAI | 1 | 500 | Kimi-K2-Thinking |
| Black Forest Labs | 2 | 100 | FLUX.2-pro, FLUX.1-Kontext |

### Top Deployed Models by Capacity

| Deployment | Model | Capacity | Use Case |
|------------|-------|----------|----------|
| computer-use-preview | computer-use-preview | 20,000 | Computer interaction |
| gpt-4.1-mini | gpt-4.1-mini | 10,000 | Fast, cost-effective |
| gpt-5.1 | gpt-5.1 | 5,177 | Flagship reasoning |
| gpt-5.2 | gpt-5.2 | 5,000 | Latest flagship |
| gpt-5.1-codex | gpt-5.1-codex | 5,000 | Code generation |
| gpt-5-chat | gpt-5-chat | 3,524 | Conversational |
| DeepSeek-V3.2 | DeepSeek-V3.2 | 3,173 | Alternative reasoning |
| gpt-5.1-chat | gpt-5.1-chat | 2,912 | Conversational |

### Regional Distribution

| Region | Resources | Deployments | Notes |
|--------|-----------|-------------|-------|
| Sweden Central | 4 | 51 | Primary hub |
| East US 2 | 2 | 3 | Secondary |
| Norway East | 1 | 1 | o3-deep-research only |
| UK West | 1 | 0 | Empty |

---

## Azure AI Foundry Catalog

**Total Models Available**: 150
**All Support Free Playground**: Yes

### OpenAI Models (55)

| Category | Models | Deployed? |
|----------|--------|-----------|
| **GPT-5 Series** | gpt-5, gpt-5-chat, gpt-5-codex, gpt-5-mini, gpt-5-nano, gpt-5-pro | Partial |
| **GPT-5.1 Series** | gpt-5.1, gpt-5.1-chat, gpt-5.1-codex, gpt-5.1-codex-max, gpt-5.1-codex-mini | **All deployed** |
| **GPT-5.2 Series** | gpt-5.2, gpt-5.2-chat | **All deployed** |
| **O-Series Reasoning** | o1, o1-mini, o1-preview, o3, o3-mini, o3-pro, o3-deep-research, o4-mini | Partial |
| **GPT-4 Series** | gpt-4, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4.5-preview, gpt-4o, gpt-4o-mini + audio/realtime variants | Partial |
| **Legacy** | gpt-35-turbo variants, davinci-002 | No |
| **Image** | dall-e-3, gpt-image-1, gpt-image-1.5 | **All deployed** |
| **Video** | sora, sora-2 | **All deployed** |
| **Audio** | whisper, tts, tts-hd, gpt-audio, gpt-realtime variants | Partial |
| **Specialty** | computer-use-preview, model-router, codex-mini, gpt-oss-* | Partial |

### Anthropic Models (4 in Azure)

| Model | Deployed? | Notes |
|-------|-----------|-------|
| claude-opus-4-5 | **Yes** | Latest Opus (v20251101) |
| claude-opus-4-1 | **Yes** | Previous Opus |
| claude-sonnet-4-5 | **Yes** | Balanced |
| claude-haiku-4-5 | **Yes** | Fast, efficient |

**Note**: Only Claude 4.x series in Azure. Full Anthropic catalog (including Claude 3.x, 3.5) available via Direct API.

### DeepSeek Models (7)

| Model | Deployed? | Notes |
|-------|-----------|-------|
| DeepSeek-V3.2-Speciale | **Yes** | Latest specialized |
| DeepSeek-V3.2 | **Yes** | V3.2 base |
| DeepSeek-V3.1 | **Yes** | V3.1 |
| DeepSeek-V3 | No | Base V3 |
| DeepSeek-V3-0324 | No | March version |
| DeepSeek-R1 | No | Reasoning base |
| DeepSeek-R1-0528 | **Yes** | Reasoning |

### xAI Grok Models (6 in Azure)

| Model | Deployed? | Notes |
|-------|-----------|-------|
| grok-4 | No | Latest flagship |
| grok-4-fast-reasoning | **Yes** | Fast reasoning |
| grok-4-fast-non-reasoning | No | Fast non-reasoning |
| grok-3 | **Yes** | Grok 3 |
| grok-3-mini | **Yes** | Smaller Grok 3 |
| grok-code-fast-1 | No | Code specialized |

**Note**: Additional Grok models (grok-4.1, grok-vision) available via Direct xAI API.

### Meta Llama Models (4)

| Model | Deployed? |
|-------|-----------|
| Llama-4-Maverick-17B-128E-Instruct-FP8 | **Yes** |
| Llama-4-Scout-17B-16E-Instruct | No |
| Llama-4-Scout-17B-16E | No |
| Llama-3.3-70B-Instruct | No |

### Mistral AI Models (7)

| Model | Deployed? |
|-------|-----------|
| Mistral-Large-3 | No |
| mistral-document-ai-2505 | **Yes** |
| mistral-medium-2505 | No |
| mistral-small-2503 | No |
| mistral-ocr-2503 | No |
| Ministral-3B | No |
| Codestral-2501 | **Yes** |

### Microsoft Models (17)

| Model | Deployed? | Notes |
|-------|-----------|-------|
| Phi-4-reasoning | **Yes** | Reasoning SLM |
| Phi-4 | No | Base Phi-4 |
| Phi-4-mini-* | No | Mini variants |
| Phi-4-multimodal-instruct | No | Multimodal |
| model-router | **Yes** | Model routing |
| Azure-Content-Understanding-* | No | Document AI |
| EvoDiff, MatterGen, MedImageParse | No | Scientific |

### Cohere Models (10)

| Model | Deployed? |
|-------|-----------|
| Cohere-embed-v3-multilingual | **Yes** |
| embed-v-4-0 | No |
| cohere-command-a | No |
| Cohere-command-r-* | No |
| Cohere-rerank-* (5 variants) | No |

### Other Publishers

| Publisher | Models | Deployed? |
|-----------|--------|-----------|
| Black Forest Labs | FLUX.2-pro, Flux.1-Kontext-pro, Flux-1.1-Pro | 2 of 3 |
| Stability AI | Stable-Diffusion-3.5-Large, Stable-Image-Ultra/Core | No |
| AI21 Labs | AI21-Jamba-1.5-Large/Mini | No |
| Nvidia | Nemotron NIM microservices | No |
| MoonshotAI | Kimi-K2-Thinking | **Yes** |
| Paige | Virchow, Virchow2, Prism (pathology) | No |
| Hugging Face | 22 models (Qwen, embeddings, etc.) | No |
| Others | Bria, Gretel, NTT Data, Snowflake | No |

---

## Direct API Access

### Full Provider Catalogs Available

Beyond Azure AI Foundry, the Zen MCP server provides direct API access to complete model catalogs:

### Google Gemini (Direct API)

**Status**: Full catalog access via Google AI API

| Model Family | Models | Context | Notes |
|--------------|--------|---------|-------|
| **Gemini 3** | gemini-3-pro-preview | 1M | Latest flagship |
| **Gemini 2.5** | gemini-2.5-pro, gemini-2.5-flash | 1M | Production models |
| **Gemini 2.0** | gemini-2.0-flash-exp, gemini-2.0-flash-thinking | 1M | Experimental |
| **Gemini 1.5** | gemini-1.5-pro, gemini-1.5-flash | 2M | Long context |
| **Imagen** | imagen-3 | - | Image generation |
| **Veo** | veo-2 | - | Video generation |

**Not in Azure**: Gemini models are NOT available in Azure AI Foundry. Access via direct Google API only.

### Anthropic (Direct API)

**Status**: Full catalog access via Anthropic API

| Model | Context | Available In |
|-------|---------|--------------|
| claude-opus-4-5 | 200K | Azure + Direct |
| claude-opus-4-1 | 200K | Azure + Direct |
| claude-sonnet-4-5 | 200K | Azure + Direct |
| claude-haiku-4-5 | 200K | Azure + Direct |
| claude-3-opus | 200K | **Direct only** |
| claude-3-sonnet | 200K | **Direct only** |
| claude-3-haiku | 200K | **Direct only** |
| claude-3.5-sonnet | 200K | **Direct only** |
| claude-3.5-haiku | 200K | **Direct only** |

**Recommendation**: Claude 3.x models not in Azure but available via direct Anthropic API if needed.

### xAI Grok (Direct API)

**Status**: Full catalog access via xAI API

| Model | Available In | Notes |
|-------|--------------|-------|
| grok-3, grok-3-mini | Azure + Direct | Deployed |
| grok-4-fast-reasoning | Azure + Direct | Deployed |
| grok-4 | Azure (not deployed) + Direct | Can deploy |
| grok-4.1 | **Direct only** | Latest |
| grok-code | **Direct only** | Code specialized |
| grok-vision | **Direct only** | Vision capable |

**Recommendation**: Deploy grok-4 and grok-code-fast-1 in Azure for better integration.

---

## Quota Increase Recommendations

Based on current usage and available capacity:

### High Priority - Request Increases

| Model | Current Quota | Recommended | Reason |
|-------|---------------|-------------|--------|
| **gpt-5.1** | 5,177 | 10,000+ | Flagship model, high demand |
| **gpt-5.2** | 5,000 | 10,000+ | Newest model, growing usage |
| **claude-opus-4-5** | 1,912 | 5,000+ | Limited Anthropic capacity |
| **o3** | 1,000 | 5,000 | Reasoning workloads constrained |
| **o3-pro** | 1,006 | 3,000 | Professional reasoning limited |
| **gpt-5-pro** | 567 | 2,000 | Extended output model under-provisioned |

### Batch Processing - Underutilized

| Model | Batch Quota | Current Use | Action |
|-------|-------------|-------------|--------|
| gpt-4o-mini | 3M tokens | 0 | Deploy batch endpoint |
| gpt-35-turbo | 3M tokens | 0 | Deploy batch endpoint |
| o3-mini | 3M tokens | 0 | Deploy for reasoning batches |
| gpt-5 | 600K tokens | 0 | Deploy batch endpoint |
| o3 | 300K tokens | 0 | Deploy batch endpoint |

**Current batch deployment**: Only gpt-4.1-mini-batch using 1M of 3M quota.

### Models to Deploy

| Model | Priority | Reason |
|-------|----------|--------|
| gpt-4o-mini | High | Cost-effective, high quota |
| o1-mini | High | Cheaper reasoning option |
| grok-4 | Medium | Latest Grok flagship |
| grok-code-fast-1 | Medium | Code specialization |
| Mistral-Large-3 | Medium | Alternative flagship |
| Llama-3.3-70B-Instruct | Low | Open-weight alternative |

---

## Additional Provider Opportunities

### AWS Bedrock

**Status**: Not currently deployed
**Potential Benefits**:

| Feature | Benefit |
|---------|---------|
| **Amazon Titan** | Native AWS models, tight integration |
| **Anthropic Claude** | Alternative Claude access, different quotas |
| **Meta Llama** | Full Llama 3.x catalog (not in Azure) |
| **Cohere Command** | Alternative to Azure Cohere |
| **Stability AI** | SDXL and newer models |
| **AI21 Jurassic** | Additional language models |
| **Mistral** | Alternative Mistral access |

**Recommendation**: Consider Bedrock for:
1. **Llama 3.1/3.2 access** - Not available in Azure Foundry
2. **Redundancy** - Alternative Claude/Mistral access
3. **Cost optimization** - Compare pricing across providers

### Google Vertex AI

**Status**: Direct Gemini API active
**Additional Options**:

| Feature | Benefit |
|---------|---------|
| **Gemini Enterprise** | Higher rate limits |
| **PaLM 2** | Legacy but stable |
| **Codey** | Code-specific models |
| **Imagen 3** | Advanced image generation |
| **Chirp** | Speech models |

### Other Providers to Consider

| Provider | Models | Benefit |
|----------|--------|---------|
| **Perplexity** | pplx-sonar | Real-time search augmented |
| **Together AI** | Open models | Cost-effective open-source |
| **Fireworks** | Optimized inference | Fast open model serving |
| **Replicate** | Specialized models | Image/video generation |

---

## Summary: Complete Model Access

### What We Have

| Source | Coverage | Access Method |
|--------|----------|---------------|
| Azure AI Foundry | 150 models, 53 deployed | Azure API |
| Google Gemini | Full catalog | Direct API (Zen MCP) |
| Anthropic | Full catalog | Direct API + Azure |
| xAI Grok | Full catalog | Direct API + Azure |

### What We Could Add

| Provider | Models | Effort | Priority |
|----------|--------|--------|----------|
| AWS Bedrock | 100+ | Medium | Consider for Llama 3.x |
| Vertex AI Enterprise | Enhanced Gemini | Low | If higher limits needed |
| Perplexity | Search-augmented | Low | For RAG use cases |

### Quota Actions Needed

1. **Increase GPT-5.1/5.2 quotas** to 10,000+ capacity
2. **Increase Claude Opus quota** to 5,000+ capacity
3. **Increase O3 reasoning quota** to 5,000+ capacity
4. **Deploy batch endpoints** for o3-mini, gpt-4o-mini
5. **Deploy grok-4** and **grok-code-fast-1** in Azure

---

## Failed Deployments (Action Required)

| Deployment | Resource | Model | Issue |
|------------|----------|-------|-------|
| claude-sonnet-4-5-2 | kaveh-mi5ux306-eastus2 | claude-sonnet-4-5 | Deployment failed |
| claude-opus-4-1 | kaveh-1076-resource | claude-opus-4-1 | Deployment failed |

**Recommended**: Delete failed deployments and retry or clean up resources.

---

*Last updated: 2025-12-20*
*Data verified against Azure AI Foundry API and provider documentation*
