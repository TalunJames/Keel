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
_STATE_ROOT = f"https://results.enr.clarityelections.com/{config.STATE}"


def _base_for_eid(eid):
    return f"{config.COUNTY_ROOT}/{eid}"


def current_version_for_eid(eid):
    """Return current_ver.txt for any county EID."""
    return _get(f"{_base_for_eid(eid)}/current_ver.txt").decode("utf-8").strip()


def fetch_summary_for_eid(eid, version=None):
    """Return contest objects from sum.json for any county EID."""
    v = version or current_version_for_eid(eid)
    body = _get(f"{_base_for_eid(eid)}/{v}/json/sum.json")
    return json.loads(body)["Contests"]


def _manifest_eids():
    """Read county + state Clarity election manifests."""
    found = []
    for url in (f"{config.COUNTY_ROOT}/elections.json", f"{_STATE_ROOT}/elections.json"):
        try:
            rows = json.loads(_get(url).decode("utf-8"))
        except Exception:
            continue
        if not isinstance(rows, list):
            continue
        for row in rows:
            eid = row.get("EID")
            if not eid:
                continue
            name = (row.get("ElectionName") or "")
            county = (row.get("County") or "")
            if url.endswith("/El_Paso/elections.json"):
                found.append(str(eid))
                continue
            # State manifest: keep 2026 primary rows (county blank until posted).
            if "2026" in name and "Primary" in name:
                if not county or "El Paso" in county:
                    found.append(str(eid))
    return found


def discover_eids():
    """Return candidate county EIDs, newest first."""
    found = _manifest_eids()
    try:
        html = _get(config.COUNTY_ROOT + "/").decode("utf-8", "replace")
        found.extend(_EID_RE.findall(html))
    except Exception:
        pass
    if config.EID:
        found.append(str(config.EID))
    return sorted(set(found), reverse=True)


def score_primary_eid(eid):
    """Score how likely an EID is the live 2026 primary feed (higher = better)."""
    try:
        contests = fetch_summary_for_eid(eid)
    except Exception:
        return -999, []
    names = [c.get("C", "") for c in contests]
    lower = [n.lower() for n in names]
    score = 0
    if any("governor" in n for n in lower):
        score += 50
    if any("united states senator" in n or "u.s. senator" in n for n in lower):
        score += 20
    if sum(1 for n in lower if "representative district" in n) >= 3:
        score += 20
    if sum(1 for n in lower if "democratic" in n or "republican" in n) >= 5:
        score += 15
    if any("2026" in n for n in names):
        score += 10
    # Archived/local test elections that are not the statewide primary.
    if any("commissioner vacancy" in n for n in lower) and not any("governor" in n for n in lower):
        score -= 40
    if any("ballot issue" in n for n in lower) and not any("governor" in n for n in lower):
        score -= 20
    return score, names[:6]


def pick_primary_eid(min_score=45):
    """Pick the best EID for the 2026 primary; returns dict for CLI/Node."""
    candidates = discover_eids()
    ranked = []
    for eid in candidates:
        score, sample = score_primary_eid(eid)
        ranked.append({"eid": eid, "score": score, "sample": sample})
    ranked.sort(key=lambda r: (r["score"], r["eid"]), reverse=True)
    best = ranked[0] if ranked else {"eid": None, "score": -999, "sample": []}
    return {
        "eid": best["eid"],
        "score": best["score"],
        "primaryReady": best["score"] >= min_score,
        "sample": best["sample"],
        "candidates": ranked,
        "configuredEid": config.EID,
    }
