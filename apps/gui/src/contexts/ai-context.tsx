import { createContext, useContext } from "react";

type AIContextValue = {
  enabled: boolean;
};

const AIContext = createContext<AIContextValue>({
  enabled: true
});

export const AIProvider = AIContext.Provider;

export const useAI = () => useContext(AIContext);
