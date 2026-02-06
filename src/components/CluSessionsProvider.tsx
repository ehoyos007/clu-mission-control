import {
  createContext,
  type FC,
  type PropsWithChildren,
  useContext,
} from "react";
import {
  type UseCluSessionsResult,
  useCluSessions,
} from "@/hooks/useCluSessions";

const CluSessionsContext = createContext<UseCluSessionsResult | null>(null);

export const CluSessionsProvider: FC<PropsWithChildren> = ({ children }) => {
  const cluSessions = useCluSessions();

  return (
    <CluSessionsContext.Provider value={cluSessions}>
      {children}
    </CluSessionsContext.Provider>
  );
};

export const useCluSessionsContext = (): UseCluSessionsResult => {
  const context = useContext(CluSessionsContext);
  if (!context) {
    // Return a default state if provider is not found (graceful degradation)
    return {
      sessions: [],
      loading: false,
      error: null,
      isConfigured: false,
      refresh: async () => {},
      getSessionOwner: () => undefined,
      markAsClu: async () => null,
      updateSession: async () => null,
    };
  }
  return context;
};
