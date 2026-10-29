import { useEffect, useRef, useState } from "react";
import { translateTexts } from "../api/analyzePrescription";
import type { Language } from "../i18n/translations";
import { chatTranslationKey, chatTranslationLanguages, originalChatText, savedChatTranslation, type ChatText } from "./chatTranslation";

/** Translations stay on this screen, never overwrite shared messages or cross accounts/rooms. */
export function useChatTranslation(messages: ChatText[], language: Language, scope: string) {
  const cache = useRef({ scope, values: {} as Record<string, string> });
  const [state, setState] = useState({ scope: "", language, pending: false, failed: false, values: {} as Record<string, string> });
  const [attempt, setAttempt] = useState(0);
  const input = JSON.stringify(messages.filter(m => originalChatText(m).trim()).map(m => ({
    id: m.id, text: originalChatText(m), saved: savedChatTranslation(m, language),
  })));
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (cache.current.scope !== scope) cache.current = { scope, values: {} };
    const localCache = cache.current;
    const rows: { id: string; text: string; saved: string }[] = JSON.parse(input);
    const missing = rows.filter(row => !row.saved && !localCache.values[chatTranslationKey(row, language)]);
    const publish = (pending: boolean, failed: boolean) => {
      if (active) setState({ scope, language, pending, failed, values: { ...localCache.values } });
    };
    publish(missing.length > 0, false);
    const timer = setTimeout(async () => {
      try {
        for (let offset = 0; offset < missing.length; offset += 20) {
          if (!active) return;
          const chunk = missing.slice(offset, offset + 20);
          const timeout = setTimeout(() => controller.abort(), 30000);
          try {
            const result = await translateTexts(chunk.map((row, i) => ({ key: String(i), text: row.text })), chatTranslationLanguages[language], controller.signal);
            if (!active) return;
            let incomplete = false;
            chunk.forEach((row, i) => {
              const text = result.translations?.find(item => item.key === String(i))?.translated_text;
              if (typeof text !== "string" || !text.trim()) { incomplete = true; return; }
              localCache.values[chatTranslationKey(row, language)] = text;
            });
            publish(true, false);
            if (incomplete) throw new Error("Incomplete translation");
          } finally { clearTimeout(timeout); }
        }
        publish(false, false);
      } catch { publish(false, true); }
    }, 150);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [input, language, scope, attempt]);
  const current = state.scope === scope && state.language === language;
  return {
    text: (message: ChatText) => savedChatTranslation(message, language)
      || (current ? state.values[chatTranslationKey(message, language)] : "") || originalChatText(message),
    pending: current ? state.pending : messages.some(m => !!originalChatText(m).trim()),
    failed: current && state.failed,
    retry: () => setAttempt(value => value + 1),
  };
}
