from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from vision_agents.core.instructions import Instructions
from vision_agents.core import Agent, AgentLauncher, Runner, User
from vision_agents.plugins import gemini, getstream, openai


SERVICE_DIR = Path(__file__).resolve().parent

# Only load Vision Agent-specific environment variables.
# Do NOT load the root .env to prevent exposing unrelated secrets (Clerk, OpenAI, etc.).
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
- Only say "Nice!" or "That's it!" when they actually got it right. Never praise a wrong or half-right attempt — that teaches the wrong sound. If it's close but off, say so honestly ("Close — but it's actually…") before modeling it again.

How you teach {target_language}:
- One word or phrase at a time. Give the English meaning first, then say the {target_language} word slowly and clearly.
- Right away, invite them to repeat: "Can you try that?" or "Your turn!"
- Listen carefully to what they actually say, then judge it honestly: correct, close, or off. Only confirm it's right when it actually is.
- If they stumble or get it wrong, don't move on: say "No worries — let me say it once more," model it again, and invite another try.
- Give up to 3 real attempts per word. If they still don't have it after 3 tries, say so plainly and warmly ("We'll come back to this one") — don't pretend it was correct — then move to the next word.
- Only move to the next word once they've actually said it correctly, or you've used all 3 attempts.

Keep it short:
- This is a quick 2-3 minute lesson, not a long class. Keep a brisk pace once each word is actually landed.

Stay in scope:
- Teach ONLY this lesson's vocabulary, phrases, and goal. Nothing outside it.
- Teach only {target_language}. Never drift to another language.
- If the learner goes off-topic, smile and bring them gently back to the lesson.

Wrapping up:
- Once the learner has practiced every word and managed the key phrase, give one warm,
  short congratulation: tell them they did it and finished the lesson.
- If one or more words needed 3 attempts and still weren't right, name them so the
  learner knows what to revisit: say the exact phrase "Let's practice these again:"
  followed by just those words in {target_language}, separated by commas — nothing
  else in that sentence. Skip this line entirely if everything was said correctly.
- Then clearly let them know they can hang up whenever they're ready (for example:
  "That's the whole lesson — you can hang up whenever you like, or stay and practice more").
- Don't start teaching new material after the congratulation. Keep it brief and let them go.
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


def _lesson_plan(lesson: dict[str, Any]) -> str:
    """Build the exact, ordered teaching plan from the same vocabulary and key
    phrase the learner sees on the lesson screen. A numbered step list keeps the
    realtime model from drifting to random words — it must walk these in order.
    """
    steps: list[str] = []

    vocabulary = lesson.get("vocabulary")
    if isinstance(vocabulary, list):
        for item in vocabulary:
            data = _as_dict(item)
            term = data.get("term")
            translation = data.get("translation")
            if not (isinstance(term, str) and isinstance(translation, str)):
                continue
            pronunciation = data.get("pronunciation")
            pron = (
                f', pronounced "{pronunciation.strip()}"'
                if isinstance(pronunciation, str) and pronunciation.strip()
                else ""
            )
            steps.append(
                f'Teach the word "{term}" — it means "{translation}"{pron}. '
                f'Give the English meaning, say "{term}" slowly and clearly, then ask '
                "the learner to repeat it and respond to their attempt before moving on."
            )

    phrases = lesson.get("phrases")
    first_phrase = (
        _as_dict(phrases[0]) if isinstance(phrases, list) and phrases else {}
    )
    phrase_text = first_phrase.get("text")
    phrase_translation = first_phrase.get("translation")
    if isinstance(phrase_text, str) and isinstance(phrase_translation, str):
        steps.append(
            f'Put it all together: guide the learner to say the key phrase '
            f'"{phrase_text}" — it means "{phrase_translation}". Build up to it, '
            "then have them say the whole phrase."
        )

    if not steps:
        return (
            "No specific lesson content was provided — keep the learner gently on "
            "basic greetings and do not invent new vocabulary."
        )

    return "\n".join(f"Step {index + 1}. {step}" for index, step in enumerate(steps))


def _call_custom(payload: Any) -> dict[str, Any]:
    # getstream 3.x returns StreamResponse[GetCallResponse], where both
    # GetCallResponse and its nested CallResponse are dataclasses.
    response_data = getattr(payload, "data", payload)
    call_response = getattr(response_data, "call", None)
    custom = getattr(call_response, "custom", None)
    if isinstance(custom, dict):
        return custom

    data = _as_dict(response_data)
    call_data = _as_dict(data.get("call", data))
    custom = call_data.get("custom")
    return custom if isinstance(custom, dict) else {}


async def _load_call_custom(call: Any) -> dict[str, Any]:
    try:
        response = await call.get()
    except Exception:
        return {}

    return _call_custom(response)


