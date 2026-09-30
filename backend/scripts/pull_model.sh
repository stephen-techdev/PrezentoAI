#!/usr/bin/env bash
# Pull the configured Ollama model. Run once after starting Ollama.
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"
HOST="${OLLAMA_HOST:-http://localhost:11434}"

echo "Pulling Ollama model: $MODEL"
echo "From: $HOST"
echo ""

if ! command -v ollama >/dev/null 2>&1; then
    echo "The 'ollama' CLI was not found on PATH."
    echo "Install it from https://ollama.com and try again."
    exit 1
fi

OLLAMA_HOST="$HOST" ollama pull "$MODEL"

echo ""
echo "Done. Model '$MODEL' is ready."
echo "You can now start the backend with: ./entrypoint.sh"
