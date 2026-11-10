import React from "react";
import { Text, View, type StyleProp, type TextStyle } from "react-native";
import type { Language } from "@/src/i18n/translations";
import { chatTranslationCopy } from "./ChatTranslationStatus";

/** Preserve the sender's exact wording whenever a translated version is displayed. */
export function TranslatedChatText({ original, translated, language, textStyle, originalStyle }: {
  original: string; translated: string; language: Language;
  textStyle?: StyleProp<TextStyle>; originalStyle?: StyleProp<TextStyle>;
}) {
  return <View>
    <Text style={textStyle}>{translated || original}</Text>
    {translated && original && translated.trim() !== original.trim() ? (
      <Text style={originalStyle}>{chatTranslationCopy[language].original}: {original}</Text>
    ) : null}
  </View>;
}
