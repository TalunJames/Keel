#!/usr/bin/env python3
"""Entrypoint / CLI for the El Paso ENR collector.

Usage:
  python3 run.py poll               # run the live poll loop (the service)
  python3 run.py once               # fetch+ingest the current version one time
  python3 run.py test               # end-to-end dry-run against the feed
  python3 run.py discover           # list candidate EIDs from the county index
  python3 run.py show               # print current DB state (top of each contest)

Configuration is via EP_* environment variables (see collector/config.py).
"""
import json
import sys

from collector import config, feed, db, poller


def cmd_poll():
    poller.run()


def cmd_once():
    conn = db.init_db()
    v = feed.current_version()
    print(f"current version: {v}")
    status = poller.ingest_version(conn, v)
    print(f"ingest status: {status}")
    cmd_show()


def cmd_discover():
    eids = feed.discover_eids()
    print(f"county index EIDs (newest first): {eids or '[none found — check the live ENR page URL]'}")
    print(f"configured EID: {config.EID}")


def cmd_pick():
    """JSON line for Keel auto-EID resolver."""
    print(json.dumps(feed.pick_primary_eid()))


def cmd_reset():
    conn = db.init_db()
    db.reset_results(conn)
    print("results DB cleared")


def cmd_show():
    conn = db.init_db()
    rows = list(conn.execute(
        "SELECT contest_key,name,precincts_reported,total_precincts,"
        "ballots_cast,registered,total_votes FROM contests ORDER BY contest_key+0"))
    if not rows:
        print("(no contests in DB yet)")
        return
    hb = conn.execute("SELECT * FROM heartbeat WHERE id=1").fetchone()
    if hb:
        print(f"heartbeat: v{hb['last_version']} @ {hb['last_update_at']} ({hb['note']})\n")
    for r in rows:
        print(f"[{r['contest_key']}] {r['name']}")
        print(f"    {r['precincts_reported']}/{r['total_precincts']} precincts | "
              f"{r['ballots_cast']}/{r['registered']} ballots | {r['total_votes']} votes")
        ch = list(conn.execute(
            "SELECT name,votes,pct,is_winner FROM choices WHERE contest_key=? "
            "ORDER BY votes DESC", (r["contest_key"],)))
        for c in ch[:4]:
            star = " *" if c["is_winner"] else ""
            print(f"      {c['name']}: {c['votes']} ({c['pct']:.1f}%){star}")
        if len(ch) > 4:
            print(f"      … +{len(ch)-4} more")


def cmd_test():
    """End-to-end check: version -> summary -> details -> parse, no DB writes."""
    print(f"BASE = {config.BASE}")
    v = feed.current_version()
    print(f"current_ver.txt -> {v}")
    sum_raw, contests = feed.fetch_summary(v)
    print(f"sum.json -> {len(sum_raw)} raw bytes, {len(contests)} contests")
    from collector import parse
    crows, chrows = parse.parse_summary(contests)
    print(f"parsed -> {len(crows)} contest rows, {len(chrows)} choice rows")
    detail_raw, dcontests = feed.fetch_details(v)
    prows = parse.parse_details(dcontests, contests)
    print(f"details.json -> {len(detail_raw)} raw bytes, {len(dcontests)} contests, "
          f"{len(prows)} precinct rows")
    # Spot-check first contest
    if crows:
        c0 = crows[0]
        print(f"\nsample contest: {c0['name']}")
        print(f"  {c0['precincts_reported']}/{c0['total_precincts']} precincts, "
              f"{c0['total_votes']} votes")
    print("\nOK — pipeline reads and parses the live feed end to end.")


COMMANDS = {
    "poll": cmd_poll, "once": cmd_once, "discover": cmd_discover,
    "pick": cmd_pick, "reset": cmd_reset,
    "show": cmd_show, "test": cmd_test,
}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "test"
    if cmd not in COMMANDS:
        print(__doc__)
        sys.exit(2)
    COMMANDS[cmd]()
