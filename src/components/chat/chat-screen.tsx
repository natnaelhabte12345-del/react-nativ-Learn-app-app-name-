import { useAuth } from "@clerk/expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { defaultLanguageId } from "@/data/languages";
import { ApiError, postJson } from "@/lib/api";
import { useLanguageStore } from "@/store/language-store";

// The floating tab bar is absolutely positioned over the bottom of the screen,
// so the input row needs this much bottom clearance to sit above it. When the
// keyboard opens the tab bar hides itself, so we collapse the gap to a small value.
const TAB_BAR_CLEARANCE = 100;
const KEYBOARD_OPEN_PADDING = 12;

type Message = {
  content: string;
  id: string;
  role: "assistant" | "user";
};

const welcomeMessages = {
  chinese: "你好！(Hello!) I'm Duo. What would you like to practice in Mandarin today?",
  french: "Bonjour ! (Hello!) I'm Duo. What would you like to practice in French today?",
  german: "Hallo! (Hello!) I'm Duo. What would you like to practice in German today?",
  japanese: "こんにちは！(Hello!) I'm Duo. What would you like to practice in Japanese today?",
  korean: "안녕하세요! (Hello!) I'm Duo. What would you like to practice in Korean today?",
  spanish: "¡Hola! (Hello!) I'm Duo. What would you like to practice in Spanish today?",
} as const;

function makeId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function ChatScreen() {
  const { getToken } = useAuth();
  const selectedLanguageId =
    useLanguageStore((state) => state.selectedLanguageId) ?? defaultLanguageId;
  const [messages, setMessages] = useState<Message[]>(() => [
    makeWelcomeMessage(selectedLanguageId),
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    setMessages([makeWelcomeMessage(selectedLanguageId)]);
    setErrorText(null);
  }, [selectedLanguageId]);

  // The tab bar hides on keyboard open, so collapse the input's bottom clearance
  // to avoid a large empty gap above the keyboard while typing.
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () =>
      setIsKeyboardOpen(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setIsKeyboardOpen(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  async function handleSend() {
    const text = inputText.trim();

    if (!text || isLoading) return;

    const userMsg: Message = { content: text, id: makeId(), role: "user" };
    setInputText("");
    setErrorText(null);
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      let token: string | null = null;
      try {
        token = await getToken();
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to get Clerk token:", error);
        }
        setErrorText("Authentication error. Please sign out and sign in again.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (!token) {
        setErrorText("Not authenticated. Please sign in.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      // Build history excluding the static welcome message
      const historyMessages = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ content: m.content, role: m.role }));

      const result = await postJson<{ content: string }>(
        "/api/chat",
        { languageId: selectedLanguageId, messages: historyMessages },
        { token },
      );

      const aiMsg: Message = {
        content: result.content,
        id: makeId(),
        role: "assistant",
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 503
          ? "Chat is not configured. Add GROQ_API_KEY to the server environment."
          : err instanceof Error
            ? err.message
            : "Couldn't get a reply. Please try again.";
      setErrorText(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text className="flex-1 text-[19px] leading-[25px] font-poppins-semibold text-text-primary">
          Chat with Duo
        </Text>
        <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-[#F4F0FF]">
          <Text className="text-[18px]">🦜</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        className="flex-1 px-4"
        contentContainerStyle={styles.messageList}
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={({ item }) => <MessageBubble message={item} />}
        showsVerticalScrollIndicator={false}
      />

      {errorText ? (
        <View className="mx-4 mb-2 rounded-[12px] bg-[#FFF0F0] px-4 py-3">
          <Text className="text-[13px] leading-[19px] font-poppins-regular text-[#D14343]">
            {errorText}
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.inputRow,
            {
              paddingBottom: isKeyboardOpen
                ? KEYBOARD_OPEN_PADDING
                : TAB_BAR_CLEARANCE,
            },
          ]}
        >
          <TextInput
            editable={!isLoading}
            multiline
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#9AA1B3"
            style={styles.textInput}
            value={inputText}
          />
          <TouchableOpacity
            activeOpacity={0.82}
            disabled={isLoading || !inputText.trim()}
            onPress={() => void handleSend()}
            style={[
              styles.sendButton,
              inputText.trim() && !isLoading
                ? styles.sendButtonActive
                : styles.sendButtonDisabled,
            ]}
          >
            {isLoading ? (
              <Ionicons color="#9AA1B3" name="ellipsis-horizontal" size={20} />
            ) : (
              <Ionicons
                color={inputText.trim() ? "#FFFFFF" : "#9AA1B3"}
                name="arrow-up"
                size={20}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeWelcomeMessage(languageId: keyof typeof welcomeMessages): Message {
  return {
    content: welcomeMessages[languageId],
    id: "welcome",
    role: "assistant",
  };
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAi,
      ]}
    >
      {!isUser ? (
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>🦜</Text>
        </View>
      ) : null}
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
          isUser ? styles.userBubbleShadow : styles.aiBubbleShadow,
        ]}
      >
        <Text style={isUser ? styles.userBubbleText : styles.aiBubbleText}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  aiBubble: {
    backgroundColor: "#FFFFFF",
    borderColor: "#EEF1F7",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  aiBubbleShadow: {
    elevation: 2,
    shadowColor: "#0D132B",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  aiBubbleText: {
    color: "#0D132B",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  avatarCircle: {
    alignItems: "center",
    backgroundColor: "#F4F0FF",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    marginRight: 8,
    marginTop: 4,
    width: 30,
  },
  avatarEmoji: {
    fontSize: 14,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    marginBottom: 12,
  },
  bubbleRowAi: {
    justifyContent: "flex-start",
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#EEF1F7",
    borderBottomWidth: 1,
    flexDirection: "row",
    height: 52,
    paddingHorizontal: 20,
  },
  inputRow: {
    alignItems: "flex-end",
    backgroundColor: "#FFFFFF",
    borderTopColor: "#EEF1F7",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  messageList: {
    paddingBottom: 8,
    paddingTop: 16,
  },
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    marginLeft: 10,
    width: 44,
  },
  sendButtonActive: {
    backgroundColor: "#5B3BF6",
    elevation: 3,
    shadowColor: "#321D93",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
  },
  sendButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  textInput: {
    borderColor: "#E5E7EB",
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "#F6F7FB",
    color: "#0D132B",
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: "#5B3BF6",
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  userBubbleShadow: {
    elevation: 3,
    shadowColor: "#321D93",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
  },
  userBubbleText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
});
