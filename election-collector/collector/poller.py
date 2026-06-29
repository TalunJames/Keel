"""Main poll loop: watch current_ver.txt, ingest each new batch.

Flow per new version (spec §4):
  current_ver.txt changed?
    -> fetch sum.json        (fast path: race totals + turnout)
    -> parse + validate against last promoted state
        pass -> promote summary to production immediately
        fail -> reject + alert, do not touch production
    -> fetch details.json    (slow path: precinct x candidate)
    -> promote precincts
    -> archive raw payloads, write ingest_log, beat heartbeat
The loop never dies on a transient error; it logs/alerts and retries.
"""
import datetime
import logging
import os
import time

from . import config, feed, parse, db, validate
from .alerts import alert

log = logging.getLogger("collector")


def _archive(version, sum_raw, detail_raw):
    vdir = os.path.join(config.RAW_DIR, version)
    os.makedirs(vdir, exist_ok=True)
    if sum_raw:
        with open(os.path.join(vdir, "sum.json"), "wb") as f:
            f.write(sum_raw)
    if detail_raw:
        with open(os.path.join(vdir, "details.json"), "wb") as f:
            f.write(detail_raw)
    return vdir


def ingest_version(conn, version):
    """Fetch, validate and promote a single version. Returns status string."""
    sum_raw, contests = feed.fetch_summary(version)
    contest_rows, choice_rows = parse.parse_summary(contests)

    prev_state = db.current_state(conn)
    ok, problems = validate.validate(contest_rows, choice_rows, prev_state)

    detail_raw, detail_contests = feed.fetch_details(version)
    precinct_rows = parse.parse_details(detail_contests, contests)
    raw_path = _archive(version, sum_raw, detail_raw)

    if not ok:
        db.log_ingest(conn, version, len(contest_rows), len(precinct_rows),
                      raw_path, "rejected")
        alert(f"v{version} REJECTED by validation gate: " + "; ".join(problems),
              level="error")
        db.beat(conn, version, note="rejected")
        return "rejected"

    # Fast path first: race totals + turnout reach the dashboard immediately.
    db.promote_summary(conn, contest_rows, choice_rows)
    # Slow path: precinct detail lands a beat later.
    db.promote_precincts(conn, precinct_rows)
    db.log_ingest(conn, version, len(contest_rows), len(precinct_rows),
                  raw_path, "promoted")
    db.beat(conn, version, note="promoted")

    reported = sum(1 for r in contest_rows
                   if (r["precincts_reported"] or 0) >= (r["total_precincts"] or 0)
                   and (r["total_precincts"] or 0) > 0)
    log.info("v%s promoted: %d contests (%d fully in), %d precinct rows",
             version, len(contest_rows), reported, len(precinct_rows))
    return "promoted"


def run():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    log.info("starting poller: EID=%s base=%s every %ss",
             config.EID, config.BASE, config.POLL_SECONDS)
    conn = db.init_db()
    last = None
    last_change = datetime.datetime.now(datetime.timezone.utc)
    warned_stall = False

    while True:
        try:
            version = feed.current_version()
            if version != last:
                log.info("new version: %s (was %s)", version, last)
                ingest_version(conn, version)
                last = version
                last_change = datetime.datetime.now(datetime.timezone.utc)
                warned_stall = False
            else:
                # Watchdog: no new batch for too long after polls close.
                if config.WATCHDOG_MINUTES and not warned_stall:
                    close = datetime.datetime.fromisoformat(config.POLLS_CLOSE_UTC)
                    now = datetime.datetime.now(datetime.timezone.utc)
                    stalled = (now - last_change).total_seconds() / 60
                    if now >= close and stalled >= config.WATCHDOG_MINUTES:
                        alert(f"no new version for {int(stalled)} min after polls close "
                              f"(last v{last})", level="warning")
                        warned_stall = True
        except KeyboardInterrupt:
            log.info("stopping (keyboard interrupt)")
            break
        except Exception as e:  # noqa: BLE001 - resilience is the point
            alert(f"poll error: {e}", level="error")
        time.sleep(config.POLL_SECONDS)
