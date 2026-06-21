import type { ImageSourcePropType } from "react-native";

import type { LessonImageKey } from "@/types/learning";

export const images = {
  aiTeacherUiReference: require("../../prompt_material/07-audio-lesson-screen.png"),
  appleAuthLogo: require("@/assets/images/apple-auth-logo.png"),
  earth: require("@/assets/images/earth.png"),
  flagChinese: require("@/assets/images/flags/flag-chinese.png"),
  flagFrench: require("@/assets/images/flags/flag-french.png"),
  flagGerman: require("@/assets/images/flags/flag-german.png"),
  flagJapanese: require("@/assets/images/flags/flag-japanese.png"),
  flagKorean: require("@/assets/images/flags/flag-korean.png"),
  flagSpanish: require("@/assets/images/flags/flag-spanish.png"),
  googleAuthLogo: require("@/assets/images/google-auth-logo.png"),
  languageWorld: require("@/assets/images/language-world-full.png"),
  lessonCafeHero: require("@/assets/images/lesson-cafe-hero-reference.png"),
  lessonCafeScene: require("@/assets/images/lesson-cafe-scene.png"),
  lessonPlaceholder: {
    uri: "https://picsum.photos/seed/fluentflow-lesson/320/240",
  },
  mascotAuth: require("@/assets/images/mascot-auth.png"),
  mascotLogo: require("@/assets/images/moscot-logo.png"),
  mascotWelcome: require("@/assets/images/mascot-welcome.png"),
  palace: require("@/assets/images/palace.png"),
  seeAllLanguagesButton: require("@/assets/images/see-all-languages-button.png"),
  streakFire: require("@/assets/images/streak-fire.png"),
  tabAiTeacherActive: require("@/assets/images/tabIcons/ref-tab-ai-teacher-active.png"),
  tabAiTeacher: require("@/assets/images/tabIcons/ref-tab-ai-teacher.png"),
  tabChatActive: require("@/assets/images/tabIcons/ref-tab-chat-active.png"),
  tabChat: require("@/assets/images/tabIcons/ref-tab-chat.png"),
  tabHomeActive: require("@/assets/images/tabIcons/ref-tab-home-active.png"),
  tabHome: require("@/assets/images/tabIcons/ref-tab-home.png"),
  tabLearnActive: require("@/assets/images/tabIcons/ref-tab-learn-active.png"),
  tabLearn: require("@/assets/images/tabIcons/ref-tab-learn.png"),
  tabProfileActive: require("@/assets/images/tabIcons/ref-tab-profile-active.png"),
  tabProfile: require("@/assets/images/tabIcons/ref-tab-profile.png"),
  teacherPortrait: require("@/assets/images/mascot-welcome.png"),
  treasure: require("@/assets/images/treasure.png"),
};

// Each lesson uses its own bundled illustration so the thumbnails stay on-brand
// (no stock photos). The Picsum `lessonPlaceholder` only covers unknown keys.
export const lessonImageSources = {
  lessonCafe: images.palace,
  lessonDailyLife: images.languageWorld,
  lessonFamily: images.mascotLogo,
  lessonGreetings: images.mascotWelcome,
  lessonShopping: images.treasure,
  lessonTravel: images.earth,
} satisfies Record<LessonImageKey, ImageSourcePropType>;

export function getLessonImageSource(
  imageKey: LessonImageKey | string | null | undefined,
): ImageSourcePropType {
  if (imageKey && imageKey in lessonImageSources) {
    return lessonImageSources[imageKey as LessonImageKey];
  }

  return images.lessonPlaceholder;
}