def _pedagogy_from_custom(custom: dict[str, Any]) -> dict[str, Any]:
    lesson = _as_dict(custom.get("lesson"))
    return _as_dict(custom.get("pedagogy") or lesson.get("pedagogy"))


def _format_chunk_list(chunks: Any) -> str:
    lines: list[str] = []
    if isinstance(chunks, list):
        for item in chunks:
            data = _as_dict(item)
            text = data.get("text")
            translation = data.get("translation")
            if not (isinstance(text, str) and isinstance(translation, str)):
                continue
            pron = data.get("pronunciation")
            pron_str = (
                f" [{pron.strip()}]"
                if isinstance(pron, str) and pron.strip()
                else ""
            )
            lines.append(f'- "{text}"{pron_str} — {translation}')
    return "\n".join(lines)


def _format_dialogue(dialogue: Any) -> str:
    out: list[str] = []
    if isinstance(dialogue, list):
        for line in dialogue:
            data = _as_dict(line)
            text = data.get("text")
            translation = data.get("translation")
            if not (isinstance(text, str) and isinstance(translation, str)):
                continue
            who = "You (other person)" if data.get("speaker") == "a" else "Learner"
            out.append(f'  {who}: "{text}" ({translation})')
    return "\n".join(out)


def _format_retrieval(prompts: Any) -> str:
    out: list[str] = []
    if isinstance(prompts, list):
        for index, item in enumerate(prompts):
            data = _as_dict(item)
            cue = data.get("cue")
            expected = data.get("expected")
            if not (isinstance(cue, str) and isinstance(expected, str)):
                continue
            scaffold = data.get("scaffold")
            scaffold_str = (
                f' (only if they freeze, offer the start: "{scaffold.strip()}")'
                if isinstance(scaffold, str) and scaffold.strip()
                else ""
            )
            out.append(
                f'  {index + 1}. Say in English: {cue} '
                f'Target answer: "{expected}".{scaffold_str}'
            )
    return "\n".join(out)


def _pedagogy_instructions(custom: dict[str, Any]) -> str:
    """Build the 5-phase lesson script (hook -> modeled input -> guided
    retrieval with recasting -> embedded review -> free task) for migrated
    lessons that carry a `pedagogy` block in call.custom."""
    lesson = _as_dict(custom.get("lesson"))
    language = _as_dict(custom.get("language"))
    pedagogy = _pedagogy_from_custom(custom)

    target_language = (
        language.get("name")
        if isinstance(language.get("name"), str)
        else _selected_language({})
    )
    lesson_title = (
        lesson.get("title") if isinstance(lesson.get("title"), str) else "this lesson"
    )
    can_do = pedagogy.get("canDo") if isinstance(pedagogy.get("canDo"), str) else ""
    hook = (
        pedagogy.get("situationHook")
        if isinstance(pedagogy.get("situationHook"), str)
        else ""
    )

    chunk_list = _format_chunk_list(pedagogy.get("targetChunks"))
    dialogue_text = _format_dialogue(pedagogy.get("dialogue"))
    retrieval_text = _format_retrieval(pedagogy.get("guidedRetrieval"))
    review = pedagogy.get("reviewChunks")
    review_text = (
        _format_chunk_list(review)
        if isinstance(review, list) and review
        else "(nothing to review — this is the first lesson)"
    )

    free_task = _as_dict(pedagogy.get("freeTask"))
    task_goal = (
        free_task.get("goal") if isinstance(free_task.get("goal"), str) else ""
    )
    task_twist = (
        free_task.get("twist") if isinstance(free_task.get("twist"), str) else ""
    )
    criteria = free_task.get("successCriteria")
    criteria_text = (
        "\n".join(
            f"  - {c}" for c in criteria if isinstance(c, str)
        )
        if isinstance(criteria, list) and criteria
        else "  - The learner completes the task."
    )

    return f"""
You are Duo, a warm, human {target_language} teacher running a short spoken lesson.
One or two short, natural sentences per turn, then stop and let the learner talk.
Speak English for instructions, meanings, and encouragement; use {target_language}
only for the chunks being taught.

LESSON: "{lesson_title}" ({target_language})
By the end, the learner can: {can_do}

Run the lesson in FIVE phases, in order. Advance only when the current phase is
done. Keep the whole lesson to about 12 minutes.

PHASE 1 — SET THE SCENE (this is your opening turn)
Paint this situation in one or two warm English sentences, then move into Phase 2:
{hook}

PHASE 2 — MODEL EACH CHUNK, ECHO IT RIGHT AWAY (one chunk per turn)
New words don't stick from a single listen — go one chunk at a time: say it once,
slowly and clearly, give its English meaning, then immediately invite them to echo
it ("Can you try that?"). Wait for their attempt before introducing the next chunk —
never string two new chunks together in the same turn, and never recite the full
exchange below in one breath. This is a light echo, not a test: if they're close,
model it once more and move on — the harder retrieval happens in Phase 3.
{chunk_list}

Once every chunk above has been echoed at least once, voice the short exchange below
so they hear the chunks flow together naturally in context. Keep this quick — it's a
recap of what they just practiced, not new material.
{dialogue_text}

PHASE 3 — GUIDED RETRIEVAL (one prompt per turn)
Have the learner produce each chunk. Give the English cue, wait, and judge what they
actually say honestly — correct, close, or off. Only confirm success ("Nice!", "That's
it!") when it's genuinely right; never say "Nice" while also correcting them, that
teaches the wrong sound. When they slip, RECAST without false praise — model the
correct form plainly ("Not quite — it's '…'. Try it") — never lecture grammar, never
interrupt mid-sentence. Offer the scaffold only if they freeze. Give each chunk up to
3 real attempts; if still wrong after 3, say so honestly ("We'll come back to this
one") and move on — don't pretend it was correct.
{retrieval_text}

PHASE 4 — EMBEDDED REVIEW
Weave these earlier chunks back into the scene (not as a quiz):
{review_text}

PHASE 5 — FREE TASK (the real point)
Run a short unscripted roleplay; you play the other person. Don't coach mid-task —
let them try. Introduce the curveball once.
Task: {task_goal}
Curveball: {task_twist}
Success = they accomplish it:
{criteria_text}

WRAP UP
When the task is done, give one short, genuine congratulation, name what they can
now do. If one or more chunks needed 3 attempts in Phase 3 and still weren't right,
name them so the learner knows what to revisit: say the exact phrase "Let's practice
these again:" followed by just those chunks in {target_language}, separated by
commas — nothing else in that sentence. Skip this line if everything landed. Then
tell them they can hang up whenever they like. No new material after.

HARD RULES
- Teach only the chunks above plus the review chunks. No other new {target_language}.
- One instruction or question per turn, then stop and listen.
- Recast errors; don't explain grammar. Only praise what was actually correct.
""".strip()


