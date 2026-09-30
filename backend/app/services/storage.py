"""Presentation storage service (SQLite)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from app.database.connection import get_conn
from app.models.schemas import Presentation, PresentationSettings


def save_presentation(presentation: Presentation) -> None:
    """Insert or update a presentation."""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO presentations (id, title, prompt, settings_json, slides_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                prompt=excluded.prompt,
                settings_json=excluded.settings_json,
                slides_json=excluded.slides_json,
                updated_at=excluded.updated_at
            """,
            (
                presentation.id,
                presentation.settings.title,
                presentation.settings.prompt,
                presentation.settings.model_dump_json(by_alias=True),
                presentation.model_dump_json(by_alias=True),
                presentation.created_at,
                presentation.updated_at,
            ),
        )


def get_presentation(pres_id: str) -> Presentation | None:
    """Fetch a presentation by ID."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM presentations WHERE id = ?",
            (pres_id,),
        ).fetchone()
    if not row:
        return None
    return _row_to_presentation(row)


def list_presentations() -> list[dict[str, Any]]:
    """List all saved presentations (metadata only)."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, title, prompt, created_at, updated_at FROM presentations ORDER BY updated_at DESC"
        ).fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "prompt": r["prompt"],
            "createdAt": r["created_at"],
            "updatedAt": r["updated_at"],
        }
        for r in rows
    ]


def delete_presentation(pres_id: str) -> bool:
    """Delete a presentation. Returns True if a row was removed."""
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM presentations WHERE id = ?", (pres_id,))
        return cur.rowcount > 0


def save_viva_questions(pres_id: str, questions: list[dict[str, Any]]) -> None:
    """Persist viva questions for a presentation."""
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        conn.execute("DELETE FROM viva_questions WHERE presentation_id = ?", (pres_id,))
        for q in questions:
            conn.execute(
                """
                INSERT INTO viva_questions (id, presentation_id, question, answer, followups_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    q.get("id", f"vq_{uuid.uuid4().hex[:8]}"),
                    pres_id,
                    q["question"],
                    q["answer"],
                    json.dumps(q.get("followUps", [])),
                    now,
                ),
            )


def get_viva_questions(pres_id: str) -> list[dict[str, Any]]:
    """Fetch viva questions for a presentation."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM viva_questions WHERE presentation_id = ? ORDER BY created_at",
            (pres_id,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "question": r["question"],
            "answer": r["answer"],
            "followUps": json.loads(r["followups_json"]),
        }
        for r in rows
    ]


def _row_to_presentation(row: Any) -> Presentation:
    """Convert a DB row into a Presentation model."""
    full = json.loads(row["slides_json"])
    return Presentation(**full)
