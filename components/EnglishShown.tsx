"use client";

import { createContext, useContext, type ReactNode } from "react";

// Closed by default: a layout that forgets the provider shows no language switch rather than one
// that leads nowhere while English is hidden.
const EnglishShownContext = createContext(false);

/** Hands the server's showEnglish() to client components such as the language switch. */
export function EnglishShownProvider({ shown, children }: { shown: boolean; children: ReactNode }) {
  return <EnglishShownContext.Provider value={shown}>{children}</EnglishShownContext.Provider>;
}

export function useEnglishShown(): boolean {
  return useContext(EnglishShownContext);
}
