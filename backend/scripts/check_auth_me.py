"""Live /auth/me check without ever printing the access token.

Usage:
  $env:VENTAPOS_TOKEN = "<supabase access token>"; python scripts/check_auth_me.py
  echo $token | python scripts/check_auth_me.py   # stdin fallback
  python scripts/check_auth_me.py --api http://localhost:8000/api/v1

Prints only status code, user_id prefix, and error code. Never the token.
"""
import argparse
import getpass
import os
import sys

import httpx


def _read_token() -> str:
    token = os.environ.get("VENTAPOS_TOKEN", "").strip()
    if token:
        return token
    if not sys.stdin.isatty():
        return sys.stdin.read().strip()
    return getpass.getpass("Supabase access token (hidden): ").strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:8000/api/v1")
    args = ap.parse_args()
    token = _read_token()
    if not token:
        print("missing token (set VENTAPOS_TOKEN or pipe via stdin)")
        return 2
    try:
        r = httpx.get(
            f"{args.api.rstrip('/')}/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except Exception as e:
        print(f"request failed: {type(e).__name__}")
        return 1
    try:
        body = r.json()
    except Exception:
        body = {}
    if r.status_code == 200:
        uid = str(body.get("data", {}).get("user_id", ""))
        print(f"ok status=200 user_id_prefix={uid[:8]}")
        return 0
    code = body.get("error", {}).get("code", "unknown")
    print(f"fail status={r.status_code} code={code}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
