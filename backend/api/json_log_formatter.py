"""JSON log formatter for uvicorn — keeps stack traces as a single log entry."""

import json
import logging


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%fZ"),
        }
        if record.exc_info:
            # Entire traceback as one string — no line-splitting in Cloud Run
            entry["exception"] = self.formatException(record.exc_info)
        if record.stack_info:
            entry["stack_info"] = self.formatStack(record.stack_info)
        return json.dumps(entry)
