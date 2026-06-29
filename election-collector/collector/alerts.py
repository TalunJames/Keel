"""Alerting: always logs; optionally POSTs to a webhook (Slack/Discord/etc.)."""
import json
import logging
import urllib.request

from . import config

log = logging.getLogger("collector")


def alert(message, level="warning"):
    getattr(log, level if level in ("info", "warning", "error") else "warning")(
        "ALERT: %s", message
    )
    if not config.ALERT_WEBHOOK:
        return
    try:
        data = json.dumps({"text": f"[El Paso ENR] {message}"}).encode("utf-8")
        req = urllib.request.Request(
            config.ALERT_WEBHOOK,
            data=data,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=10).read()
    except Exception as e:  # never let alerting crash the poller
        log.error("failed to post alert webhook: %s", e)
