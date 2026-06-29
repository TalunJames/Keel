"""SQLite persistence layer.

Implements the spec's §6 schema plus a heartbeat row. Writes are idempotent
upserts keyed exactly as the spec requires, so a re-posted batch overwrites
cleanly and never double-counts. SQLite is the zero-config default; swapping to
Postgres is a matter of replacing this module's connection + placeholder style
(the schema is standard SQL).
"""
import sqlite3
import datetime

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS contests (
  contest_key        TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  vote_for           INTEGER,
  total_precincts    INTEGER,
  precincts_reported INTEGER,
  registered         INTEGER,
  ballots_cast       INTEGER,
  total_votes        INTEGER,
  updated_at         TEXT
);

CREATE TABLE IF NOT EXISTS choices (
  contest_key   TEXT,
  choice_idx    INTEGER,
  name          TEXT,
  party_or_code TEXT,
  votes         INTEGER,
  pct           REAL,
  is_winner     INTEGER,
  PRIMARY KEY (contest_key, choice_idx)
);

CREATE TABLE IF NOT EXISTS precinct_results (
  contest_key  TEXT,
  precinct     TEXT,
  choice_name  TEXT,
  vote_method  TEXT,
  votes        INTEGER,
  updated_at   TEXT,
  PRIMARY KEY (contest_key, precinct, choice_name, vote_method)
);

CREATE TABLE IF NOT EXISTS ingest_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  version       TEXT,
  fetched_at    TEXT,
  sum_rows      INTEGER,
  precinct_rows INTEGER,
  raw_path      TEXT,
  status        TEXT
);

CREATE TABLE IF NOT EXISTS heartbeat (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  last_version   TEXT,
  last_update_at TEXT,
  note           TEXT
);
"""


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def connect():
    conn = sqlite3.connect(config.DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = connect()
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def current_state(conn):
    """Return {contest_key: {pr, choice_votes:{idx:votes}}} for validation."""
    state = {}
    for r in conn.execute("SELECT contest_key, precincts_reported FROM contests"):
        state[r["contest_key"]] = {
            "precincts_reported": r["precincts_reported"] or 0,
            "choice_votes": {},
        }
    for r in conn.execute("SELECT contest_key, choice_idx, votes FROM choices"):
        if r["contest_key"] in state:
            state[r["contest_key"]]["choice_votes"][r["choice_idx"]] = r["votes"] or 0
    return state


def promote_summary(conn, contest_rows, choice_rows):
    ts = now_iso()
    conn.executemany(
        """INSERT INTO contests
           (contest_key,name,vote_for,total_precincts,precincts_reported,
            registered,ballots_cast,total_votes,updated_at)
           VALUES (:contest_key,:name,:vote_for,:total_precincts,
                   :precincts_reported,:registered,:ballots_cast,
                   :total_votes,:updated_at)
           ON CONFLICT(contest_key) DO UPDATE SET
             name=excluded.name, vote_for=excluded.vote_for,
             total_precincts=excluded.total_precincts,
             precincts_reported=excluded.precincts_reported,
             registered=excluded.registered, ballots_cast=excluded.ballots_cast,
             total_votes=excluded.total_votes, updated_at=excluded.updated_at""",
        [dict(r, updated_at=ts) for r in contest_rows],
    )
    conn.executemany(
        """INSERT INTO choices
           (contest_key,choice_idx,name,party_or_code,votes,pct,is_winner)
           VALUES (:contest_key,:choice_idx,:name,:party_or_code,:votes,:pct,:is_winner)
           ON CONFLICT(contest_key,choice_idx) DO UPDATE SET
             name=excluded.name, party_or_code=excluded.party_or_code,
             votes=excluded.votes, pct=excluded.pct,
             is_winner=excluded.is_winner""",
        [dict(r, is_winner=1 if r["is_winner"] else 0) for r in choice_rows],
    )
    conn.commit()


def promote_precincts(conn, rows):
    if not rows:
        return
    ts = now_iso()
    conn.executemany(
        """INSERT INTO precinct_results
           (contest_key,precinct,choice_name,vote_method,votes,updated_at)
           VALUES (:contest_key,:precinct,:choice_name,:vote_method,:votes,:updated_at)
           ON CONFLICT(contest_key,precinct,choice_name,vote_method) DO UPDATE SET
             votes=excluded.votes, updated_at=excluded.updated_at""",
        [dict(r, updated_at=ts) for r in rows],
    )
    conn.commit()


def log_ingest(conn, version, sum_rows, precinct_rows, raw_path, status):
    conn.execute(
        """INSERT INTO ingest_log
           (version,fetched_at,sum_rows,precinct_rows,raw_path,status)
           VALUES (?,?,?,?,?,?)""",
        (version, now_iso(), sum_rows, precinct_rows, raw_path, status),
    )
    conn.commit()


def beat(conn, version, note=""):
    conn.execute(
        """INSERT INTO heartbeat (id,last_version,last_update_at,note)
           VALUES (1,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             last_version=excluded.last_version,
             last_update_at=excluded.last_update_at, note=excluded.note""",
        (version, now_iso(), note),
    )
    conn.commit()
