"""Validation gate: staging -> production promotion guard (spec §8).

A parsed batch is held in memory and only promoted if it passes every check
below versus the last promoted state. Anything that fails is rejected and
alerted, never reaching the dashboard.
"""
import datetime

from . import config


def _polls_closed():
    if not config.ENFORCE_POLLS_CLOSE:
        return True
    close = datetime.datetime.fromisoformat(config.POLLS_CLOSE_UTC)
    return datetime.datetime.now(datetime.timezone.utc) >= close


def validate(contest_rows, choice_rows, prev_state):
    """Return (ok: bool, problems: list[str]).

    prev_state is db.current_state() output. Soft anomalies that shouldn't
    block (e.g. a vote dip that could be a county correction) are still
    reported but, per spec, a vote *decrease* is a hard reject by default.
    """
    problems = []

    if not _polls_closed():
        problems.append("polls not yet closed (pre-7pm MT) -> treat as test data")

    # Index incoming choices by (contest, idx).
    incoming = {}
    for r in choice_rows:
        incoming[(r["contest_key"], r["choice_idx"])] = r["votes"] or 0

    # 1. No candidate vote total may decrease vs last promoted version.
    for (ck, idx), v in incoming.items():
        prev = prev_state.get(ck, {}).get("choice_votes", {}).get(idx)
        if prev is not None and v < prev:
            problems.append(
                f"vote decrease: contest {ck} choice {idx}: {prev} -> {v}"
            )

    # 2. Precincts-reported may not shrink; BC may not exceed TV; vote sum sane.
    for r in contest_rows:
        ck = r["contest_key"]
        pr = r.get("precincts_reported") or 0
        prev_pr = prev_state.get(ck, {}).get("precincts_reported")
        if prev_pr is not None and pr < prev_pr:
            problems.append(f"precincts reported shrank: contest {ck}: {prev_pr} -> {pr}")

        bc, tv = r.get("ballots_cast") or 0, r.get("registered") or 0
        if tv and bc > tv:
            problems.append(f"ballots_cast {bc} exceeds registered {tv}: contest {ck}")

        # Sum of this contest's choice votes vs reported total (allow VF>1 races
        # where total votes legitimately exceeds ballots). Flag only gross gaps.
        # Sum all incoming choices for this contest (contests may have >64
        # choices), not a fixed range(64) which would under-count.
        csum = sum(
            v for (ick, _idx), v in incoming.items() if ick == ck
        )
        total = r.get("total_votes") or 0
        vote_for = r.get("vote_for") or 1
        if total and vote_for == 1 and csum and abs(csum - total) > max(50, total * 0.02):
            problems.append(
                f"choice-vote sum {csum} far from contest total {total}: contest {ck}"
            )

    ok = len(problems) == 0
    return ok, problems
