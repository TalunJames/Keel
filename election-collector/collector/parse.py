"""Turn raw Clarity JSON into clean rows our DB layer can upsert."""


def parse_summary(contests):
    """Flatten sum.json contests into (contest_rows, choice_rows).

    contest_rows: list of dicts keyed for the `contests` table.
    choice_rows:  list of dicts keyed for the `choices` table.
    """
    contest_rows, choice_rows = [], []
    for c in contests:
        key = str(c.get("K"))
        contest_rows.append({
            "contest_key": key,
            "name": c.get("C"),
            "vote_for": c.get("VF"),
            "total_precincts": c.get("TP"),
            "precincts_reported": c.get("PR"),
            "registered": c.get("TV"),
            "ballots_cast": c.get("BC"),
            "total_votes": c.get("T"),
        })
        names = c.get("CH") or []
        votes = c.get("V") or []
        pcts = c.get("PCT") or []
        codes = c.get("P") or []
        wins = c.get("W") or []
        for i, name in enumerate(names):
            choice_rows.append({
                "contest_key": key,
                "choice_idx": i,
                "name": name,
                "party_or_code": codes[i] if i < len(codes) else None,
                "votes": votes[i] if i < len(votes) else None,
                "pct": pcts[i] if i < len(pcts) else None,
                "is_winner": bool(wins[i]) if i < len(wins) else False,
            })
    return contest_rows, choice_rows


def parse_details(detail_contests, summary_contests):
    """Flatten details.json into precinct-level rows.

    details.json gives, per contest: P = precinct labels, V = parallel arrays
    of per-candidate vote counts (some cells are the string "protected" when a
    precinct is too small to disclose). Candidate names come from the matching
    sum.json contest's CH array (same order). This layout has no vote-method
    split, so vote_method is recorded as 'ALL'.
    """
    ch_by_key = {str(c.get("K")): (c.get("CH") or []) for c in summary_contests}
    rows = []
    for c in detail_contests:
        key = str(c.get("K"))
        names = ch_by_key.get(key, [])
        precincts = c.get("P") or []
        vmatrix = c.get("V") or []
        for pi, precinct in enumerate(precincts):
            if pi >= len(vmatrix):
                break
            cells = vmatrix[pi]
            for ci, cell in enumerate(cells):
                if cell == "protected" or cell is None:
                    continue  # privacy-suppressed; skip rather than store 0
                cname = names[ci] if ci < len(names) else f"choice_{ci}"
                rows.append({
                    "contest_key": key,
                    "precinct": str(precinct),
                    "choice_name": cname,
                    "vote_method": "ALL",
                    "votes": int(cell),
                })
    return rows
