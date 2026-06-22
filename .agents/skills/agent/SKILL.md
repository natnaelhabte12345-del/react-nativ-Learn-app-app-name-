---
name: Agent
description: Use when building real-time voice or video AI agents, integrating with LLMs and speech services, deploying agents to production, or adding function calling and RAG capabilities to conversational AI applications.
metadata:
    mintlify-proj: agent
    version: "1.0"
---

# Vision Agents Skill

## Product Summary

Vision Agents is a Python framework for building real-time voice and video AI agents. It provides a modular architecture where you configure an `Agent` with an LLM, speech-to-text (STT), text-to-speech (TTS), and optional video processors. The framework handles audio/video transport via Stream's edge network, manages conversation flow, and integrates with 30+ AI providers (OpenAI, Gemini, Anthropic, Deepgram, ElevenLabs, etc.). Key files: `main.py` (agent definition), `.env` (API keys), `requirements.txt` or `pyproject.toml` (dependencies). CLI commands: `uv run agent.py run` (console mode), `uv run agent.py serve` (HTTP server). Primary docs: https://visionagents.ai

## When to Use

Reach for this skill when:
- **Building voice agents** — Custom STT/LLM/TTS pipelines or realtime models (OpenAI, Gemini)
- **Building video agents** — Real-time video analysis with VLMs or computer vision processors
- **Adding function calling** — Registering tools/functions the agent can invoke during conversations
- **Deploying to production** — Running agents as HTTP servers, scaling horizontally, or containerizing with Docker
- **Integrating RAG** — Adding knowledge bases with Gemini FileSearch or TurboPuffer
- **Handling phone calls** — Connecting agents to Twilio for inbound/outbound calling
- **Testing agent behavior** — Verifying tool calls, responses, and intent without spinning up audio/video infrastructure
- **Monitoring agents** — Tracking latency, token usage, and errors with OpenTelemetry metrics

## Quick Reference

### Agent Constructor Parameters

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `edge` | EdgeTransport | Yes | Transport layer (usually `getstream.Edge()`) |
| `llm` | LLM \| Realtime | Yes | Language model or realtime model |
| `agent_user` | User | Yes | Agent identity (name, id) |
| `instructions` | str | No | System prompt; supports `@file.md` for loading from markdown |
| `stt` | STT | No | Speech-to-text (omit for realtime models) |
| `tts` | TTS | No | Text-to-speech (omit for realtime models) |
| `processors` | List[Processor] | No | Video processors (YOLO, Roboflow, etc.) |
| `mcp_servers` | List[MCPServer] | No | External tool servers (MCP) |
| `avatar` | Avatar | No | Lip-synced visual character |
| `turn_detection` | TurnDetector | No | Custom turn detection (auto-disabled if STT has built-in) |

### Core Agent Methods

| Method | Purpose |
|--------|---------|
| `async join(call)` | Join a call as async context manager |
| `async simple_response(text, interrupt=False)` | Send text to LLM, speak response via TTS |
| `async say(text, interrupt=False)` | Speak text directly, bypassing LLM |
| `async finish()` | Wait for call to end |
| `@agent.llm.register_function()` | Register a function the LLM can call |
| `@agent.events.subscribe` | Subscribe to agent events |

### CLI Commands

```bash
# Console mode (single agent, browser UI)
uv run agent.py run [--call-id ID] [--video-track-override /path/to/video.mp4]

# HTTP server mode (production)
uv run agent.py serve [--host 0.0.0.0] [--port 8000]

# Server options
--agents-log-level DEBUG
--http-log-level INFO
--no-splash
```

### HTTP Server Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/calls/{call_id}/sessions` | Start agent session |
| DELETE | `/calls/{call_id}/sessions/{session_id}` | Close session |
| GET | `/calls/{call_id}/sessions/{session_id}` | Get session info |
| GET | `/calls/{call_id}/sessions/{session_id}/metrics` | Real-time metrics |
| GET | `/health` | Liveness check |
| GET | `/ready` | Readiness check |

### Plugin Installation

```bash
# Voice agent with custom STT/TTS
uv add "vision-agents[getstream,gemini,deepgram,elevenlabs]"

# Video agent with YOLO
uv add "vision-agents[getstream,gemini,ultralytics]"

# Realtime model (simplest)
uv add "vision-agents[getstream,gemini]"
```

## Decision Guidance

### Realtime vs Custom Pipeline

| Scenario | Use Realtime | Use Custom Pipeline |
|----------|--------------|---------------------|
| Lowest latency, simplest setup | ✓ | — |
| Need specific STT provider (Deepgram, ElevenLabs) | — | ✓ |
| Need specific TTS voice/quality | — | ✓ |
| Want to swap LLM without rewriting | — | ✓ |
| Building MVP quickly | ✓ | — |

**Realtime:** `llm=gemini.Realtime()` or `llm=openai.Realtime()` — handles speech natively, no separate STT/TTS.

**Custom:** `llm=gemini.LLM()`, `stt=deepgram.STT()`, `tts=elevenlabs.TTS()` — full control, mix providers.

### Video Agent Approaches

| Approach | Best For | Setup |
|----------|----------|-------|
| **Realtime (fps=3)** | Lowest latency, native video | `llm=gemini.Realtime(fps=3)` |
| **VLM** | Video understanding, analysis | `llm=nvidia.VLM(fps=1, frame_buffer_seconds=10)` |
| **Processors** | Object detection, pose estimation | `processors=[ultralytics.YOLOPoseProcessor(...)]` |

### Deployment Scale

