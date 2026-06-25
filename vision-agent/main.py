from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from vision_agents.core.instructions import Instructions
from vision_agents.core import Agent, AgentLauncher, Runner, User
from vision_agents.plugins import gemini, getstream, openai


SERVICE_DIR = Path(__file__).resolve().parent
REPO_ROOT = SERVICE_DIR.parent

# Keep secrets centralized in the Expo app's root .env.
load_dotenv(REPO_ROOT / ".env")
load_dotenv(SERVICE_DIR / ".env", override=False)


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return float(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number") from exc


def _validate_required_env() -> None:
    missing = [
        name
        for name in ("STREAM_API_KEY", "STREAM_API_SECRET")
        if not os.getenv(name)
    ]
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(f"Missing required environment variable(s): {joined}")

    has_openai = bool(os.getenv("OPENAI_API_KEY"))
    has_gemini = bool(os.getenv("GOOGLE_API_KEY"))
    if not has_openai and not has_gemini:
        raise RuntimeError(
            "Set either OPENAI_API_KEY (for OpenAI Realtime) or "
            "GOOGLE_API_KEY (for Gemini Realtime) in your .env file."
        )


def _selected_language(kwargs: dict[str, Any]) -> str:
    for key in ("selected_language", "target_language", "language"):
        value = kwargs.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return os.getenv("TEACHER_TARGET_LANGUAGE", "Spanish").strip() or "Spanish"


def _teacher_instructions(target_language: str) -> str:
    return f"""
You are Duo, a warm and energetic voice language teacher who genuinely loves helping beginners.
You sound like a real human teacher — patient, lively, and present in the conversation.

How you speak:
- One or two short, natural sentences per turn. Never longer.
- Use contractions ("you're", "let's", "that's") and speak with warmth and a light smile in your voice.
- Ask one clear question or give one clear instruction, then stop and wait for the learner to respond.
- No lists, markdown, bullet points, or visual references — everything you say is heard, not read.
- When the learner genuinely gets something right, a quick "Nice!" or "That's it!" is plenty. Don't pile on compliments.

How you teach {target_language}:
- One word or phrase at a time. Give the English meaning first, then say the {target_language} word slowly and clearly.
- Right away, invite them to repeat: "Can you try that?" or "Your turn!"
- Listen carefully to what they actually say, then respond to that before moving on.
- If they stumble: "No worries — let me say it once more," model it again, and invite another try.
- Only move to the next word once the learner has had a real chance to practice the current one.

Stay in scope:
- Teach ONLY this lesson's vocabulary, phrases, and goal. Nothing outside it.
- Teach only {target_language}. Never drift to another language.
- If the learner goes off-topic, smile and bring them gently back to the lesson.
""".strip()


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value

    if hasattr(value, "model_dump"):
        dumped = value.model_dump(mode="json")
        return dumped if isinstance(dumped, dict) else {}

    if hasattr(value, "dict"):
        dumped = value.dict()
        return dumped if isinstance(dumped, dict) else {}

    return {}


def _string_list(items: Any, key: str) -> str:
    if not isinstance(items, list):
        return "None provided."

    lines: list[str] = []
    for item in items:
        data = _as_dict(item)
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            lines.append(f"- {value.strip()}")

    return "\n".join(lines) if lines else "None provided."


def _vocabulary_list(items: Any) -> str:
    if not isinstance(items, list):
        return "None provided."

    lines: list[str] = []
    for item in items:
        data = _as_dict(item)
        term = data.get("term")
        translation = data.get("translation")
        pronunciation = data.get("pronunciation")
        if isinstance(term, str) and isinstance(translation, str):
            detail = f"- {term}: {translation}"
            if isinstance(pronunciation, str) and pronunciation.strip():
                detail += f" ({pronunciation})"
            lines.append(detail)

    return "\n".join(lines) if lines else "None provided."


def _phrase_list(items: Any) -> str:
    if not isinstance(items, list):
        return "None provided."

    lines: list[str] = []
    for item in items:
        data = _as_dict(item)
        text = data.get("text")
        translation = data.get("translation")
        pronunciation = data.get("pronunciation")
        if isinstance(text, str) and isinstance(translation, str):
            detail = f"- {text}: {translation}"
            if isinstance(pronunciation, str) and pronunciation.strip():
                detail += f" ({pronunciation})"
            lines.append(detail)

    return "\n".join(lines) if lines else "None provided."


def _call_custom(payload: Any) -> dict[str, Any]:
    data = _as_dict(payload)
    call_data = _as_dict(data.get("call", data))
    custom = call_data.get("custom")
    return custom if isinstance(custom, dict) else {}


async def _load_call_custom(call: Any) -> dict[str, Any]:
    try:
        response = await call.get()
    except Exception:
        return {}

    return _call_custom(getattr(response, "data", response))


def _teacher_instructions_from_call(custom: dict[str, Any]) -> str:
    lesson = _as_dict(custom.get("lesson"))
    language = _as_dict(custom.get("language"))
    prompt = _as_dict(custom.get("aiTeacherPrompt") or lesson.get("aiTeacherPrompt"))

    target_language = (
        language.get("name")
        if isinstance(language.get("name"), str)
        else _selected_language({})
    )
    lesson_title = lesson.get("title") if isinstance(lesson.get("title"), str) else "this lesson"
    lesson_description = (
        lesson.get("description") if isinstance(lesson.get("description"), str) else ""
    )
    scenario = prompt.get("scenario") if isinstance(prompt.get("scenario"), str) else ""
    system_prompt = (
        prompt.get("systemPrompt") if isinstance(prompt.get("systemPrompt"), str) else ""
    )
    correction_style = (
        prompt.get("correctionStyle")
        if isinstance(prompt.get("correctionStyle"), str)
        else "Correct one issue at a time, then ask the learner to repeat."
    )
    voice_style = (
        prompt.get("voiceStyle")
        if isinstance(prompt.get("voiceStyle"), str)
        else "encouraging and friendly"
    )
    target_phrases_raw = prompt.get("targetPhrases")
    target_phrases = (
        "\n".join(
            f"- {p}" for p in target_phrases_raw if isinstance(p, str) and p.strip()
        )
        if isinstance(target_phrases_raw, list)
        else ""
    )

    base = _teacher_instructions(target_language)

    return f"""
{base}

Current lesson:
- Language: {target_language}
- Lesson: {lesson_title}
- Description: {lesson_description}
- Scenario: {scenario}
- Teaching style: {voice_style}

WORDS TO TEACH — teach ONLY these, in this exact order:
{_vocabulary_list(lesson.get("vocabulary"))}

KEY PHRASE — guide the learner toward this after all vocabulary words:
{_phrase_list(lesson.get("phrases"))}

Teaching prompt:
{system_prompt}

Correction style:
{correction_style}

STRICT RULE: The {target_language} you TEACH must come only from the words and phrases listed above —
in that language, no synonyms, no bonus vocabulary, no words from other lessons or other languages.
If you are unsure whether a {target_language} word belongs here, skip it.
You may still speak English freely for scaffolding: greetings, giving meanings, corrections,
encouragement, and turn-taking ("Can you try that?", "Your turn!").
If the learner asks about something off-topic, smile and redirect them to the next word on the list.
""".strip()


def _opening_prompt(custom: dict[str, Any]) -> str:
    lesson = _as_dict(custom.get("lesson"))
    language = _as_dict(custom.get("language"))
    prompt = _as_dict(custom.get("aiTeacherPrompt") or lesson.get("aiTeacherPrompt"))
    target_language = (
        language.get("name")
        if isinstance(language.get("name"), str)
        else _selected_language({})
    )
    lesson_title = (
        lesson.get("title")
        if isinstance(lesson.get("title"), str)
        else f"{target_language} lesson"
    )

    # Prefer the lesson-specific opening line authored in src/data/lessons.ts
    # so the first turn matches the scenario the learner picked.
    opening_line = prompt.get("openingLine")
    if isinstance(opening_line, str) and opening_line.strip():
        return (
            "Begin speaking immediately and do not wait for learner input. "
            f"You are starting the lesson '{lesson_title}'. Follow this opening "
            f"exactly: {opening_line.strip()} Give one short greeting plus that "
            "first step, then stop and let the learner respond."
        )

    vocabulary = lesson.get("vocabulary")
    first_item = (
        _as_dict(vocabulary[0])
        if isinstance(vocabulary, list) and vocabulary
        else {}
    )
    first_term = first_item.get("term")
    first_translation = first_item.get("translation")

    if isinstance(first_term, str) and isinstance(first_translation, str):
        return (
            "Begin speaking immediately and do not wait for learner input. "
            f"You are starting the lesson '{lesson_title}'. Give one short greeting, "
            f"then teach exactly the first vocabulary item: '{first_term}', meaning "
            f"'{first_translation}'. Say '{first_term}' clearly and ask the learner "
            "to repeat it. Do not introduce any other word or phrase in this turn."
        )

    return (
        "Begin speaking immediately. Do not wait for the learner to say anything. "
        "Open with one short, warm English greeting, then jump straight into the first "
        f"small step of their {target_language} lesson: introduce the first word or "
        "phrase and ask them to try it."
    )


def _build_llm() -> Any:
    """Return the best available realtime LLM based on configured API keys.

    Prefers Gemini when GOOGLE_API_KEY is set (useful when OpenAI quota runs out).
    Falls back to OpenAI Realtime when only OPENAI_API_KEY is available.
    """
    if os.getenv("GOOGLE_API_KEY"):
        gemini_model = os.getenv("GEMINI_REALTIME_MODEL", "gemini-3.1-flash-live-preview")
        return gemini.Realtime(model=gemini_model)

    realtime_model = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime-2")
    realtime_voice = os.getenv("OPENAI_REALTIME_VOICE", "marin")
    return openai.Realtime(model=realtime_model, voice=realtime_voice, send_video=False)


async def create_agent(**kwargs: Any) -> Agent:
    _validate_required_env()

    target_language = _selected_language(kwargs)

    return Agent(
        edge=getstream.Edge(),
        llm=_build_llm(),
        agent_user=User(name="Duo AI Teacher", id="duo-ai-teacher"),
        instructions=_teacher_instructions(target_language),
        broadcast_metrics=True,
        broadcast_metrics_interval=_env_float("AGENT_METRICS_INTERVAL_SECONDS", 10.0),
    )


async def join_call(
    agent: Agent,
    call_type: str,
    call_id: str,
    **kwargs: Any,
) -> None:
    participant_wait_timeout = _env_float("AGENT_PARTICIPANT_WAIT_TIMEOUT", 60.0)

    call = await agent.create_call(call_type, call_id)
    custom = await _load_call_custom(call)
    instructions = _teacher_instructions_from_call(custom)
    agent.instructions = Instructions(input_text=instructions)

    if hasattr(agent.llm, "set_instructions"):
        agent.llm.set_instructions(instructions)

    async with agent.join(call, participant_wait_timeout=participant_wait_timeout):
        # Force the proactive opening turn. With interrupt=False, early microphone
        # input can become the active realtime turn and absorb or delay this prompt.
        await agent.simple_response(_opening_prompt(custom), interrupt=True)
        await agent.finish()


def _launcher() -> AgentLauncher:
    return AgentLauncher(
        create_agent=create_agent,
        join_call=join_call,
        agent_idle_timeout=_env_float("AGENT_IDLE_TIMEOUT_SECONDS", 60.0),
        max_concurrent_sessions=_env_int("AGENT_MAX_CONCURRENT_SESSIONS", 5),
        max_sessions_per_call=_env_int("AGENT_MAX_SESSIONS_PER_CALL", 1),
        max_session_duration_seconds=_env_float(
            "AGENT_MAX_SESSION_DURATION_SECONDS",
            30 * 60.0,
        ),
    )


if __name__ == "__main__":
    Runner(_launcher()).cli()
