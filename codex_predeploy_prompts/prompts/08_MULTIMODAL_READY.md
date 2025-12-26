# Prompt 08 — Multimodal Expansion Readiness (Excel + Text + Images + Voice)

## Goal
Verify the architecture and model inventory can support:
- Excel (.xlsx) orders (variable layouts)
- plain text orders pasted into Teams
- images/photos (screenshots, scans)
- voice notes (audio)

This is a readiness check; do not build.

## Rules
- Read-only.
- You may rely on local model catalogue docs and Azure listings.

## Output files
- `/data/order-processing/_predeploy_codex/logs/08_MULTIMODAL_READY.md`
- `/data/order-processing/_predeploy_codex/artefacts/multimodal_model_matrix.md`
- `/data/order-processing/_predeploy_codex/artefacts/multimodal_pipeline_checklist.md`

## Steps

1) Read local model catalogues
Use:
- `azure-ai-foundry-model-catalog-2025-12-25.md` (if present)
- `MODEL_ACCESS_REPORT_2025-12-20.md`
Extract which of these are available/deployed:
- multimodal chat (vision)
- OCR specialised models (Mistral Document AI)
- speech-to-text models (gpt-4o-transcribe, diarize variants)
- audio chat models (gpt-audio, realtime)
Write a matrix to `multimodal_model_matrix.md`:
- modality: Excel / image / audio / text
- recommended model(s)
- deployed? (yes/no)
- where (Azure Foundry vs direct API)
- notes on tool calling support

2) Pipeline readiness checklist
Create `multimodal_pipeline_checklist.md` with PASS/FAIL for:
- Excel ingestion: parser library + deterministic extraction plan
- Image ingestion: OCR path (Document AI vs vision OCR)
- Audio ingestion: STT + language handling (Farsi possible)
- Teams UX: how users submit each modality and how bot requests clarification
- Audit logs: raw input retained in Blob with correlation IDs

3) Identify missing components
Flag missing parts as:
- blockers for MVP
- required for future phases
- optional enhancements

## Report
In `08_MULTIMODAL_READY.md`:
- summarise whether current model set supports the roadmap
- list blockers/risks
- recommend next steps
