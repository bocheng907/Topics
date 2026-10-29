import type { Language } from "../i18n/translations";

export type ChatText = { id: string; text?: string; text_original?: string; [key: string]: unknown };
export const chatLocales: Record<Language, string> = { zh: "zh-TW", en: "en-US", vi: "vi-VN", id: "id-ID" };
export const chatTranslationLanguages: Record<Language, string> = { zh: "Traditional Chinese", en: "English", vi: "Vietnamese", id: "Indonesian" };
export function originalChatText(message: ChatText): string {
  return String(message.text_original || message.text || "");
}
export function chatTranslationKey(message: ChatText, language: Language): string {
  return JSON.stringify([message.id, originalChatText(message), language]);
}
export function savedChatTranslation(message: ChatText, language: Language): string {
  const saved = message[`text_${language}`];
  // Older clients copied every input into text_zh, including foreign languages.
  if (typeof saved !== "string" || !saved.trim()) return "";
  if (language === "zh" && saved === originalChatText(message)) return "";
  return saved;
}
