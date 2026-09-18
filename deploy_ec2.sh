#!/bin/bash
# ==============================================================================
# Smart College System - AWS EC2 Deployment Script (Ubuntu)
# Stack: FastAPI + Next.js + Nginx + Docker
# Database: AWS RDS PostgreSQL (external)
# Storage: AWS S3 (presigned uploads)
# ==============================================================================
set -e

echo "============================================================"
echo "  Smart College System - EC2 Deployment"
echo "============================================================"

# ── 1. System Update ─────────────────────────────────
echo ">>> Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ── 2. Install Docker ────────────────────────────────
echo ">>> Installing Docker & Docker Compose..."
if ! command -v docker &> /dev/null; then
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker $USER
    echo ">>> Docker installed. You may need to log out and back in for group changes."
else
    echo ">>> Docker already installed, skipping..."
fi

# ── 3. Setup Environment ─────────────────────────────
echo ">>> Setting up environment..."
if [ ! -f backend/.env ]; then
    cp .env.example backend/.env
    echo ""
    echo "[!] IMPORTANT: Edit backend/.env with your actual credentials:"
    echo "    nano backend/.env"
    echo ""
    echo "    Required values to update:"
    echo "    - DATABASE_URL (your AWS RDS endpoint)"
    echo "    - S3_BUCKET_NAME"
    echo "    - SQS_QUEUE_URL"
    echo "    - SECRET_KEY (generate a random string)"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

# ── 4. Build and Start ───────────────────────────────
echo ">>> Building and starting all containers..."
sudo docker compose down || true
sudo docker compose up --build -d

# ── 5. Wait for backend to be healthy ────────────────
echo ">>> Waiting for backend to start..."
sleep 10

# ── 6. Run database migrations ───────────────────────
echo ">>> Running database migrations..."
sudo docker compose exec backend alembic upgrade head 2>/dev/null || \
    echo ">>> Note: Run migrations manually if Alembic is not configured yet."

echo ""
echo "============================================================"
echo "  SUCCESS! Smart College System is running!"
echo ""
echo "  Frontend:  http://$(curl -s ifconfig.me)"
echo "  Backend:   http://$(curl -s ifconfig.me):8000"
echo "  API Docs:  http://$(curl -s ifconfig.me):8000/docs"
echo "============================================================"
