"""AI client wrapper with Ollama and OpenAI-compatible provider support.

The project can run with local Ollama or any OpenAI-compatible API like OpenAI,
OpenRouter, Groq, Azure OpenAI, or a self-hosted proxy.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("prezento.ai")


class OllamaClient:
    """Thin async wrapper around local Ollama or OpenAI-compatible APIs."""

    def __init__(
        self,
        host: str | None = None,
        model: str | None = None,
        timeout: int | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self.host = (host or settings.ollama_host).rstrip("/")
        self.model = model or settings.ollama_model
        self.timeout = timeout or settings.ollama_timeout
        self.api_key = (api_key or settings.openai_api_key or "").strip()
        self.base_url = (base_url or settings.openai_base_url or "https://api.openai.com/v1").rstrip("/")
        self.openai_compatible = bool(self.api_key)
        if self.openai_compatible:
            self.model = model or settings.openai_model or self.model

    async def is_available(self) -> bool:
        """Return True if the configured provider is reachable."""
        if self.openai_compatible:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    headers = {"Authorization": f"Bearer {self.api_key}"}
                    resp = await client.get(f"{self.base_url}/models", headers=headers)
                    return resp.status_code == 200
            except Exception as exc:
                logger.debug("OpenAI-compatible provider unavailable: %s", exc)
                return False

        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.host}/api/tags")
                if resp.status_code != 200:
                    return False
                data = resp.json()
                models = {m.get("name", "") for m in data.get("models", [])}
                base = self.model.split(":")[0]
                return any(self.model in m or m.startswith(base) for m in models)
        except Exception as exc:
            logger.debug("Ollama unavailable: %s", exc)
            return False

    async def generate(self, prompt: str, system: str | None = None) -> str:
        """Call Ollama or the configured OpenAI-compatible API and return raw text."""
        if self.openai_compatible:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload: dict[str, Any] = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system or "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.7,
            }
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                return str(text).strip()

        payload: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.7, "top_p": 0.9},
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.host}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "").strip()

    async def generate_json(self, prompt: str, system: str | None = None) -> Any:
        """Call the configured provider in JSON mode and parse the result."""
        if self.openai_compatible:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload: dict[str, Any] = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system or "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.6,
                "response_format": {"type": "json_object"},
            }
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()
                    text = data["choices"][0]["message"]["content"]
                    cleaned = str(text).strip()
                    if cleaned.startswith("```"):
                        cleaned = cleaned.strip("`")
                        if cleaned.lower().startswith("json"):
                            cleaned = cleaned[4:].lstrip()
                    return json.loads(cleaned)
            except Exception as exc:
                logger.warning("OpenAI-compatible JSON generation failed: %s", exc)
                raise

        payload: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.6, "top_p": 0.9},
        }
        if system:
            payload["system"] = system

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(f"{self.host}/api/generate", json=payload)
                resp.raise_for_status()
                data = resp.json()
                text = data.get("response", "").strip()
                return json.loads(text)
        except Exception as exc:
            logger.warning("Ollama JSON generation failed: %s", exc)
            raise


ollama_client = OllamaClient()
