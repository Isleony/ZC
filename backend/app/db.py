from contextlib import contextmanager
from typing import Generator

from psycopg_pool import ConnectionPool

from .config import settings

pool = ConnectionPool(conninfo=settings.database_url, open=False, kwargs={"autocommit": True})


def init_pool() -> None:
    if pool.closed:
        pool.open()


@contextmanager
def get_conn() -> Generator:
    with pool.connection() as conn:
        yield conn
