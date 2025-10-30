export const config = {
  lemmyInstanceUrl: import.meta.env.VITE_LEMMY_INSTANCE_URL || 'https://poptalk.scrubbles.tech',
  backendApiUrl: import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001',
} as const;
