# 13 — Production Deployment Checklist and Validation

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Prepare and validate production deployment requirements. This is a SEPARATE deployment phase from dev/sandbox.

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `13_PRODUCTION_DEPLOY_REPORT.md`
- `13_PRODUCTION_DEPLOY_COMMANDS.log`
- `PRODUCTION_READINESS_CHECKLIST.md`

Then print a **Paste-Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- Do not modify production resources.
- Do not switch to production environment automatically.
- This is an assessment and checklist generation task.
- Do not print secrets.

## Production Environment Differences

| Item | Dev/Sandbox | Production |
|------|-------------|------------|
| Zoho | Sandbox org | Production org |
| Azure Bot | Dev registration | Prod registration (may be same) |
| Key Vault | pippai-keyvault-dev | pippai-keyvault-prod (TBD) |
| Storage | pippaistoragedev | pippaistorageprod (TBD) |
| Domain | processing.pippaoflondon.co.uk | (same or prod subdomain) |

## Steps
1) Setup logging helper.
2) Assess current production readiness:
   - Check if production resources exist
   - Check if production secrets are configured
   - Identify gaps between dev and prod
3) Generate production readiness checklist:

### Section 1: Infrastructure
- [ ] Production Azure resources created (or using dev resources)
- [ ] Production Key Vault configured
- [ ] Production Storage Account configured
- [ ] Production Cosmos DB configured (or shared with dev)
- [ ] DNS configured for production domain (if different)

### Section 2: Security Hardening
- [ ] OS patches up to date: `sudo apt update && sudo apt list --upgradable`
- [ ] Firewall configured: `sudo ufw status`
- [ ] fail2ban installed and configured: `sudo systemctl status fail2ban`
- [ ] SSH hardened (key-only, no root login)
- [ ] nginx security headers configured
- [ ] Rate limiting configured for API endpoints

### Section 3: Secrets and Credentials
- [ ] Production Zoho OAuth tokens
- [ ] Production Azure Bot credentials (if separate from dev)
- [ ] All secrets in Key Vault (not in .env file)
- [ ] Secret rotation policy documented

### Section 4: Monitoring and Alerting
- [ ] Azure Monitor configured for VM
- [ ] Application logs shipping to central location
- [ ] Alerts configured for:
  - [ ] Service down (workflow-api, workflow-worker, teams-bot)
  - [ ] High error rate
  - [ ] Disk space low
  - [ ] SSL certificate expiring
- [ ] Health endpoint monitored externally

### Section 5: Backup and Recovery
- [ ] Cosmos DB backup policy verified
- [ ] Blob Storage backup/versioning enabled
- [ ] VM snapshot/backup scheduled
- [ ] Recovery procedure documented and tested

### Section 6: Zoho Production Configuration
- [ ] Production organization ID configured
- [ ] Production OAuth credentials obtained
- [ ] API rate limits understood
- [ ] Webhook endpoints configured (if applicable)

### Section 7: Azure Bot Production
- [ ] Decide: Same bot for prod, or separate registration?
- [ ] If separate: Create production App Registration
- [ ] If separate: Create production Azure Bot resource
- [ ] Messaging endpoint updated if domain changes

### Section 8: Go-Live Checklist
- [ ] All dev tests passing
- [ ] UAT completed by business users
- [ ] Rollback procedure documented
- [ ] Support contacts identified
- [ ] Go-live window scheduled

4) Check current security posture:
   - `sudo ufw status verbose || true`
   - `sudo systemctl status fail2ban || true`
   - `sudo ss -tlnp | grep -E "(22|80|443)"`
   - `sudo certbot certificates`
5) Check backup status:
   - Azure backup status if configured
   - Local backup scripts if any
6) Write report with:
   - Current production readiness score
   - Critical blockers for production
   - Recommended actions in priority order
   - Estimated effort for each action
7) Print Paste-Back Report block.
