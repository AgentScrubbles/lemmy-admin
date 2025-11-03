import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

// Backend API service for direct database queries
class BackendAPIService {
  private api: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: config.backendApiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  // Health check
  async healthCheck() {
    const response = await this.api.get('/health');
    return response.data;
  }

  // User Analytics Endpoints

  async getUserDetails(userId: number) {
    const response = await this.api.get(`/users/${userId}/details`);
    return response.data;
  }

  async getVotingPatterns(userId: number, communityId?: number) {
    const response = await this.api.get(`/users/${userId}/voting-patterns`, {
      params: communityId ? { communityId } : {},
    });
    return response.data;
  }

  async getActivityTimeline(userId: number, weeks: number = 12, communityId?: number) {
    const response = await this.api.get(`/users/${userId}/activity-timeline`, {
      params: {
        weeks,
        ...(communityId && { communityId }),
      },
    });
    return response.data;
  }

  async getCommunityBreakdown(userId: number) {
    const response = await this.api.get(`/users/${userId}/community-breakdown`);
    return response.data;
  }

  async getRecentContent(
    userId: number,
    options?: {
      communityId?: number;
      limit?: number;
      type?: 'posts' | 'comments';
    }
  ) {
    const response = await this.api.get(`/users/${userId}/recent-content`, {
      params: options || {},
    });
    return response.data;
  }

  async getBehaviorAnalysis(userId: number, communityId?: number) {
    const response = await this.api.get(`/users/${userId}/behavior-analysis`, {
      params: communityId ? { communityId } : {},
    });
    return response.data;
  }

  async searchUsers(query: string, limit: number = 20) {
    const response = await this.api.get(`/users/search/${encodeURIComponent(query)}`, {
      params: { limit },
    });
    return response.data;
  }

  async lookupUserByHandle(userHandle: string) {
    const response = await this.api.get(`/users/lookup/${encodeURIComponent(userHandle)}`);
    return response.data;
  }

  async lookupCommunityByHandle(communityHandle: string) {
    const response = await this.api.get(`/users/lookup-community/${encodeURIComponent(communityHandle)}`);
    return response.data;
  }
}

// Export singleton instance
export const backendAPI = new BackendAPIService();

// TypeScript interfaces for backend responses
export interface UserDetails {
  id: number;
  name: string;
  display_name: string | null;
  avatar: string | null;
  published_at: string;
  bio: string | null;
  local: boolean;
  bot_account: boolean;
  deleted: boolean;
  banned: boolean;
  post_count: number;
  post_score: number;
  comment_count: number;
  comment_score: number;
  instance_id: number;
  instance_domain: string;
}

export interface VotingPatterns {
  votesGiven: {
    upvotes: number;
    downvotes: number;
    total: number;
    upvoteRate: number;
  };
  votesReceived: {
    posts: {
      upvotes: number;
      downvotes: number;
      score: number;
    };
    comments: {
      upvotes: number;
      downvotes: number;
      score: number;
    };
    // Legacy fields for backward compatibility
    postScore: number;
    commentScore: number;
    totalScore: number;
  };
}

export interface ActivityTimelinePoint {
  week: string;
  posts: number;
  comments: number;
  totalScore: number;
  upvotes: number;
  downvotes: number;
}

export interface CommunityBreakdown {
  community_id: number;
  community_name: string;
  community_title: string;
  instance_domain: string;
  post_count: string;
  comment_count: string;
  post_score: string;
  comment_score: string;
  last_activity: string;
}

export interface RecentPost {
  id: number;
  name: string;
  url: string | null;
  published_at: string;
  score: number;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  community_id: number;
  community_name: string;
  community_title: string;
  instance_domain: string;
}

export interface RecentComment {
  id: number;
  content: string;
  published_at: string;
  score: number;
  upvotes: number;
  downvotes: number;
  post_id: number;
  post_name: string;
  community_id: number;
  community_name: string;
  community_title: string;
  instance_domain: string;
}

export interface RecentContent {
  posts: RecentPost[];
  comments: RecentComment[];
}

export interface BehaviorAnalysis {
  behaviorType: 'troll' | 'controversial' | 'contributor' | 'neutral';
  behaviorScore: number;
  metrics: {
    totalPosts: number;
    totalComments: number;
    negativePosts: number;
    negativeComments: number;
    negativeRate: number;
    avgControversy: number;
  };
}
