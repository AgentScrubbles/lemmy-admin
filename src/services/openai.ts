import { config } from '../config';
import { RecentContent } from './backend';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatCompletionRequest {
  model?: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class OpenAIService {
  private apiUrl: string | undefined;
  private apiKey: string | undefined;

  constructor() {
    this.apiUrl = config.openaiApiUrl;
    this.apiKey = config.openaiApiKey;
  }

  /**
   * Check if the OpenAI service is configured and available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiUrl) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      console.warn('OpenAI service is not available:', error);
      return false;
    }
  }

  /**
   * Create a chat completion
   */
  async createChatCompletion(
    request: OpenAIChatCompletionRequest
  ): Promise<OpenAIChatCompletionResponse> {
    if (!this.apiUrl) {
      throw new Error('OpenAI API URL is not configured');
    }

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({
        model: request.model || 'gpt-3.5-turbo',
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 500,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Smartly sample content to fit within context window
   * For 24GB VRAM, we can handle more context
   */
  sampleContent(recentContent: RecentContent, maxItems: number = 40): string {
    const posts = recentContent.posts.slice(0, Math.floor(maxItems * 0.4)); // 40% posts
    const comments = recentContent.comments.slice(0, Math.floor(maxItems * 0.6)); // 60% comments

    let content = '';

    if (posts.length > 0) {
      content += 'Recent Posts:\n';
      posts.forEach((post, i) => {
        content += `${i + 1}. "${post.name}" (Score: ${post.score}, ${post.comment_count} comments)\n`;
      });
      content += '\n';
    }

    if (comments.length > 0) {
      content += 'Recent Comments:\n';
      comments.forEach((comment, i) => {
        // Truncate long comments to 400 characters for more context
        const truncated = comment.content.length > 400
          ? comment.content.substring(0, 400) + '...'
          : comment.content;
        content += `${i + 1}. "${truncated}" (Score: ${comment.score})\n`;
      });
    }

    return content;
  }

  /**
   * Generate a summary of user's activity
   */
  async summarizeUserActivity(
    username: string,
    recentContent: RecentContent,
    onProgress?: (message: string) => void
  ): Promise<string> {
    try {
      onProgress?.('Checking AI service availability...');

      const available = await this.isAvailable();
      if (!available) {
        throw new Error('AI service is not available');
      }

      onProgress?.('Sampling user content...');
      const sampledContent = this.sampleContent(recentContent);

      if (!sampledContent.trim()) {
        return 'This user has no recent content to summarize.';
      }

      onProgress?.('Generating summary...');

      const response = await this.createChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant helping moderators understand user behavior patterns. Provide concise, objective summaries focusing on: main topics discussed, tone/sentiment, engagement level, and any notable patterns. Keep it under 150 words.',
          },
          {
            role: 'user',
            content: `Summarize this user's recent activity on Lemmy:\n\nUsername: ${username}\n\n${sampledContent}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      onProgress?.('Summary complete!');

      return response.choices[0]?.message?.content || 'No summary generated.';
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }
}

export const openaiService = new OpenAIService();
