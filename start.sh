#!/bin/bash
set -e

echo "Starting Conference Lead Platform..."

# Backend
echo "→ Starting FastAPI backend on :8000"
cd "$(dirname "$0")/backend"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Frontend
echo "→ Starting React frontend on :5173"
cd "../frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ Backend:  http://localhost:8000"
echo "✓ Frontend: http://localhost:5173"
echo "✓ API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
