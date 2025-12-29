# 09 — SSL Provisioning: Certificate + Renewal Verification

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Provision SSL certificate for pippai-vm.360innovate.com and verify automatic renewal is configured.

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `09_SSL_PROVISIONING_REPORT.md`
- `09_SSL_PROVISIONING_COMMANDS.log`

Then print a **Paste-Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- Do not print secrets.
- Requires nginx to be installed and running (depends on 01_VM_FOUNDATION).
- Only request certificate if nginx plugin can be used (certbot --nginx).

## Dependencies
- MUST run AFTER 01_VM_FOUNDATION (nginx must be installed)

## Steps
1) Setup logging helper.
2) Verify nginx is installed and running:
   - `which nginx`
   - `systemctl is-active nginx`
   - If nginx not running, fail with message to run 01_VM_FOUNDATION first.
3) Verify DNS resolves correctly:
   - `dig +short pippai-vm.360innovate.com`
   - Record the resolved IP address.
   - Compare with VM's public IP if available.
4) Check if valid certificate already exists:
   - `sudo certbot certificates`
   - Parse output for pippai-vm.360innovate.com
   - Check expiry date (must be > 30 days from now for skip)
5) If certificate missing or expiring soon:
   - Verify certbot is installed:
     - `which certbot`
     - If not installed: `sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx`
   - Request certificate with nginx plugin:
     - `sudo certbot --nginx -d pippai-vm.360innovate.com --non-interactive --agree-tos -m devops@360innovate.com`
   - If certbot fails:
     - Capture full error output
     - Check if rate-limited (suggest waiting)
     - Check if DNS issue (provide resolution steps)
6) Verify HTTPS connectivity:
   - `curl -I https://pippai-vm.360innovate.com/health`
   - Check certificate details:
     - `echo | openssl s_client -connect pippai-vm.360innovate.com:443 -servername pippai-vm.360innovate.com 2>/dev/null | openssl x509 -noout -dates`
7) Verify renewal cron job:
   - Check systemd timer:
     - `systemctl list-timers | grep certbot`
   - Or check cron:
     - `sudo crontab -l | grep certbot || true`
     - `cat /etc/cron.d/certbot 2>/dev/null || true`
   - If no renewal mechanism found:
     - Add cron job: `echo "0 3 * * * root certbot renew --quiet --deploy-hook 'systemctl reload nginx'" | sudo tee /etc/cron.d/certbot-renew`
8) Test renewal dry-run:
   - `sudo certbot renew --dry-run`
9) Write report with:
   - Certificate status (new/existing)
   - Expiry date
   - HTTPS connectivity status
   - Renewal mechanism status
   - Any errors or warnings
10) Print Paste-Back Report block.
