"""Writer for learning hub questions to database."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from models import QuestionCategory, QuickQuestion
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from .parser import QuestionRecord

logger = logging.getLogger("seeding.learning_hub.writer")


def _compute_question_hash(record: QuestionRecord) -> str:
    """Compute deterministic hash for a question record."""
    data = (
        f"{record.question_text}:{record.option_a}:{record.option_b}:"
        f"{record.option_c}:{record.option_d}:{record.correct_answer}"
    )
    return hashlib.sha256(data.encode()).hexdigest()[:16]


def write_questions(
    session: Session, records: list[QuestionRecord], dataset_id: str, job_id: int | None
) -> tuple[int, int]:
    """
    Persist question records to database.

    Args:
        session: Database session
        records: Parsed question records
        dataset_id: Dataset identifier for provenance
        job_id: Ingestion job ID for tracking

    Returns:
        Tuple of (created_count, updated_count)
    """
    created = 0
    updated = 0

    # Map category strings to enum values
    category_mapping = {
        "budget_basics": QuestionCategory.BUDGET_BASICS,
        "audit_fundamentals": QuestionCategory.AUDIT_FUNDAMENTALS,
        "debt_management": QuestionCategory.DEBT_MANAGEMENT,
        "financial_transparency": QuestionCategory.FINANCIAL_TRANSPARENCY,
        "governance": QuestionCategory.GOVERNANCE,
        "public_finance": QuestionCategory.PUBLIC_FINANCE,
    }

    for record in records:
        # Map category string to enum
        category_enum = category_mapping.get(record.category.lower())
        if not category_enum:
            logger.warning(
                f"Skipping question: unknown category '{record.category}'. "
                f"Valid categories: {list(category_mapping.keys())}"
            )
            continue

        # Compute hash for deduplication
        question_hash = _compute_question_hash(record)

        # Check if question already exists
        existing = (
            session.query(QuickQuestion)
            .filter(QuickQuestion.question_text == record.question_text)
            .first()
        )

        if existing:
            # Update if content changed
            needs_update = False

            if existing.option_a != record.option_a:
                existing.option_a = record.option_a
                needs_update = True
            if existing.option_b != record.option_b:
                existing.option_b = record.option_b
                needs_update = True
            if existing.option_c != record.option_c:
                existing.option_c = record.option_c
                needs_update = True
            if existing.option_d != record.option_d:
                existing.option_d = record.option_d
                needs_update = True
            if existing.correct_answer != record.correct_answer:
                existing.correct_answer = record.correct_answer
                needs_update = True
            if existing.explanation != record.explanation:
                existing.explanation = record.explanation
                needs_update = True
            if existing.category != category_enum:
                existing.category = category_enum
                needs_update = True
            if existing.difficulty_level != record.difficulty_level:
                existing.difficulty_level = record.difficulty_level
                needs_update = True
            if existing.is_active != record.is_active:
                existing.is_active = record.is_active
                needs_update = True

            if needs_update:
                existing.updated_at = datetime.now(timezone.utc)
                logger.info(f"Updating question: {record.question_text[:50]}...")
                updated += 1
        else:
            # Create new question
            logger.info(f"Creating question: {record.question_text[:50]}...")

            question = QuickQuestion(
                question_text=record.question_text,
                option_a=record.option_a,
                option_b=record.option_b,
                option_c=record.option_c,
                option_d=record.option_d,
                correct_answer=record.correct_answer,
                explanation=record.explanation,
                category=category_enum,
                difficulty_level=record.difficulty_level,
                source_url=record.source_url,
                tags=record.tags,
                is_active=record.is_active,
            )
            session.add(question)
            created += 1

    logger.info(f"Questions write complete: {created} created, {updated} updated")
    return created, updated
