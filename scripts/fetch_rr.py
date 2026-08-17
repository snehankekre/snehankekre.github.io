#!/usr/bin/env python3
"""Fetch yesterday's all-day respiration rate from Garmin Connect into public/rr.json.

Runs in CI before the Astro build (see .github/workflows/deploy.yml), alongside
fetch_hr.py. It must never fail the build: on any problem it logs, exits 0, and
writes nothing; the site widget hides the breath when rr.json is missing.

Kept separate from fetch_hr.py so a broken respiration fetch still ships a
heartbeat, and vice versa.

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

OUT = Path(__file__).resolve().parent.parent / "public" / "rr.json"


def main() -> int:
    try:
        from garminconnect import Garmin
    except ImportError:
        print("rr fetch skipped: garminconnect not installed")
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
        data = garmin.get_respiration_data(target.isoformat())

        # Unlike heart rate, which leaves holes as null, respiration fills them
        # with negative sentinels (-1 no reading, -2 off wrist). Drop both so a
        # hole stays a hole instead of animating a breath at minus one.
        points = [
            [ts, int(brpm)]
            for ts, brpm in (data.get("respirationValuesArray") or [])
            if brpm is not None and brpm > 0
        ]
        if len(points) < 10:
            print(f"rr fetch skipped: only {len(points)} samples for {target}")
            return 0

        out = {
            "date": target.isoformat(),
            "sleep_avg": data.get("avgSleepRespirationValue"),
            "waking_avg": data.get("avgWakingRespirationValue"),
            "points": points,
        }
        OUT.write_text(json.dumps(out, separators=(",", ":")))
        print(f"wrote {OUT}: {len(points)} samples, waking avg {out['waking_avg']}")
    except Exception as e:  # never break the build
        print(f"rr fetch skipped: {type(e).__name__}: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
