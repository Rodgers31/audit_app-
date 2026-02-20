"""Alert configuration and notification system.

Supports multiple notification channels:
- Email (SMTP)
- Slack webhooks
- PagerDuty
"""

import json
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from enum import Enum
from typing import Dict, List, Optional

import httpx

from ..config.settings import settings

logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertChannel(str, Enum):
    """Alert notification channels."""

    EMAIL = "email"
    SLACK = "slack"
    PAGERDUTY = "pagerduty"
    LOG = "log"


class AlertManager:
    """Manage and send alerts to multiple channels."""

    def __init__(self):
        self.enabled_channels = self._get_enabled_channels()
        logger.info(f"Alert manager initialized with channels: {self.enabled_channels}")

    def _get_enabled_channels(self) -> List[AlertChannel]:
        """Determine which alert channels are configured."""
        channels = [AlertChannel.LOG]  # Always log

        # Check email config
        if settings.SMTP_HOST and settings.SMTP_USER:
            channels.append(AlertChannel.EMAIL)

        # Check Slack webhook
        if self._get_slack_webhook():
            channels.append(AlertChannel.SLACK)

        # Check PagerDuty
        if self._get_pagerduty_key():
            channels.append(AlertChannel.PAGERDUTY)

        return channels

    def _get_slack_webhook(self) -> Optional[str]:
        """Get Slack webhook URL from config."""
        from ..config.secrets import get_secret

        return get_secret("SLACK_WEBHOOK_URL")

    def _get_pagerduty_key(self) -> Optional[str]:
        """Get PagerDuty integration key."""
        from ..config.secrets import get_secret

        return get_secret("PAGERDUTY_INTEGRATION_KEY")

    async def send_alert(
        self,
        title: str,
        message: str,
        severity: AlertSeverity = AlertSeverity.ERROR,
        metadata: Optional[Dict] = None,
        channels: Optional[List[AlertChannel]] = None,
    ):
        """Send alert to configured channels.

        Args:
            title: Alert title
            message: Alert message body
            severity: Alert severity level
            metadata: Additional context data
            channels: Specific channels to use (default: all enabled)
        """
        if channels is None:
            channels = self.enabled_channels

        metadata = metadata or {}

        for channel in channels:
            try:
                if channel == AlertChannel.LOG:
                    self._log_alert(title, message, severity, metadata)
                elif channel == AlertChannel.EMAIL:
                    await self._send_email_alert(title, message, severity, metadata)
                elif channel == AlertChannel.SLACK:
                    await self._send_slack_alert(title, message, severity, metadata)
                elif channel == AlertChannel.PAGERDUTY:
                    await self._send_pagerduty_alert(title, message, severity, metadata)
            except Exception as e:
                logger.error(f"Failed to send alert via {channel}: {e}")

    def _log_alert(
        self, title: str, message: str, severity: AlertSeverity, metadata: Dict
    ):
        """Log alert to application logs."""
        log_msg = f"[ALERT] {title}: {message}"
        if metadata:
            log_msg += f" | Metadata: {json.dumps(metadata)}"

        if severity == AlertSeverity.CRITICAL:
            logger.critical(log_msg)
        elif severity == AlertSeverity.ERROR:
            logger.error(log_msg)
        elif severity == AlertSeverity.WARNING:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

    async def _send_email_alert(
        self, title: str, message: str, severity: AlertSeverity, metadata: Dict
    ):
        """Send alert via email."""
        if not settings.SMTP_HOST:
            return

        try:
            msg = MIMEMultipart()
            msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
            msg["To"] = settings.SMTP_FROM  # Or configure separate alert email
            msg["Subject"] = f"[{severity.value.upper()}] {title}"

            body = f"""
Alert: {title}
Severity: {severity.value.upper()}
Environment: {settings.ENVIRONMENT}

{message}

Additional Context:
{json.dumps(metadata, indent=2)}
"""
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                if settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

            logger.info(f"Email alert sent: {title}")
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")

    async def _send_slack_alert(
        self, title: str, message: str, severity: AlertSeverity, metadata: Dict
    ):
        """Send alert to Slack."""
        webhook_url = self._get_slack_webhook()
        if not webhook_url:
            return

        # Color coding by severity
        color_map = {
            AlertSeverity.INFO: "#36a64f",
            AlertSeverity.WARNING: "#ff9800",
            AlertSeverity.ERROR: "#f44336",
            AlertSeverity.CRITICAL: "#9c27b0",
        }

        payload = {
            "attachments": [
                {
                    "color": color_map.get(severity, "#808080"),
                    "title": title,
                    "text": message,
                    "fields": [
                        {
                            "title": "Severity",
                            "value": severity.value.upper(),
                            "short": True,
                        },
                        {
                            "title": "Environment",
                            "value": settings.ENVIRONMENT,
                            "short": True,
                        },
                    ]
                    + [
                        {"title": k, "value": str(v), "short": True}
                        for k, v in metadata.items()
                    ],
                    "footer": settings.APP_NAME,
                    "ts": (
                        int(metadata.get("timestamp", 0))
                        if "timestamp" in metadata
                        else None
                    ),
                }
            ]
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(webhook_url, json=payload, timeout=10.0)
                response.raise_for_status()
            logger.info(f"Slack alert sent: {title}")
        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e}")

    async def _send_pagerduty_alert(
        self, title: str, message: str, severity: AlertSeverity, metadata: Dict
    ):
        """Send alert to PagerDuty."""
        integration_key = self._get_pagerduty_key()
        if not integration_key:
            return

        # Only trigger PagerDuty for ERROR and CRITICAL
        if severity not in [AlertSeverity.ERROR, AlertSeverity.CRITICAL]:
            return

        payload = {
            "routing_key": integration_key,
            "event_action": "trigger",
            "payload": {
                "summary": title,
                "severity": severity.value,
                "source": settings.APP_NAME,
                "custom_details": {
                    "message": message,
                    "environment": settings.ENVIRONMENT,
                    **metadata,
                },
            },
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://events.pagerduty.com/v2/enqueue",
                    json=payload,
                    timeout=10.0,
                )
                response.raise_for_status()
            logger.info(f"PagerDuty alert sent: {title}")
        except Exception as e:
            logger.error(f"Failed to send PagerDuty alert: {e}")


# Global alert manager instance
_alert_manager: Optional[AlertManager] = None


def get_alert_manager() -> AlertManager:
    """Get or create the global alert manager."""
    global _alert_manager
    if _alert_manager is None:
        _alert_manager = AlertManager()
    return _alert_manager


async def send_alert(
    title: str,
    message: str,
    severity: AlertSeverity = AlertSeverity.ERROR,
    metadata: Optional[Dict] = None,
):
    """Convenience function to send an alert."""
    await get_alert_manager().send_alert(title, message, severity, metadata)
