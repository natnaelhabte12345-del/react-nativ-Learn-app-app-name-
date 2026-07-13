import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, type StateStorage } from "zustand/middleware";

const serverStorage: StateStorage = {
  getItem: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};

export function createAppPersistStorage() {
  return createJSONStorage(() =>
    typeof window === "undefined" ? serverStorage : AsyncStorage,
  );
}
