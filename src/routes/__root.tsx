import { createRootRoute, Outlet } from "@tanstack/react-router";
import { BrowserPreviewProvider } from "../app/components/BrowserPreviewProvider";
import { RootErrorBoundary } from "../app/components/RootErrorBoundary";
import { AuthenticatedProviders } from "../components/AuthenticatedProviders";
import { AuthProvider } from "../components/AuthProvider";
import { CluSessionsProvider } from "../components/CluSessionsProvider";
import { ThemeProvider } from "../components/ThemeProvider";
import { Toaster } from "../components/ui/sonner";
import { VoiceFab } from "../components/VoiceMode";
import { LinguiClientProvider } from "../lib/i18n/LinguiProvider";

export const Route = createRootRoute({
  component: () => (
    <RootErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <LinguiClientProvider>
            <AuthenticatedProviders>
              <CluSessionsProvider>
                <BrowserPreviewProvider>
                  <Outlet />
                  <VoiceFab />
                </BrowserPreviewProvider>
              </CluSessionsProvider>
            </AuthenticatedProviders>
          </LinguiClientProvider>
        </AuthProvider>
      </ThemeProvider>
      <Toaster position="top-right" />
    </RootErrorBoundary>
  ),
});
