# 2026_osp_project_-

The repository contains two independent projects:

- `EwhaMarket/` — the original Flask marketplace, with its own `app.py`,
  `database.py`, templates, static assets, and requirements.
- `EumBang/` — the 이음방 project. Its static frontend keeps `ieumbang/` and
  `files/` as sibling directories under `frontend/`; its room backend lives in
  `backend/` with routes, services, templates, tests, and docs.

The existing local Firebase authentication file remains outside both projects
under the ignored `authentication/` directory. It is not tracked or changed.

## Run locally

From the repository root:

```text
python EwhaMarket/app.py
python EumBang/backend/app.py
```

The EwhaMarket app keeps its original Firebase-backed routes. The EumBang
backend reads the same local Firebase configuration only when a room request
needs it; tests inject an in-memory database instead.
