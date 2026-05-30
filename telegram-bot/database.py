# Local SQLite - active button state and per-user favourites only.

import sqlite3
from contextlib import contextmanager


class Database:
    def __init__(self, path: str):
        self.path = path
        self._init_tables()

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_tables(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS active_buttons (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id  INTEGER NOT NULL,
                    chat_id     INTEGER NOT NULL,
                    user_id     INTEGER,
                    reason_id   INTEGER,
                    reason_text TEXT,
                    use_count   INTEGER   DEFAULT 1,
                    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_used   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(message_id, chat_id)
                );

                CREATE TABLE IF NOT EXISTS user_favourites (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id     INTEGER NOT NULL,
                    reason_id   INTEGER NOT NULL,
                    reason_text TEXT    NOT NULL,
                    saved_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, reason_id)
                );
            """)

    # Active Buttons

    def upsert_active_button(self, message_id: int, chat_id: int,
                              user_id: int, reason_id: int, reason_text: str):
        with self._conn() as conn:
            conn.execute("""
                INSERT INTO active_buttons
                    (message_id, chat_id, user_id, reason_id, reason_text)
                VALUES (?,?,?,?,?)
                ON CONFLICT(message_id, chat_id) DO UPDATE SET
                    reason_id   = excluded.reason_id,
                    reason_text = excluded.reason_text,
                    last_used   = CURRENT_TIMESTAMP,
                    use_count   = use_count + 1
            """, (message_id, chat_id, user_id, reason_id, reason_text))

    def get_active_button(self, message_id: int, chat_id: int) -> dict | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM active_buttons WHERE message_id=? AND chat_id=?",
                (message_id, chat_id),
            ).fetchone()
            return dict(row) if row else None

    def get_last_button_for_user(self, user_id: int) -> dict | None:
        with self._conn() as conn:
            row = conn.execute("""
                SELECT * FROM active_buttons
                WHERE  user_id = ?
                ORDER  BY last_used DESC
                LIMIT  1
            """, (user_id,)).fetchone()
            return dict(row) if row else None

    def delete_active_button(self, message_id: int, chat_id: int):
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM active_buttons WHERE message_id=? AND chat_id=?",
                (message_id, chat_id),
            )

    # Favourites

    def save_favourite(self, user_id: int, reason_id: int, reason_text: str) -> bool:
        with self._conn() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO user_favourites (user_id, reason_id, reason_text) VALUES (?,?,?)",
                (user_id, reason_id, reason_text),
            )
            return conn.execute("SELECT changes()").fetchone()[0] > 0

    def remove_favourite(self, user_id: int, reason_id: int):
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM user_favourites WHERE user_id=? AND reason_id=?",
                (user_id, reason_id),
            )

    def get_favourites(self, user_id: int, limit: int = 20, offset: int = 0) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute("""
                SELECT reason_id, reason_text, saved_at
                FROM   user_favourites
                WHERE  user_id = ?
                ORDER  BY saved_at DESC
                LIMIT  ? OFFSET ?
            """, (user_id, limit, offset)).fetchall()
            return [dict(r) for r in rows]

    def count_favourites(self, user_id: int) -> int:
        with self._conn() as conn:
            return conn.execute(
                "SELECT COUNT(*) FROM user_favourites WHERE user_id=?",
                (user_id,),
            ).fetchone()[0]
