import type { LanguageId, Lesson } from "@/types/learning";

export const lessons = [
  {
    id: "spanish-greetings",
    unitId: "spanish-basics-1",
    languageId: "spanish",
    title: "Say Hello",
    description: "Learn simple Spanish greetings and polite responses.",
    xpReward: 10,
    estimatedMinutes: 5,
    goals: [
      {
        id: "spanish-greetings-goal-hello",
        title: "Greet someone",
        description: "Say hello, goodbye, and thank you.",
      },
      {
        id: "spanish-greetings-goal-reply",
        title: "Answer politely",
        description: "Reply when someone asks how you are.",
      },
    ],
    vocabulary: [
      {
        id: "hola",
        term: "Hola",
        translation: "Hello",
        pronunciation: "oh-lah",
        example: "Hola, Ana.",
      },
      {
        id: "gracias",
        term: "Gracias",
        translation: "Thank you",
        pronunciation: "grah-see-ahs",
      },
      {
        id: "adios",
        term: "Adios",
        translation: "Goodbye",
        pronunciation: "ah-dee-ohs",
      },
    ],
    phrases: [
      {
        id: "como-estas",
        text: "Como estas?",
        translation: "How are you?",
        pronunciation: "koh-moh ehs-tahs",
        context: "Use with friends or people your age.",
      },
      {
        id: "estoy-bien",
        text: "Estoy bien.",
        translation: "I am well.",
        pronunciation: "ehs-toy bee-ehn",
        context: "A simple positive answer.",
      },
    ],
    activities: [
      {
        id: "spanish-greetings-vocab-hola",
        type: "vocabulary",
        prompt: "What does Hola mean?",
        answer: "Hello",
        vocabularyId: "hola",
      },
      {
        id: "spanish-greetings-choice-como-estas",
        type: "multiple-choice",
        prompt: "Choose the meaning of Como estas?",
        answer: "How are you?",
        phraseId: "como-estas",
        options: [
          { id: "a", text: "How are you?", isCorrect: true },
          { id: "b", text: "Thank you", isCorrect: false },
          { id: "c", text: "Goodbye", isCorrect: false },
        ],
      },
      {
        id: "spanish-greetings-speaking",
        type: "speaking",
        prompt: "Say: Hola, como estas?",
        answer: "Hola, como estas?",
        phraseId: "como-estas",
      },
    ],
    aiTeacherPrompt: {
      mode: "vision-agent-audio",
      scenario: "A friendly AI teacher starts a beginner Spanish greeting lesson.",
      voiceStyle: "Warm, slow, and encouraging with short pauses for repetition.",
      systemPrompt:
        "Teach beginner Spanish greetings in short turns. Ask the learner to repeat one phrase at a time and keep grammar explanations minimal.",
      openingLine: "Hola! I am your Spanish teacher. Let's practice a simple greeting.",
      correctionStyle:
        "Praise effort first, correct one sound or word, then ask the learner to repeat.",
      targetPhrases: ["Hola", "Como estas?", "Estoy bien."],
    },
  },
  {
    id: "spanish-cafe-order",
    unitId: "spanish-food-1",
    languageId: "spanish",
    title: "Order a Drink",
    description: "Ask for water or coffee with please.",
    xpReward: 10,
    estimatedMinutes: 6,
    goals: [
      {
        id: "spanish-cafe-goal-order",
        title: "Order politely",
        description: "Use a simple cafe sentence with please.",
      },
    ],
    vocabulary: [
      {
        id: "agua",
        term: "Agua",
        translation: "Water",
        pronunciation: "ah-gwah",
      },
      {
        id: "cafe",
        term: "Cafe",
        translation: "Coffee",
        pronunciation: "kah-feh",
      },
      {
        id: "por-favor",
        term: "Por favor",
        translation: "Please",
        pronunciation: "por fah-vor",
      },
    ],
    phrases: [
      {
        id: "quiero-agua",
        text: "Quiero agua, por favor.",
        translation: "I want water, please.",
        pronunciation: "kee-eh-roh ah-gwah por fah-vor",
        context: "A simple beginner order.",
      },
    ],
    activities: [
      {
        id: "spanish-cafe-translation-cafe",
        type: "translation",
        prompt: "Translate: Coffee",
        answer: "Cafe",
        vocabularyId: "cafe",
      },
      {
        id: "spanish-cafe-speaking-water",
        type: "speaking",
        prompt: "Say: Quiero agua, por favor.",
        answer: "Quiero agua, por favor.",
        phraseId: "quiero-agua",
      },
    ],
    aiTeacherPrompt: {
      mode: "audio",
      scenario: "The learner is ordering a drink at a small cafe.",
      voiceStyle: "Patient cafe roleplay voice with simple back-and-forth turns.",
      systemPrompt:
        "Guide the learner through a short cafe roleplay in Spanish. Keep sentences under eight words and focus on confidence.",
      openingLine: "Imagine we are at a cafe. Ask me for water in Spanish.",
      correctionStyle:
        "Correct only the most important word first, then model the full sentence naturally.",
      targetPhrases: ["Quiero agua, por favor.", "Quiero cafe, por favor."],
    },
  },
  {
    id: "french-greetings",
    unitId: "french-basics-1",
    languageId: "french",
    title: "Bonjour",
    description: "Start a friendly conversation in French.",
    xpReward: 10,
    estimatedMinutes: 5,
    goals: [
      {
        id: "french-greetings-goal-hello",
        title: "Say hello",
        description: "Use hello, goodbye, and thank you in French.",
      },
    ],
    vocabulary: [
      {
        id: "bonjour",
        term: "Bonjour",
        translation: "Hello",
        pronunciation: "bohn-zhoor",
      },
      {
        id: "merci",
        term: "Merci",
        translation: "Thank you",
        pronunciation: "mehr-see",
      },
      {
        id: "au-revoir",
        term: "Au revoir",
        translation: "Goodbye",
        pronunciation: "oh ruh-vwahr",
      },
    ],
    phrases: [
      {
        id: "comment-ca-va",
        text: "Comment ca va?",
        translation: "How is it going?",
        pronunciation: "koh-mahn sah vah",
        context: "A casual way to ask how someone is.",
      },
    ],
    activities: [
      {
        id: "french-greetings-vocab-bonjour",
        type: "vocabulary",
        prompt: "What does Bonjour mean?",
        answer: "Hello",
        vocabularyId: "bonjour",
      },
      {
        id: "french-greetings-speaking",
        type: "speaking",
        prompt: "Say: Bonjour, comment ca va?",
        answer: "Bonjour, comment ca va?",
        phraseId: "comment-ca-va",
      },
    ],
    aiTeacherPrompt: {
      mode: "audio",
      scenario: "A warm first French lesson about greetings.",
      voiceStyle: "Calm, clear, and rhythmic with careful pronunciation modeling.",
      systemPrompt:
        "Teach French greetings slowly. Focus on rhythm and make the learner repeat bonjour and merci.",
      openingLine: "Bonjour! Let's practice your first French greeting.",
      correctionStyle:
        "Keep feedback short. Model the phrase once, then ask for another try.",
      targetPhrases: ["Bonjour", "Comment ca va?", "Merci"],
    },
  },
  {
    id: "french-cafe-order",
    unitId: "french-cafe-1",
    languageId: "french",
    title: "Cafe Order",
    description: "Ask for coffee or water in French.",
    xpReward: 10,
    estimatedMinutes: 6,
    goals: [
      {
        id: "french-cafe-goal-order",
        title: "Order a drink",
        description: "Use je voudrais to make a polite request.",
      },
    ],
    vocabulary: [
      {
        id: "eau",
        term: "Eau",
        translation: "Water",
        pronunciation: "oh",
      },
      {
        id: "cafe-fr",
        term: "Cafe",
        translation: "Coffee",
        pronunciation: "kah-fay",
      },
      {
        id: "sil-vous-plait",
        term: "S'il vous plait",
        translation: "Please",
        pronunciation: "seel voo pleh",
      },
    ],
    phrases: [
      {
        id: "je-voudrais-cafe",
        text: "Je voudrais un cafe, s'il vous plait.",
        translation: "I would like a coffee, please.",
        pronunciation: "zhuh voo-dray un kah-fay seel voo pleh",
        context: "A polite cafe order.",
      },
    ],
    activities: [
      {
        id: "french-cafe-vocab-please",
        type: "vocabulary",
        prompt: "What does S'il vous plait mean?",
        answer: "Please",
        vocabularyId: "sil-vous-plait",
      },
      {
        id: "french-cafe-speaking-order",
        type: "speaking",
        prompt: "Say: Je voudrais un cafe, s'il vous plait.",
        answer: "Je voudrais un cafe, s'il vous plait.",
        phraseId: "je-voudrais-cafe",
      },
    ],
    aiTeacherPrompt: {
      mode: "vision-agent-audio",
      scenario: "The learner orders coffee from a French cafe worker.",
      voiceStyle: "Friendly cafe worker, slow enough for a beginner to copy.",
      systemPrompt:
        "Act as a patient French cafe worker. Keep the roleplay short and help with polite pronunciation.",
      openingLine: "Bienvenue! What would you like to order in French?",
      correctionStyle:
        "Repeat the correct phrase naturally and explain one pronunciation point at a time.",
      targetPhrases: ["Je voudrais un cafe.", "S'il vous plait."],
    },
  },
  {
    id: "japanese-greetings",
    unitId: "japanese-basics-1",
    languageId: "japanese",
    title: "First Greetings",
    description: "Say hello, thank you, and introduce yourself in Japanese.",
    xpReward: 12,
    estimatedMinutes: 7,
    goals: [
      {
        id: "japanese-greetings-goal-greet",
        title: "Use basic greetings",
        description: "Recognize and say short Japanese greetings in romaji.",
      },
      {
        id: "japanese-greetings-goal-name",
        title: "Say your name",
        description: "Use a simple self-introduction phrase.",
      },
    ],
    vocabulary: [
      {
        id: "konnichiwa",
        term: "Konnichiwa",
        translation: "Hello",
        pronunciation: "kohn-nee-chee-wah",
      },
      {
        id: "arigato",
        term: "Arigato",
        translation: "Thank you",
        pronunciation: "ah-ree-gah-toh",
      },
      {
        id: "watashi",
        term: "Watashi",
        translation: "I / me",
        pronunciation: "wah-tah-shee",
      },
    ],
    phrases: [
      {
        id: "watashi-wa-alex-desu",
        text: "Watashi wa Alex desu.",
        translation: "I am Alex.",
        pronunciation: "wah-tah-shee wah Alex dess",
        context: "A simple beginner self-introduction.",
      },
    ],
    activities: [
      {
        id: "japanese-greetings-choice-konnichiwa",
        type: "multiple-choice",
        prompt: "Choose the meaning of Konnichiwa.",
        answer: "Hello",
        vocabularyId: "konnichiwa",
        options: [
          { id: "a", text: "Goodbye", isCorrect: false },
          { id: "b", text: "Hello", isCorrect: true },
          { id: "c", text: "Water", isCorrect: false },
        ],
      },
      {
        id: "japanese-greetings-speaking-intro",
        type: "speaking",
        prompt: "Say: Watashi wa Alex desu.",
        answer: "Watashi wa Alex desu.",
        phraseId: "watashi-wa-alex-desu",
      },
    ],
    aiTeacherPrompt: {
      mode: "audio",
      scenario: "The learner practices first Japanese greetings with romanized help.",
      voiceStyle: "Gentle, precise, and syllable-by-syllable for beginners.",
      systemPrompt:
        "Teach beginner Japanese with short romanized phrases. Avoid grammar overload and focus on pronunciation confidence.",
      openingLine: "Konnichiwa! Let's practice saying hello in Japanese.",
      correctionStyle:
        "Use slow syllable-by-syllable correction, then say the full phrase once more.",
      targetPhrases: ["Konnichiwa", "Arigato", "Watashi wa Alex desu."],
    },
  },
  {
    id: "korean-greetings",
    unitId: "korean-basics-1",
    languageId: "korean",
    title: "Friendly Hello",
    description: "Use simple Korean greetings and thanks with romanized support.",
    xpReward: 12,
    estimatedMinutes: 6,
    goals: [
      {
        id: "korean-greetings-goal-hello",
        title: "Say hello",
        description: "Greet someone politely and say thank you.",
      },
    ],
    vocabulary: [
      {
        id: "annyeonghaseyo",
        term: "Annyeonghaseyo",
        translation: "Hello",
        pronunciation: "ahn-nyawng-hah-seh-yoh",
      },
      {
        id: "gamsahamnida",
        term: "Gamsahamnida",
        translation: "Thank you",
        pronunciation: "gahm-sah-hahm-nee-dah",
      },
      {
        id: "ne",
        term: "Ne",
        translation: "Yes",
        pronunciation: "neh",
      },
    ],
    phrases: [
      {
        id: "mannaseo-bangapseumnida",
        text: "Mannaseo bangapseumnida.",
        translation: "Nice to meet you.",
        pronunciation: "mahn-nah-saw bahn-gahp-seum-nee-dah",
        context: "A polite first-meeting phrase.",
      },
    ],
    activities: [
      {
        id: "korean-greetings-vocab-hello",
        type: "vocabulary",
        prompt: "What does Annyeonghaseyo mean?",
        answer: "Hello",
        vocabularyId: "annyeonghaseyo",
      },
      {
        id: "korean-greetings-speaking-thanks",
        type: "speaking",
        prompt: "Say: Gamsahamnida.",
        answer: "Gamsahamnida.",
        vocabularyId: "gamsahamnida",
      },
    ],
    aiTeacherPrompt: {
      mode: "vision-agent-audio",
      scenario: "A friendly Korean teacher helps the learner say their first greeting.",
      voiceStyle: "Slow, supportive, and focused on clear syllables.",
      systemPrompt:
        "Teach beginner Korean greetings using romanized phrases. Keep each turn short and ask for repetition.",
      openingLine: "Annyeonghaseyo! Let's practice a friendly Korean hello.",
      correctionStyle:
        "Break longer words into syllables, then rebuild the full phrase naturally.",
      targetPhrases: ["Annyeonghaseyo", "Gamsahamnida", "Mannaseo bangapseumnida."],
    },
  },
] as const satisfies Lesson[];

export const lessonsById = Object.fromEntries(
  lessons.map((lesson) => [lesson.id, lesson]),
) as Record<(typeof lessons)[number]["id"], (typeof lessons)[number]>;

export const lessonsByLanguageId = lessons.reduce(
  (groups, lesson) => {
    groups[lesson.languageId] = [...(groups[lesson.languageId] ?? []), lesson];
    return groups;
  },
  {} as Partial<Record<LanguageId, ((typeof lessons)[number])[]>>,
);
