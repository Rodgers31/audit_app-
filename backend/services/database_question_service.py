"""
Database-First Question Management System
This approach stores questions in the database and provides CRUD operations
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from database import get_db
from models import QuestionCategory, QuickQuestion, User, UserQuestionAnswer
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class DatabaseQuestionService:
    """Service for managing questions stored in database."""

    def __init__(self, db: Session):
        self.db = db

    def get_daily_questions(
        self,
        user_id: Optional[int] = None,
        limit: int = 5,
        category: Optional[str] = None,
        difficulty_level: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Get questions from database, avoiding recently answered ones."""

        query = self.db.query(QuickQuestion).filter(QuickQuestion.is_active == True)

        # Filter by category if specified
        if category:
            try:
                category_enum = QuestionCategory(category)
                query = query.filter(QuickQuestion.category == category_enum)
            except ValueError:
                logger.warning(f"Invalid category: {category}")

        # Filter by difficulty if specified
        if difficulty_level:
            query = query.filter(QuickQuestion.difficulty_level == difficulty_level)

        # Exclude questions answered by user recently (if user_id provided)
        if user_id:
            recent_cutoff = datetime.now(timezone.utc) - timedelta(days=3)
            answered_question_ids = (
                self.db.query(UserQuestionAnswer.question_id)
                .filter(
                    and_(
                        UserQuestionAnswer.user_id == user_id,
                        UserQuestionAnswer.answered_at >= recent_cutoff,
                    )
                )
                .subquery()
            )

            query = query.filter(~QuickQuestion.id.in_(answered_question_ids))

        # Get questions and convert to dict format
        questions = query.limit(limit).all()

        return [
            {
                "id": q.id,
                "question_text": q.question_text,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
                "category": q.category.value if q.category else "",
                "difficulty_level": q.difficulty_level,
                "tags": q.tags or [],
            }
            for q in questions
        ]

    def create_question(self, question_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new question in database."""

        try:
            # Validate category
            category_enum = QuestionCategory(question_data["category"])
        except ValueError:
            raise ValueError(f"Invalid category: {question_data['category']}")

        question = QuickQuestion(
            question_text=question_data["question_text"],
            correct_answer=question_data["correct_answer"],
            option_a=question_data["option_a"],
            option_b=question_data["option_b"],
            option_c=question_data["option_c"],
            option_d=question_data["option_d"],
            explanation=question_data.get("explanation"),
            category=category_enum,
            difficulty_level=question_data["difficulty_level"],
            source_url=question_data.get("source_url"),
            tags=question_data.get("tags", []),
            is_active=question_data.get("is_active", True),
        )

        self.db.add(question)
        self.db.commit()
        self.db.refresh(question)

        return {
            "id": question.id,
            "message": "Question created successfully",
            "question": question_data,
        }

    def update_question(
        self, question_id: int, update_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update an existing question."""

        question = (
            self.db.query(QuickQuestion).filter(QuickQuestion.id == question_id).first()
        )

        if not question:
            raise ValueError(f"Question {question_id} not found")

        # Update fields
        for field, value in update_data.items():
            if hasattr(question, field):
                if field == "category":
                    value = QuestionCategory(value)
                setattr(question, field, value)

        question.updated_at = datetime.now(timezone.utc)
        self.db.commit()

        return {"message": "Question updated successfully"}

    def delete_question(self, question_id: int) -> Dict[str, Any]:
        """Soft delete a question (mark as inactive)."""

        question = (
            self.db.query(QuickQuestion).filter(QuickQuestion.id == question_id).first()
        )

        if not question:
            raise ValueError(f"Question {question_id} not found")

        question.is_active = False
        self.db.commit()

        return {"message": "Question deleted successfully"}

    def bulk_import_questions(
        self, questions_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Import multiple questions in bulk."""

        created_count = 0
        error_count = 0
        errors = []

        for i, question_data in enumerate(questions_data):
            try:
                self.create_question(question_data)
                created_count += 1
            except Exception as e:
                error_count += 1
                errors.append(f"Question {i+1}: {str(e)}")
                logger.error(f"Error creating question {i+1}: {str(e)}")

        return {
            "created": created_count,
            "errors": error_count,
            "error_details": errors,
        }

    def get_all_questions_for_admin(
        self, page: int = 1, per_page: int = 20, category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get all questions for admin management."""

        query = self.db.query(QuickQuestion)

        if category:
            try:
                category_enum = QuestionCategory(category)
                query = query.filter(QuickQuestion.category == category_enum)
            except ValueError:
                pass

        total = query.count()
        questions = query.offset((page - 1) * per_page).limit(per_page).all()

        return {
            "questions": [
                {
                    "id": q.id,
                    "question_text": q.question_text,
                    "correct_answer": q.correct_answer,
                    "option_a": q.option_a,
                    "option_b": q.option_b,
                    "option_c": q.option_c,
                    "option_d": q.option_d,
                    "explanation": q.explanation,
                    "category": q.category.value if q.category else "",
                    "difficulty_level": q.difficulty_level,
                    "is_active": q.is_active,
                    "tags": q.tags or [],
                    "created_at": q.created_at.isoformat(),
                    "updated_at": q.updated_at.isoformat(),
                }
                for q in questions
            ],
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
        }


def seed_initial_questions(db: Session) -> Dict[str, Any]:
    """Seed the database with initial Kenya-specific questions."""

    service = DatabaseQuestionService(db)

    # Kenya-specific questions to seed
    initial_questions = [
        {
            "question_text": "What is the name of Kenya's annual government budget document?",
            "option_a": "Budget Policy Statement",
            "option_b": "Budget Estimates",
            "option_c": "Appropriation Bill",
            "option_d": "National Budget",
            "correct_answer": "B",
            "explanation": "Budget Estimates is the detailed annual budget document presented to Parliament by the National Treasury.",
            "category": "budget_basics",
            "difficulty_level": 2,
            "tags": ["kenya", "budget", "parliament", "treasury"],
            "source_url": "https://treasury.go.ke",
        },
        {
            "question_text": "Which institution is responsible for preparing Kenya's national budget?",
            "option_a": "Central Bank of Kenya",
            "option_b": "Kenya Revenue Authority",
            "option_c": "National Treasury",
            "option_d": "Ministry of Finance",
            "correct_answer": "C",
            "explanation": "The National Treasury is responsible for preparing Kenya's national budget and fiscal policy.",
            "category": "budget_basics",
            "difficulty_level": 1,
            "tags": ["kenya", "treasury", "budget_preparation"],
        },
        {
            "question_text": "Who is the constitutional head of audit in Kenya?",
            "option_a": "Controller of Budget",
            "option_b": "Auditor General",
            "option_c": "Treasury Secretary",
            "option_d": "Comptroller General",
            "correct_answer": "B",
            "explanation": "The Auditor General is the constitutional head of the Kenya National Audit Office (KENAO).",
            "category": "audit_fundamentals",
            "difficulty_level": 2,
            "tags": ["kenya", "auditor_general", "KENAO", "constitution"],
        },
        {
            "question_text": "What does IFMIS stand for in Kenya's financial management?",
            "option_a": "Integrated Financial Management Information System",
            "option_b": "International Financial Monitoring Information System",
            "option_c": "Internal Financial Management Information System",
            "option_d": "Independent Financial Management Information System",
            "correct_answer": "A",
            "explanation": "IFMIS is Kenya's Integrated Financial Management Information System for government financial operations.",
            "category": "financial_transparency",
            "difficulty_level": 2,
            "tags": ["kenya", "IFMIS", "financial_management", "technology"],
        },
        {
            "question_text": "What is Kenya's debt ceiling as per the PFM Act?",
            "option_a": "40% of GDP",
            "option_b": "50% of GDP",
            "option_c": "60% of GDP",
            "option_d": "70% of GDP",
            "correct_answer": "B",
            "explanation": "Kenya's debt ceiling is set at 50% of GDP as stipulated in the Public Finance Management Act.",
            "category": "debt_management",
            "difficulty_level": 4,
            "tags": ["kenya", "debt_ceiling", "50_percent", "GDP", "PFM_act"],
        },
    ]

    return service.bulk_import_questions(initial_questions)
