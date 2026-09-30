#!/usr/bin/env bash
# prezento backend entrypoint. Initializes the database and starts uvicorn.
set -e

cd "$(dirname "$0")"

echo "prezento backend"
echo "─────────────────"
echo "Database: ${DATABASE_URL:-sqlite:///./data/prezento.db}"
echo "Ollama:   ${OLLAMA_HOST:-http://localhost:11434} (model: ${OLLAMA_MODEL:-qwen2.5:3b})"
echo ""

# Initialize the database
python -c "from app.database.connection import init_db; init_db()"
echo "Database initialized."

# Start the API
exec uvicorn app.main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}" ${DEBUG:+--reload}
