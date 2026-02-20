"""Secret management with multiple backend support.

Supports:
- AWS Secrets Manager
- HashiCorp Vault
- Environment variables (fallback)
"""

import json
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class SecretManager:
    """Unified secret manager with multiple backend support."""

    def __init__(self):
        self.backend = os.getenv("SECRET_BACKEND", "env").lower()
        self._cache: Dict[str, Any] = {}

        if self.backend == "aws":
            try:
                import boto3

                self.client = boto3.client("secretsmanager")
                logger.info("Using AWS Secrets Manager")
            except ImportError:
                logger.warning(
                    "boto3 not installed, falling back to environment variables"
                )
                self.backend = "env"
        elif self.backend == "vault":
            try:
                import hvac

                vault_url = os.getenv("VAULT_ADDR", "http://localhost:8200")
                vault_token = os.getenv("VAULT_TOKEN")
                self.client = hvac.Client(url=vault_url, token=vault_token)
                if not self.client.is_authenticated():
                    logger.warning("Vault authentication failed, falling back to env")
                    self.backend = "env"
                else:
                    logger.info(f"Using HashiCorp Vault at {vault_url}")
            except ImportError:
                logger.warning(
                    "hvac not installed, falling back to environment variables"
                )
                self.backend = "env"
        else:
            logger.info("Using environment variables for secrets")

    def get_secret(
        self, secret_name: str, default: Optional[str] = None
    ) -> Optional[str]:
        """Get a secret value from the configured backend.

        Args:
            secret_name: Name/key of the secret
            default: Default value if secret not found

        Returns:
            Secret value or default
        """
        # Check cache first
        if secret_name in self._cache:
            return self._cache[secret_name]

        try:
            if self.backend == "aws":
                value = self._get_from_aws(secret_name)
            elif self.backend == "vault":
                value = self._get_from_vault(secret_name)
            else:
                value = os.getenv(secret_name, default)

            if value:
                self._cache[secret_name] = value
            return value or default

        except Exception as e:
            logger.error(f"Error fetching secret {secret_name}: {e}")
            return os.getenv(secret_name, default)

    def _get_from_aws(self, secret_name: str) -> Optional[str]:
        """Get secret from AWS Secrets Manager."""
        try:
            response = self.client.get_secret_value(SecretId=secret_name)
            if "SecretString" in response:
                secret = response["SecretString"]
                # Try to parse as JSON
                try:
                    secret_dict = json.loads(secret)
                    # If it's a dict, return the first value
                    return list(secret_dict.values())[0] if secret_dict else None
                except json.JSONDecodeError:
                    return secret
            return None
        except Exception as e:
            logger.error(f"AWS Secrets Manager error for {secret_name}: {e}")
            return None

    def _get_from_vault(self, secret_name: str) -> Optional[str]:
        """Get secret from HashiCorp Vault."""
        try:
            # Assume secrets are stored at secret/data/<app_name>/<secret_name>
            app_name = os.getenv("APP_NAME", "audit_app")
            mount_point = os.getenv("VAULT_MOUNT_POINT", "secret")
            path = f"{mount_point}/data/{app_name}/{secret_name}"

            response = self.client.secrets.kv.v2.read_secret_version(
                path=f"{app_name}/{secret_name}"
            )
            return response["data"]["data"].get("value")
        except Exception as e:
            logger.error(f"Vault error for {secret_name}: {e}")
            return None

    def get_secret_dict(self, secret_name: str) -> Dict[str, Any]:
        """Get a secret that contains a JSON dictionary.

        Args:
            secret_name: Name of the secret containing JSON

        Returns:
            Dictionary of secret values
        """
        try:
            if self.backend == "aws":
                response = self.client.get_secret_value(SecretId=secret_name)
                if "SecretString" in response:
                    return json.loads(response["SecretString"])
            elif self.backend == "vault":
                app_name = os.getenv("APP_NAME", "audit_app")
                response = self.client.secrets.kv.v2.read_secret_version(
                    path=f"{app_name}/{secret_name}"
                )
                return response["data"]["data"]
            else:
                # Try to get from env as JSON
                value = os.getenv(secret_name)
                if value:
                    return json.loads(value)
        except Exception as e:
            logger.error(f"Error fetching secret dict {secret_name}: {e}")

        return {}

    def clear_cache(self):
        """Clear the secret cache."""
        self._cache.clear()


# Global instance
_secret_manager: Optional[SecretManager] = None


def get_secret_manager() -> SecretManager:
    """Get or create the global secret manager instance."""
    global _secret_manager
    if _secret_manager is None:
        _secret_manager = SecretManager()
    return _secret_manager


def get_secret(secret_name: str, default: Optional[str] = None) -> Optional[str]:
    """Convenience function to get a secret.

    Args:
        secret_name: Name/key of the secret
        default: Default value if not found

    Returns:
        Secret value or default
    """
    return get_secret_manager().get_secret(secret_name, default)
