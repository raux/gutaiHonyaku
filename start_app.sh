#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting gutaiHonyaku application..."

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down backend and frontend..."
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

# Start Backend in the background
echo "⚙️  Starting backend (FastAPI) on http://localhost:8000..."
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

# Wait a moment for backend to initialize
sleep 2

# Start Frontend in the background
echo "🌐 Starting frontend (Vite) on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Both services are starting up!"
echo "⚠️  REMINDER: Ensure your LLM server (LM Studio or Ollama) is running."
echo "Press Ctrl+C to stop both services."
echo ""

# Keep the script running so it can catch the signal
wait