def _pedagogy_opening(custom: dict[str, Any]) -> str:
    pedagogy = _pedagogy_from_custom(custom)
    hook = (
        pedagogy.get("situationHook")
        if isinstance(pedagogy.get("situationHook"), str)
        else ""
    )
    first_chunk = ""
    chunks = pedagogy.get("targetChunks")
    if isinstance(chunks, list) and chunks:
        first = _as_dict(chunks[0])
        text = first.get("text")
        translation = first.get("translation")
        if isinstance(text, str) and isinstance(translation, str):
            first_chunk = (
                f' Then start Phase 2: say "{text}" ({translation}) slowly, '
                "and immediately invite them to echo it back before anything else."
            )

    return (
        "Begin speaking immediately; do not wait for the learner. "
        "Open with Phase 1 — set the scene in one or two warm English sentences: "
        f"{hook}{first_chunk} Keep it short, then continue the lesson."
    )


def _teacher_instructions_from_call(custom: dict[str, Any]) -> str:
    # Migrated lessons carry a 5-phase pedagogy block — use the richer script.
    if _pedagogy_from_custom(custom):
        return _pedagogy_instructions(custom)

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
    correction_style = (
        prompt.get("correctionStyle")
        if isinstance(prompt.get("correctionStyle"), str)
        else "Cheer the effort first, gently fix one word or sound, then invite another try."
    )
    voice_style = (
        prompt.get("voiceStyle")
        if isinstance(prompt.get("voiceStyle"), str)
        else "encouraging and friendly"
    )

    lesson_plan = _lesson_plan(lesson)

    base = _teacher_instructions(target_language)

    return f"""
{base}

THIS LESSON — "{lesson_title}" ({target_language})
{lesson_description}
Scenario: {scenario}
Teaching voice: {voice_style}

YOUR LESSON PLAN — these are exactly the items the learner sees on their screen for
this lesson. Teach them strictly in this order, ONE step per turn. Do not skip a step,
do not reorder them, do not merge two steps into one turn, and do not end the lesson
until every step below is done:

{lesson_plan}

HARD RULES:
- The ONLY {target_language} you may teach are the words and the key phrase in the plan above, exactly as written. No synonyms, no extra vocabulary, no words from other lessons or other languages.
- Work through the steps in order. Never jump ahead to a later word or to the key phrase before the learner has practiced the current step.
- {correction_style}
- You may speak English freely for meanings, encouragement, corrections, and turn-taking ("Can you try that?", "Your turn!").
- If the learner goes off-topic, smile, give one short reply, then bring them straight back to the current step.
""".strip()


def _opening_prompt(custom: dict[str, Any]) -> str:
    # Migrated lessons open with the situation hook (Phase 1).
    if _pedagogy_from_custom(custom):
        return _pedagogy_opening(custom)

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
