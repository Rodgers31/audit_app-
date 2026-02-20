"""Logging helpers for seeding runs."""

from __future__ import annotations

import logging
from logging import Logger
from pathlib import Path
from typing import Optional

from pythonjsonlogger import jsonlogger

_DEFAULT_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def configure_logging(level: str = "INFO", log_file: Optional[Path] = None) -> Logger:
    """Configure root logging with JSON formatting and return the seeding logger."""

    numeric_level = (
        logging.getLevelName(level.upper()) if isinstance(level, str) else level
    )
    if not isinstance(numeric_level, int):
        numeric_level = logging.INFO

    formatter = jsonlogger.JsonFormatter(_DEFAULT_FORMAT)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    root_logger.addHandler(stream_handler)

    if log_file:
        log_path = Path(log_file).expanduser()
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    root_logger.setLevel(numeric_level)
    root_logger.propagate = False

    return logging.getLogger("seeding")
