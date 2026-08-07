from __future__ import annotations

from typing import Any, Optional

import requests


class Cpaas:
    def __init__(self, api_key: str, base_url: str = "http://localhost:3001") -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Content-Type": "application/json",
                "X-Api-Key": api_key,
            }
        )

    def _request(self, method: str, path: str, json: Optional[dict[str, Any]] = None) -> Any:
        url = f"{self.base_url}/v1{path}"
        res = self.session.request(method, url, json=json, timeout=30)
        data = res.json() if res.content else {}
        if not res.ok:
            message = data.get("error", {}).get("message") or res.text
            raise RuntimeError(message)
        return data

    def verify_send(self, to: str, channel: str = "SMS") -> dict[str, Any]:
        return self._request("POST", "/verify/send", {"to": to, "channel": channel})

    def verify_check(self, id: str, code: str) -> dict[str, Any]:
        return self._request("POST", "/verify/check", {"id": id, "code": code})

    def messages_create(self, to: str, body: str, **kwargs: Any) -> dict[str, Any]:
        payload = {"to": to, "body": body, **kwargs}
        return self._request("POST", "/messages", payload)

    def email_send(self, to: str, subject: str, text: Optional[str] = None, html: Optional[str] = None) -> dict[str, Any]:
        return self._request(
            "POST",
            "/email/send",
            {"to": to, "subject": subject, "text": text, "html": html},
        )

    def webhooks_create(self, url: str, events: list[str]) -> dict[str, Any]:
        return self._request("POST", "/webhooks", {"url": url, "events": events})
