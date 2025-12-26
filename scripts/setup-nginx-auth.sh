#!/bin/bash
# Setup nginx basic auth for Temporal UI
set -e

HTPASSWD_FILE="/etc/nginx/conf.d/.htpasswd-temporal"

echo "Setting up nginx basic auth for Temporal UI..."

# Check if htpasswd command exists
if ! command -v htpasswd &> /dev/null; then
    echo "Installing apache2-utils for htpasswd..."
    sudo apt-get update && sudo apt-get install -y apache2-utils
fi

# Generate password file
echo "Enter username for Temporal admin access:"
read -r TEMPORAL_USER

echo "Creating htpasswd file..."
sudo htpasswd -c "$HTPASSWD_FILE" "$TEMPORAL_USER"

echo ""
echo "Basic auth configured for Temporal UI."
echo "  htpasswd file: $HTPASSWD_FILE"
echo "  Access Temporal UI at: https://order-processing.pippai.com/temporal/"
echo ""
echo "To add more users: sudo htpasswd $HTPASSWD_FILE <username>"
