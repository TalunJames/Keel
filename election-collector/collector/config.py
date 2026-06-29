"""Configuration for the El Paso ENR collector.

Everything is environment-driven so the same code runs against the test
election today and the live primary on the night, with no edits.
"""
import os

# --- Election identity -------------------------------------------------------
# EID changes per election. Default is the verified Nov-2025 test election so
# the pipeline can be exercised right now. Override with EP_EID on the night.
EID = os.environ.get("EP_EID", "124432")

# Clarity ENR base. State/county are fixed for us.
STATE = os.environ.get("EP_STATE", "CO")
COUNTY = os.environ.get("EP_COUNTY", "El_Paso")
BASE = f"https://results.enr.clarityelections.com/{STATE}/{COUNTY}/{EID}"

# Root of the Clarity election list for this county (used for EID discovery).
COUNTY_ROOT = f"https://results.enr.clarityelections.com/{STATE}/{COUNTY}"

# --- Polling -----------------------------------------------------------------
POLL_SECONDS = int(os.environ.get("EP_POLL_SECONDS", "7"))

# Watchdog: alert if no new version lands within this many minutes once we are
# past polls-close. 0 disables.
WATCHDOG_MINUTES = int(os.environ.get("EP_WATCHDOG_MINUTES", "20"))

# --- Storage -----------------------------------------------------------------
_here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get("EP_DB_PATH", os.path.join(_here, "data", "results.db"))
RAW_DIR = os.environ.get("EP_RAW_DIR", os.path.join(_here, "data", "raw"))

# --- Polls close (validation gate treats earlier batches as test data) -------
# El Paso is America/Denver. Polls close 7:00 PM MT on election day.
# Stored as an ISO instant in UTC so we don't depend on the host's tz database.
# June 30 2026, 7:00 PM MDT == 2026-07-01 01:00:00 UTC.
POLLS_CLOSE_UTC = os.environ.get("EP_POLLS_CLOSE_UTC", "2026-07-01T01:00:00+00:00")

# Enforce the polls-close gate? Off by default so testing against the archived
# test election (already past) isn't rejected. Turn ON for the live night.
ENFORCE_POLLS_CLOSE = os.environ.get("EP_ENFORCE_POLLS_CLOSE", "0") == "1"

# --- Alerts ------------------------------------------------------------------
# Optional generic webhook (Slack/Discord/etc.) that accepts {"text": "..."}.
ALERT_WEBHOOK = os.environ.get("EP_ALERT_WEBHOOK", "")

# Browser UA is required — CloudFront 403s the default urllib agent.
USER_AGENT = os.environ.get(
    "EP_USER_AGENT",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
)
