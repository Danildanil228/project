import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";

// Shared cache for all useQuery calls. Defaults: 30s staleTime so navigating back to a page
// shows cached data instantly and refetches in the background. Important side-effect: under
// StrictMode duplicate mounts share the cache, so identical concurrent requests dedupe to one.
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
                <App />
            </ThemeProvider>
        </QueryClientProvider>
    </StrictMode>,
);
