#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting gutaiHonyaku application..."

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down server..."
    kill $(jobs -p) 2>/dev/null || true
    exit
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Check if venv exists, if not create it
if [ ! -d ".venv" ]; then
    echo "📦 Virtual environment not found. Creating one..."
    python3 -m venv .venv
fi

source .venv/bin/activate

# Build the frontend if node_modules exist
if [ -d "frontend/node_modules" ]; then
    echo "🔨 Building frontend..."
    cd frontend
    npm run build
    cd ..
else
    echo "⚠️  frontend/node_modules not found – run 'cd frontend && npm install' first."
    echo "   Skipping frontend build; API-only mode."
fi

# Start the unified server
echo "⚙️  Starting gutaiHonyaku server on http://localhost:8000..."
uvicorn backend.main:app --reload --port 8000 &
SERVER_PID=$!

echo ""
echo "✅ Server is starting up!"
echo "⚠️  REMINDER: Ensure your LLM server (LM Studio or Ollama) is running."
echo "🌐 Open http://localhost:8000 in your browser."
echo "Press Ctrl+C to stop the server."
echo ""

# Keep the script running so it can catch the signal
wait
