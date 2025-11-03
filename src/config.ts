// Use runtime environment variables (set by Docker) or fall back to build-time variables (for local dev)
declare global {
  interface Window {
    __env__?: {
      VITE_LEMMY_INSTANCE_URL?: string;
      VITE_BACKEND_API_URL?: string;
      VITE_OPENAI_API_URL?: string;
      VITE_OPENAI_API_KEY?: string;
    };
  }
}

export const config = {
  lemmyInstanceUrl: window.__env__?.VITE_LEMMY_INSTANCE_URL || import.meta.env.VITE_LEMMY_INSTANCE_URL || 'https://poptalk.scrubbles.tech',
  backendApiUrl: window.__env__?.VITE_BACKEND_API_URL || import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001',
  openaiApiUrl: window.__env__?.VITE_OPENAI_API_URL || import.meta.env.VITE_OPENAI_API_URL || undefined,
  openaiApiKey: window.__env__?.VITE_OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY || undefined,
} as const;

// Debug: Log config on startup
console.log('App Config:', {
  lemmyInstanceUrl: config.lemmyInstanceUrl,
  backendApiUrl: config.backendApiUrl,
  openaiApiUrl: config.openaiApiUrl,
  hasOpenaiApiKey: !!config.openaiApiKey,
  usingRuntimeConfig: !!window.__env__,
});
