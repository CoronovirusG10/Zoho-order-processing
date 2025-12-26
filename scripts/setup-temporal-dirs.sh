#!/bin/bash
# Setup directories for Temporal on pippai-vm
set -e

echo "Creating Temporal data directories..."
sudo mkdir -p /opt/temporal/postgres-data
sudo chown -R 999:999 /opt/temporal/postgres-data  # postgres user in container

echo "Temporal directories created successfully."
echo "  PostgreSQL data: /opt/temporal/postgres-data"
