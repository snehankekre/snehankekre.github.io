#!/usr/bin/env python3
"""Fetch yesterday's all-day heart rate from Garmin Connect into public/hr.json.

Runs in CI before the Astro build (see .github/workflows/deploy.yml). It must
never fail the build: on any problem it logs, exits 0, and writes nothing; the
site widget hides itself when hr.json is missing or its data is stale.

Auth: expects GARMINTOKENS_BASE64 in the environment (a base64 token blob from
scripts/garmin_login.py), or falls back to a token directory at ~/.garminconnect
for local runs.
"""

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

OUT = Path(__file__).resolve().parent.parent / "public" / "hr.json"


def main() -> int:
    try:
        from garminconnect import Garmin
    except ImportError:
        print("hr fetch skipped: garminconnect not installed")
        return 0

    # login() accepts either a token directory path or a base64 token blob
    # (garminconnect 0.3.x treats strings longer than 512 chars as blobs).
    tokens = (
        os.environ.get("GARMINTOKENS_BASE64", "").strip()
        or os.environ.get("GARMINTOKENS", "~/.garminconnect")
    )

    try:
        garmin = Garmin()
        garmin.login(tokens)

        # "Yesterday" in the wearer's timezone, not the CI runner's (UTC).
        tz = ZoneInfo(os.environ.get("HR_TZ", "Asia/Makassar"))
        target = (datetime.now(tz) - timedelta(days=1)).date()
        data = garmin.get_heart_rates(target.isoformat())
        points = [
            [ts, bpm]
            for ts, bpm in (data.get("heartRateValues") or [])
            if bpm is not None
        ]
        if len(points) < 10:
            print(f"hr fetch skipped: only {len(points)} samples for {target}")
            return 0

        out = {
            "date": target.isoformat(),
            "resting": data.get("restingHeartRate"),
            "points": points,
        }
        OUT.write_text(json.dumps(out, separators=(",", ":")))
        print(f"wrote {OUT}: {len(points)} samples, resting {out['resting']}")
    except Exception as e:  # never break the build
        print(f"hr fetch skipped: {type(e).__name__}: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
