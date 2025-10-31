export const config = {
  lemmyInstanceUrl: import.meta.env.VITE_LEMMY_INSTANCE_URL || 'https://poptalk.scrubbles.tech',
  backendApiUrl: import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001',
  openaiApiUrl: import.meta.env.VITE_OPENAI_API_URL || undefined,
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || undefined,
} as const;

// Debug: Log OpenAI config on startup
console.log('OpenAI Config:', {
  apiUrl: config.openaiApiUrl,
  hasApiKey: !!config.openaiApiKey,
});
