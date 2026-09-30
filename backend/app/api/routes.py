"""API route definitions for prezento."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import JSONResponse

from app.ai.client import ollama_client
from app.ai.edit_intent import parse_edit_intent
from app.config import settings
from app.exporter.pdf_exporter import export_pdf
from app.exporter.pptx_exporter import export_pptx
from app.models.schemas import (
    EditRequest,
    EditResponse,
    ExportRequest,
    GenerateRequest,
    GenerateResponse,
    HealthResponse,
    Presentation,
    RewriteRequest,
    RewriteResponse,
    ScoreResponse,
    VivaResponse,
)
from app.services.generator import (
    generate_presentation,
    generate_viva_questions,
    rewrite_text,
    score_presentation,
)
from app.services.storage import (
    delete_presentation,
    get_presentation,
    list_presentations,
    save_presentation,
    save_viva_questions,
)

logger = logging.getLogger("prezento.api")

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check — reports Ollama availability and configured model."""
    available = await ollama_client.is_available()
    return HealthResponse(
        status="ok",
        ollama="online" if available else "offline",
        model=settings.ollama_model,
        version="1.0.0",
    )


@router.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest) -> GenerateResponse:
    """Generate a new presentation."""
    presentation = await generate_presentation(req.settings)
    try:
        save_presentation(presentation)
    except Exception as exc:
        logger.warning("Failed to persist presentation: %s", exc)
    return GenerateResponse(presentation=presentation)


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite(req: RewriteRequest) -> RewriteResponse:
    """Rewrite a piece of text with a given tone."""
    result = await rewrite_text(req.text, req.tone)
    return RewriteResponse(text=result)


@router.post("/viva/{pres_id}", response_model=VivaResponse)
async def viva(pres_id: str) -> VivaResponse:
    """Generate viva questions for a saved presentation."""
    presentation = get_presentation(pres_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    questions = await generate_viva_questions(presentation)
    try:
        save_viva_questions(pres_id, questions)
    except Exception as exc:
        logger.warning("Failed to persist viva questions: %s", exc)
    return VivaResponse(questions=[{"id": q["id"], "question": q["question"], "answer": q["answer"], "followUps": q.get("followUps", [])} for q in questions])


@router.post("/score", response_model=ScoreResponse)
async def score(presentation: Presentation) -> ScoreResponse:
    """Score a presentation."""
    result = await score_presentation(presentation)
    return ScoreResponse(**result)


@router.post("/edit", response_model=EditResponse)
async def edit(req: EditRequest) -> EditResponse:
    """Parse a natural-language editing request into structured actions."""
    result = await parse_edit_intent(
        req.message,
        req.presentation.model_dump(by_alias=True),
        req.current_slide_index,
        req.selected_element_id,
    )
    return EditResponse(
        actions=result.get("actions", []),
        message=result.get("message", "Done."),
        needs_confirmation=result.get("needsConfirmation", False),
    )


@router.post("/export")
async def export(req: ExportRequest) -> Response:
    """Export a presentation as PPTX or PDF."""
    pres = req.presentation
    filename = (pres.settings.title or "presentation").replace(" ", "-").replace("/", "-") or "presentation"
    if req.format == "pptx":
        data = export_pptx(pres)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pptx"'},
        )
    if req.format == "pdf":
        data = export_pdf(pres)
        return Response(
            content=data,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
        )
    raise HTTPException(status_code=400, detail="Invalid format. Use 'pptx' or 'pdf'.")


@router.get("/presentations")
async def list_pres() -> JSONResponse:
    """List saved presentations."""
    return JSONResponse(content=list_presentations())


@router.get("/presentations/{pres_id}", response_model=Presentation)
async def get_pres(pres_id: str) -> Presentation:
    """Fetch a saved presentation."""
    pres = get_presentation(pres_id)
    if not pres:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return pres


@router.delete("/presentations/{pres_id}")
async def delete_pres(pres_id: str) -> JSONResponse:
    """Delete a saved presentation."""
    deleted = delete_presentation(pres_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return JSONResponse(content={"deleted": True})
