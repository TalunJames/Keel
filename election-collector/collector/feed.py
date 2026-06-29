"""HTTP access to the Clarity ENR feed.

Two gotchas verified against the live feed and handled here:
  1. CloudFront 403s a default urllib User-Agent -> we send a browser UA.
  2. The JSON files come back gzip-compressed -> we detect the gzip magic
     bytes and inflate transparently (current_ver.txt is plain text).
"""
import gzip
import json
import re
import urllib.request
import urllib.error

from . import config


def _get(url, timeout=20):
    """Fetch a URL, returning raw (already-inflated) bytes."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": config.USER_AGENT,
            "Accept-Encoding": "gzip, deflate",
            "Accept": "*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
    # Inflate if the server gzipped it (Content-Encoding header is unreliable
    # here; sniff the magic bytes instead).
    if body[:2] == b"\x1f\x8b":
        body = gzip.decompress(body)
    return body


def current_version():
    """Return the current version string, e.g. '367216'."""
    return _get(f"{config.BASE}/current_ver.txt").decode("utf-8").strip()


def fetch_summary(version):
    """Return the list of contest objects from sum.json for a version."""
    body = _get(f"{config.BASE}/{version}/json/sum.json")
    return body, json.loads(body)["Contests"]


def fetch_details(version):
    """Return precinct-level detail (details.json) for a version.

    Note: this county's current Clarity layout serves precinct x candidate
    counts as JSON at json/details.json -- NOT the detailxml.zip the original
    spec assumed, so no XML/clarify dependency is needed. Returns (raw_bytes,
    contests_list). contests_list may be [] if details aren't published yet.
    """
    try:
        body = _get(f"{config.BASE}/{version}/json/details.json")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return b"", []
        raise
    return body, json.loads(body).get("Contests", [])


# Clarity nests the real EID under a redirect web/ path. The current_ver.txt
# at the county/EID root is the reliable liveness probe; for discovery we scan
# the county election list page for the numeric EID directories.
_EID_RE = re.compile(r"/" + re.escape(config.COUNTY) + r"/(\d+)/")


def discover_eids():
    """Best-effort: scrape candidate EIDs from the county Clarity index.

    Returns a list of EID strings found on the county landing page. On the
    night, confirm the live primary EID against the official ENR page URL.
    """
    try:
        html = _get(config.COUNTY_ROOT + "/").decode("utf-8", "replace")
    except Exception:
        return []
    return sorted(set(_EID_RE.findall(html)), reverse=True)
