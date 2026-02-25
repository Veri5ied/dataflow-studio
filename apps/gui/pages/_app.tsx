import type { AppProps } from "next/app";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/query-client";
import { AuthProvider } from "../src/contexts/auth-context";
import { WorkspaceProvider } from "../src/contexts/workspace-context";
import { AIProvider } from "../src/contexts/ai-context";
import "../styles/globals.css";

export default function DataFlowApp({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider value={{ isAuthenticated: false }}>
        <WorkspaceProvider value={{}}>
          <AIProvider value={{ enabled: true }}>
            <Component {...pageProps} />
          </AIProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
