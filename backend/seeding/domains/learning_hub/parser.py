"""Parser for learning hub question data."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("seeding.learning_hub.parser")


class QuestionRecord:
    """Represents a parsed question record."""

    def __init__(
        self,
        question_text: str,
        option_a: str,
        option_b: str,
        option_c: str,
        option_d: str,
        correct_answer: str,
        explanation: str | None,
        category: str,
        difficulty_level: int,
        source_url: str | None = None,
        tags: list[str] | None = None,
        is_active: bool = True,
    ):
        self.question_text = question_text
        self.option_a = option_a
        self.option_b = option_b
        self.option_c = option_c
        self.option_d = option_d
        self.correct_answer = correct_answer
        self.explanation = explanation
        self.category = category
        self.difficulty_level = difficulty_level
        self.source_url = source_url
        self.tags = tags or []
        self.is_active = is_active


def parse_questions_payload(payload: dict[str, Any]) -> list[QuestionRecord]:
    """
    Parse questions payload into structured records.

    Expected payload format:
    {
        "questions": [
            {
                "question_text": "What is a fiscal year?",
                "option_a": "Calendar year",
                "option_b": "12-month budget period",
                "option_c": "Tax year",
                "option_d": "Accounting quarter",
                "correct_answer": "B",
                "explanation": "A fiscal year is a 12-month period...",
                "category": "budget_basics",
                "difficulty_level": 1,
                "tags": ["budget", "basics"],
                "source_url": "https://treasury.go.ke/...",
                "is_active": true
            }
        ]
    }

    Args:
        payload: Raw JSON payload from fetcher

    Returns:
        List of parsed QuestionRecord objects
    """
    records: list[QuestionRecord] = []
    questions_data = payload.get("questions", [])

    logger.info(f"Parsing {len(questions_data)} question records")

    for idx, q_data in enumerate(questions_data, start=1):
        try:
            # Validate required fields
            required_fields = [
                "question_text",
                "option_a",
                "option_b",
                "option_c",
                "option_d",
                "correct_answer",
                "category",
            ]

            missing = [f for f in required_fields if f not in q_data]
            if missing:
                logger.warning(f"Skipping question #{idx}: missing fields {missing}")
                continue

            # Validate correct_answer is A, B, C, or D
            answer = q_data["correct_answer"].upper()
            if answer not in ["A", "B", "C", "D"]:
                logger.warning(
                    f"Skipping question #{idx}: invalid correct_answer '{answer}'"
                )
                continue

            # Parse difficulty level (default to 1 if missing/invalid)
            try:
                difficulty = int(q_data.get("difficulty_level", 1))
                if not 1 <= difficulty <= 5:
                    difficulty = 1
            except (ValueError, TypeError):
                difficulty = 1

            record = QuestionRecord(
                question_text=q_data["question_text"],
                option_a=q_data["option_a"],
                option_b=q_data["option_b"],
                option_c=q_data["option_c"],
                option_d=q_data["option_d"],
                correct_answer=answer,
                explanation=q_data.get("explanation"),
                category=q_data["category"],
                difficulty_level=difficulty,
                source_url=q_data.get("source_url"),
                tags=q_data.get("tags", []),
                is_active=q_data.get("is_active", True),
            )

            records.append(record)

        except (KeyError, ValueError, TypeError) as exc:
            logger.warning(
                f"Skipping malformed question #{idx}: {exc}",
                extra={"record": q_data, "error": str(exc)},
            )
            continue

    logger.info(f"Successfully parsed {len(records)} question records")
    return records
