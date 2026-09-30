import json

import app.ai.client as ai_client_module


class FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, json=None):
        self.calls.append({"url": url, "json": json})

        class Response:
            status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps({"slides": [{"title": "Test"}]})
                            }
                        }
                    ]
                }

        return Response()


def test_generate_json_uses_openai_compatible_api(monkeypatch):
    monkeypatch.setattr(ai_client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = ai_client_module.OllamaClient(
        host="https://example.com",
        model="gpt-4o-mini",
        timeout=30,
        api_key="test-key",
        base_url="https://api.openai.com/v1",
    )

    result = client.generate_json("Create slides", system="You are helpful")

    assert result["slides"][0]["title"] == "Test"