| Scale | Start Here | Key Config |
|-------|-----------|-----------|
| Local dev | `uv run agent.py run` | None |
| Single container | `uv run agent.py serve` | `ServeOptions` |
| Multiple replicas | Add Redis session registry | `SessionRegistry` |
| Full Kubernetes | Helm chart + monitoring | Prometheus + Jaeger |

### RAG Options

| Option | Setup | Best For |
|--------|-------|----------|
| **Gemini FileSearch** | `gemini.GeminiFilesearchRAG()` | Quick prototypes |
| **TurboPuffer** | `turbopuffer.TurboPufferRAG()` | Production, hybrid search |

## Workflow

### 1. Build a Voice Agent

1. **Initialize project** — `uv init --python 3.12 my-agent && uv add "vision-agents[getstream,gemini,deepgram,elevenlabs]"`
2. **Create `.env`** — Add `STREAM_API_KEY`, `STREAM_API_SECRET`, `GOOGLE_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`
3. **Write `main.py`**:
   - Define `async def create_agent(**kwargs) -> Agent` — returns configured agent
   - Define `async def join_call(agent, call_type, call_id, **kwargs)` — what happens when agent joins
   - Wrap in `Runner(AgentLauncher(create_agent=..., join_call=...)).cli()`
4. **Register functions** — Use `@agent.llm.register_function()` for tools
5. **Test locally** — `uv run main.py run` opens browser UI
6. **Deploy** — `uv run main.py serve` for HTTP server

### 2. Add Function Calling

1. **Register function** — Decorate with `@agent.llm.register_function(description="...")`
2. **Make it async** — Sync functions raise `ValueError`
3. **Type hints** — Use standard Python types (str, int, dict, list)
4. **Test** — Use `TestSession` to verify tool calls without audio/video

### 3. Deploy to Production

1. **Create Dockerfile** — Copy agent code, install dependencies, expose port 8000
2. **Set environment variables** — API keys via secrets, not hardcoded
3. **Configure session limits** — `max_concurrent_sessions`, `max_session_duration_seconds`
4. **Add monitoring** — Enable telemetry with `broadcast_metrics=True`
5. **Scale horizontally** — Add Redis `SessionRegistry` for multi-node deployments
6. **Use Kubernetes** — Reference the Helm chart in the docs

### 4. Test Agent Behavior

1. **Import test utilities** — `from vision_agents.testing import TestSession, LLMJudge`
2. **Create test session** — `async with TestSession(llm=llm, instructions="...") as session:`
3. **Send input** — `response = await session.simple_response("user input")`
4. **Assert tool calls** — `response.assert_function_called("tool_name", arguments={...})`
5. **Judge intent** — `verdict = await judge.evaluate(response.chat_messages[0], intent="...")`

## Common Gotchas

- **Async-only functions** — `@register_function()` requires `async def`. Sync functions raise `ValueError`.
- **STT with built-in turn detection** — Deepgram and ElevenLabs STT include turn detection. Passing a separate `TurnDetector` is ignored automatically.
- **Realtime models don't use STT/TTS** — Omit `stt` and `tts` when using `gemini.Realtime()` or `openai.Realtime()`.
- **Event handlers are fire-and-forget** — Don't assume a handler has run before the next line of agent code. Use `asyncio.Event()` if you need to wait.
- **Session limits prevent runaway costs** — Set `max_session_duration_seconds` and `max_concurrent_sessions` in production.
- **Instructions support markdown files** — Use `instructions="@system.md"` to load from a file.
- **Video processors run on every frame** — Use `fps` parameter to reduce frame rate (e.g., `fps=1` for 1 frame/sec).
- **Tool execution timeout is 30s by default** — Long-running tools may timeout; increase via LLM config if needed.
- **Realtime models have their own VAD** — Don't add separate turn detection; it's built-in.
- **Close operations return HTTP 202** — Session close is async; don't assume immediate shutdown.

## Verification Checklist

Before submitting agent code:

- [ ] All required API keys are in `.env` (not hardcoded)
- [ ] `create_agent()` returns a properly configured `Agent` instance
- [ ] `join_call()` is async and calls `agent.join(call)` as context manager
- [ ] Registered functions are `async def` with type hints
- [ ] Instructions are clear and concise (or loaded from markdown file)
- [ ] STT/TTS are omitted if using realtime model
- [ ] Video processors have appropriate `fps` to avoid overload
- [ ] Session limits are set for production (`max_concurrent_sessions`, `max_session_duration_seconds`)
- [ ] Error handling is in place (subscribe to error events if needed)
- [ ] Tests pass: `uv run pytest tests/ -m integration`
- [ ] Local test works: `uv run main.py run` opens browser and agent responds
- [ ] Server starts: `uv run main.py serve` listens on port 8000
- [ ] Dockerfile builds and runs without errors
- [ ] Environment variables are documented in README

## Resources

**Comprehensive navigation:** https://visionagents.ai/llms.txt

**Critical pages:**
- [Quickstart](https://visionagents.ai/introduction/quickstart) — 5-minute setup
- [Voice Agents](https://visionagents.ai/introduction/voice-agents) — Custom STT/LLM/TTS pipelines
- [Video Agents](https://visionagents.ai/introduction/video-agents) — VLMs and processors
- [Agent Class Reference](https://visionagents.ai/core/agent-core) — Constructor and methods
- [HTTP Server & Deployment](https://visionagents.ai/guides/http-server) — Production setup
- [Function Calling & MCP](https://visionagents.ai/guides/mcp-tool-calling) — Tool integration
- [Testing](https://visionagents.ai/guides/testing) — Verify behavior without audio/video
- [Integrations](https://visionagents.ai/integrations/introduction-to-integrations) — 30+ provider plugins

---

> For additional documentation and navigation, see: https://visionagents.ai/llms.txt