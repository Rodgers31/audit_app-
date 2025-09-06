"""
Background Task Service for Automatic Question Management
Handles scheduled tasks for fetching and updating questions
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from database import get_db
from models import QuestionCategory, QuickQuestion
from services.external_question_service import QuestionAggregatorService
from services.question_service import QuestionService
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class QuestionUpdateService:
    """Service for automatic question updates and management."""

    def __init__(self):
        self.aggregator = QuestionAggregatorService()
        self.last_update = None
        self.update_interval_hours = 24  # Update daily
        self.is_running = False

    async def start_background_updates(self):
        """Start the background task for automatic question updates."""
        if self.is_running:
            logger.info("Background question updates already running")
            return

        self.is_running = True
        logger.info("Starting background question updates")

        while self.is_running:
            try:
                await self.update_questions_if_needed()
                # Sleep for 1 hour before checking again
                await asyncio.sleep(3600)

            except Exception as e:
                logger.error(f"Error in background question update: {str(e)}")
                await asyncio.sleep(3600)  # Wait an hour before retrying

    def stop_background_updates(self):
        """Stop the background task."""
        self.is_running = False
        logger.info("Stopping background question updates")

    async def update_questions_if_needed(self):
        """Check if questions need updating and fetch new ones if necessary."""

        # Check if enough time has passed since last update
        if self.last_update:
            time_since_update = datetime.utcnow() - self.last_update
            if time_since_update.total_seconds() < (self.update_interval_hours * 3600):
                logger.debug("Questions updated recently, skipping")
                return

        logger.info("Checking if new questions are needed")

        # Get database session
        db = next(get_db())
        try:
            question_service = QuestionService(db)

            # Check current question count per category
            category_counts = self._get_question_counts_by_category(db)

            # Determine which categories need more questions
            categories_needing_questions = []
            min_questions_per_category = 20

            for category in QuestionCategory:
                current_count = category_counts.get(category.value, 0)
                if current_count < min_questions_per_category:
                    needed = min_questions_per_category - current_count
                    categories_needing_questions.append(
                        {"category": category.value, "needed": needed}
                    )

            if not categories_needing_questions:
                logger.info("All categories have sufficient questions")
                self.last_update = datetime.utcnow()
                return

            # Fetch new questions for categories that need them
            for category_info in categories_needing_questions:
                await self._fetch_and_store_questions(
                    db, category_info["category"], category_info["needed"]
                )

            self.last_update = datetime.utcnow()
            logger.info("Question update completed successfully")

        except Exception as e:
            logger.error(f"Error updating questions: {str(e)}")
        finally:
            db.close()

    def _get_question_counts_by_category(self, db: Session) -> dict:
        """Get current count of active questions by category."""
        from sqlalchemy import func

        counts = (
            db.query(
                QuickQuestion.category, func.count(QuickQuestion.id).label("count")
            )
            .filter(QuickQuestion.is_active == True)
            .group_by(QuickQuestion.category)
            .all()
        )

        return {category.value: count for category, count in counts}

    async def _fetch_and_store_questions(self, db: Session, category: str, limit: int):
        """Fetch questions from external sources and store in database."""
        try:
            logger.info(f"Fetching {limit} questions for category: {category}")

            # Fetch questions from external sources
            new_questions = self.aggregator.fetch_new_questions(
                category=category, total_limit=limit
            )

            if not new_questions:
                logger.warning(f"No questions fetched for category: {category}")
                return

            # Store questions in database
            question_service = QuestionService(db)
            stored_count = 0

            for question_data in new_questions:
                try:
                    # Check if question already exists (basic duplicate check)
                    existing = (
                        db.query(QuickQuestion)
                        .filter(
                            QuickQuestion.question_text
                            == question_data["question_text"]
                        )
                        .first()
                    )

                    if existing:
                        logger.debug(
                            f"Question already exists: {question_data['question_text'][:50]}..."
                        )
                        continue

                    # Create new question
                    question = QuickQuestion(
                        question_text=question_data["question_text"],
                        option_a=question_data["option_a"],
                        option_b=question_data["option_b"],
                        option_c=question_data["option_c"],
                        option_d=question_data["option_d"],
                        correct_answer=question_data["correct_answer"],
                        explanation=question_data.get("explanation", ""),
                        category=QuestionCategory(question_data["category"]),
                        difficulty_level=question_data.get("difficulty_level", 3),
                        source_url=question_data.get("source_url"),
                        tags=question_data.get("tags", []),
                        is_active=True,
                    )

                    db.add(question)
                    stored_count += 1

                except Exception as e:
                    logger.error(f"Error storing question: {str(e)}")
                    continue

            # Commit all new questions
            db.commit()
            logger.info(f"Stored {stored_count} new questions for category: {category}")

        except Exception as e:
            logger.error(f"Error in _fetch_and_store_questions: {str(e)}")
            db.rollback()

    async def manual_update_questions(
        self, category: Optional[str] = None, limit: int = 10
    ):
        """Manually trigger question update for testing/admin purposes."""
        logger.info(
            f"Manual question update triggered - category: {category}, limit: {limit}"
        )

        db = next(get_db())
        try:
            await self._fetch_and_store_questions(
                db, category or "public_finance", limit
            )
            return {"success": True, "message": f"Updated {limit} questions"}

        except Exception as e:
            logger.error(f"Manual update failed: {str(e)}")
            return {"success": False, "error": str(e)}
        finally:
            db.close()

    def get_update_status(self) -> dict:
        """Get current status of the question update service."""
        return {
            "is_running": self.is_running,
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "update_interval_hours": self.update_interval_hours,
            "available_sources": self.aggregator.get_available_sources(),
        }


# Global instance
question_update_service = QuestionUpdateService()
