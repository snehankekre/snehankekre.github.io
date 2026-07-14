#!/usr/bin/env python3
"""One-time Garmin Connect login. Run locally, never in CI.

Prompts for credentials (they stay on this machine), saves reusable OAuth
tokens to ~/.garminconnect, and writes the base64 blob for the repo secret to
~/.garminconnect.b64. Then run:

    gh secret set GARMINTOKENS_BASE64 --repo snehankekre/snehankekre.github.io < ~/.garminconnect.b64

Tokens last about a year; re-run this script when the widget goes quiet.
Written against garminconnect 0.3.x (token store lives on `garmin.client`).
"""

from getpass import getpass
from pathlib import Path

from garminconnect import Garmin

email = input("Garmin email: ")
password = getpass("Garmin password (not stored): ")

garmin = Garmin(email=email, password=password, return_on_mfa=True)
status, client_state = garmin.login()
if status == "needs_mfa":
    mfa = input("MFA code: ")
    garmin.resume_login(client_state, mfa)

tokendir = Path.home() / ".garminconnect"
garmin.client.dump(str(tokendir))
b64_path = Path.home() / ".garminconnect.b64"
b64_path.write_text(garmin.client.dumps())

print(f"\nTokens saved to {tokendir}")
print(f"Secret blob written to {b64_path}")
print(
    "Next: gh secret set GARMINTOKENS_BASE64 "
    f"--repo snehankekre/snehankekre.github.io < {b64_path}"
)
