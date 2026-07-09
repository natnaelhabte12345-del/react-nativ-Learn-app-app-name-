import type { PostHog } from "posthog-react-native";

import type { LanguageId } from "@/types/learning";

// Single source of truth for the PostHog tracking schema. Every screen calls
// these helpers with the already-initialized PostHog instance from
// usePostHog(), so we never re-create the client and event names/properties
// stay consistent across the app.

/**
 * Associate the current PostHog person with the Clerk user id.
 *
 * `$set` runs on every identify, so `preferred_language` is always brought up
 * to date (and corrected if the learner changes language). `$set_once` only
 * records the very first time we ever identify this user, which is why
 * `signup_date` is captured exactly once — at sign-up — and never overwritten.
 */
export function identifyUser(
  posthog: PostHog,
  distinctId: string,
  preferredLanguage: LanguageId | null,
) {
  posthog.identify(distinctId, {
    $set: { preferred_language: preferredLanguage },
    $set_once: { signup_date: new Date().toISOString() },
  });
}

export function trackLanguageSelected(
  posthog: PostHog,
  properties: { language_code: string; language_name: string },
) {
  posthog.capture("language_selected", properties);
}

export function trackLessonStarted(
  posthog: PostHog,
  properties: { lesson_id: string; language: string; lesson_number: number },
) {
  posthog.capture("lesson_started", properties);
}

export function trackLessonAbandoned(
  posthog: PostHog,
  properties: {
    lesson_id: string;
    time_into_lesson_seconds: number;
    last_question_index: number;
  },
) {
  posthog.capture("lesson_abandoned", properties);
}

export function trackLessonCompleted(
  posthog: PostHog,
  properties: {
    lesson_id: string;
    language: string;
    spoken_turns: number;
    xp_reward: number;
  },
) {
  posthog.capture("lesson_completed", properties);
}

// Fired when the learner finishes a personalized review/practice session, so
// their recall performance is visible in analytics alongside lesson activity.
export function trackPracticeCompleted(
  posthog: PostHog,
  properties: {
    language: string;
    mode: "lesson" | "review";
    total: number;
    correct: number;
    missed: number;
  },
) {
  posthog.capture("practice_completed", properties);
}
