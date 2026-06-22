# Vision Agent

Voice-only AI language teacher for the Duolingo-style Expo app.

## Environment

This service loads secrets from the parent repo `.env` first:

```txt
STREAM_API_KEY=
STREAM_API_SECRET=
OPENAI_API_KEY=
```

Optional settings:

```txt
TEACHER_TARGET_LANGUAGE=Spanish
OPENAI_REALTIME_MODEL=gpt-realtime-2
OPENAI_REALTIME_VOICE=marin
AGENT_IDLE_TIMEOUT_SECONDS=60
AGENT_MAX_CONCURRENT_SESSIONS=5
AGENT_MAX_SESSIONS_PER_CALL=1
AGENT_MAX_SESSION_DURATION_SECONDS=1800
AGENT_PARTICIPANT_WAIT_TIMEOUT=15
VISION_AGENT_URL=http://localhost:8000
```

The teacher speaks English by default and teaches the selected target language through English.

## Run

```bash
uv sync
uv run python main.py serve --host 0.0.0.0 --port 8000
```

For local console testing:

```bash
uv run python main.py run
```
