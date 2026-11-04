"""Map raw PostgREST/database errors onto meaningful API errors.

The generic handler turns constraint violations into opaque 500s; these are
user-actionable cases that get explicit status codes. Anything else re-raises
so internal details never enter the response body.
"""
from fastapi import HTTPException


def map_db_error(exc: Exception) -> HTTPException:
    code = str(getattr(exc, "code", "") or "")
    message = str(getattr(exc, "message", "") or exc)
    if code == "23505" or "duplicate key" in message:
        return HTTPException(status_code=409, detail="A record with this unique value already exists")
    if code == "23503" or "violates foreign key" in message:
        return HTTPException(status_code=400, detail="Referenced record does not exist in this workspace")
    if code == "23514" or "violates check constraint" in message:
        raise HTTPException(status_code=400, detail="Invalid value for one or more fields")
    raise exc
