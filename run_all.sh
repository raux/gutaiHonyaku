#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting installation and run script for gutaiHonyaku..."

# 1. Backend Setup
echo "📦 Setting up backend..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r backend/requirements.txt

# 2. Frontend Setup
echo "📦 Setting up frontend..."
cd frontend
npm install
cd ..

echo "✅ Installation complete!"
echo ""
echo "⚠️  REMINDER: Make sure your LLM server (LM Studio or Ollama) is running before starting the backend."
echo ""
echo "To run the application, you will need two terminal windows:"
echo ""
echo "Terminal 1 (Backend):"
echo "  source .venv/bin/activate"
echo "  uvicorn backend.main:app --reload --port 8000"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend && npm run dev"
echo ""
echo "---------------------------------------------------------"
