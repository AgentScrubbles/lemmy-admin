import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

export interface LoginRequest {
  username_or_email: string;
  password: string;
  totp_2fa_token?: string;
}

export interface LoginResponse {
  jwt?: string;
  registration_created: boolean;
  verify_email_sent: boolean;
}

export interface LocalUser {
  id: number;
  person_id: number;
  email?: string;
  admin: boolean;
  show_nsfw: boolean;
  theme: string;
  default_sort_type: string;
  default_listing_type: string;
  interface_language: string;
  show_avatars: boolean;
  send_notifications_to_email: boolean;
  show_scores: boolean;
  show_bot_accounts: boolean;
  show_read_posts: boolean;
  email_verified: boolean;
  accepted_application: boolean;
  totp_2fa_enabled: boolean;
  open_links_in_new_tab: boolean;
}

export interface Person {
  id: number;
  name: string;
  display_name?: string;
  avatar?: string;
  banned: boolean;
  published: string;
  updated?: string;
  actor_id: string;
  bio?: string;
  local: boolean;
  banner?: string;
  deleted: boolean;
  inbox_url: string;
  matrix_user_id?: string;
  admin: boolean;
  bot_account: boolean;
  ban_expires?: string;
}

export interface PersonCounts {
  id: number;
  person_id: number;
  post_count: number;
  post_score?: number;
  comment_count: number;
  comment_score?: number;
}

export interface Community {
  id: number;
  name: string;
  title: string;
  description?: string;
  removed: boolean;
  published: string;
  updated?: string;
  deleted: boolean;
  nsfw: boolean;
  actor_id: string;
  local: boolean;
  icon?: string;
  banner?: string;
  hidden: boolean;
  posting_restricted_to_mods: boolean;
  instance_id: number;
}

export interface CommunityCounts {
  id: number;
  community_id: number;
  subscribers: number;
  posts: number;
  comments: number;
  published: string;
  users_active_day: number;
  users_active_week: number;
  users_active_month: number;
  users_active_half_year: number;
  hot_rank: number;
}

export interface CommunityView {
  community: Community;
  counts: CommunityCounts;
  subscribed: string;
  blocked: boolean;
}

export interface CommunityModeratorView {
  community: Community;
  moderator: Person;
}

export interface SiteStats {
  id: number;
  site_id: number;
  users: number;
  posts: number;
  comments: number;
  communities: number;
  users_active_day: number;
  users_active_week: number;
  users_active_month: number;
  users_active_half_year: number;
}

export interface Site {
  id: number;
  name: string;
  sidebar?: string;
  published: string;
  updated?: string;
  icon?: string;
  banner?: string;
  description?: string;
  actor_id: string;
  last_refreshed_at: string;
  inbox_url: string;
  public_key: string;
  instance_id: number;
}

export interface SiteView {
  site: Site;
  local_site: any;
  local_site_rate_limit: any;
  counts: SiteStats;
}

export interface MyUserInfo {
  local_user_view: {
    local_user: LocalUser;
    person: Person;
    counts: PersonCounts;
  };
  follows: any[];
  moderates: CommunityModeratorView[];
  community_blocks: any[];
  person_blocks: any[];
  instance_blocks: any[];
  discussion_languages: number[];
}

export interface GetSiteResponse {
  site_view: SiteView;
  admins: any[];
  version: string;
  my_user?: MyUserInfo;
  all_languages: any[];
  discussion_languages: any[];
  taglines: any[];
  custom_emojis: any[];
}

export interface GetCommunityResponse {
  community_view: CommunityView;
  site?: Site;
  moderators: CommunityModeratorView[];
  discussion_languages: number[];
}

export interface ListCommunitiesParams {
  type_?: 'All' | 'Local' | 'Subscribed';
  sort?: 'Active' | 'Hot' | 'New' | 'Old' | 'TopDay' | 'TopWeek' | 'TopMonth' | 'TopYear' | 'TopAll';
  page?: number;
  limit?: number;
}

export interface ListCommunitiesResponse {
  communities: CommunityView[];
}

export interface GetPostsParams {
  type_?: 'All' | 'Local' | 'Subscribed';
  sort?: 'Active' | 'Hot' | 'New' | 'Old' | 'TopDay' | 'TopWeek' | 'TopMonth' | 'TopYear' | 'TopAll';
  page?: number;
  limit?: number;
  community_id?: number;
  community_name?: string;
}

export interface PostCounts {
  id: number;
  post_id: number;
  comments: number;
  score: number;
  upvotes: number;
  downvotes: number;
  published: string;
  newest_comment_time_necro: string;
  newest_comment_time: string;
  featured_community: boolean;
  featured_local: boolean;
  hot_rank: number;
  hot_rank_active: number;
  community_id: number;
  creator_id: number;
}

export interface Post {
  id: number;
  name: string;
  url?: string;
  body?: string;
  creator_id: number;
  community_id: number;
  removed: boolean;
  locked: boolean;
  published: string;
  updated?: string;
  deleted: boolean;
  nsfw: boolean;
  embed_title?: string;
  embed_description?: string;
  thumbnail_url?: string;
  ap_id: string;
  local: boolean;
  embed_video_url?: string;
  language_id: number;
  featured_community: boolean;
  featured_local: boolean;
}

export interface PostView {
  post: Post;
  creator: Person;
  community: Community;
  creator_banned_from_community: boolean;
  counts: PostCounts;
  subscribed: string;
  saved: boolean;
  read: boolean;
  creator_blocked: boolean;
  my_vote?: number;
  unread_comments: number;
}

export interface GetPostsResponse {
  posts: PostView[];
}

export interface CommentCounts {
  id: number;
  comment_id: number;
  score: number;
  upvotes: number;
  downvotes: number;
  published: string;
  child_count: number;
}

export interface Comment {
  id: number;
  creator_id: number;
  post_id: number;
  content: string;
  removed: boolean;
  published: string;
  updated?: string;
  deleted: boolean;
  ap_id: string;
  local: boolean;
  path: string;
  distinguished: boolean;
  language_id: number;
}

export interface CommentView {
  comment: Comment;
  creator: Person;
  post: Post;
  community: Community;
  counts: CommentCounts;
  creator_banned_from_community: boolean;
  subscribed: string;
  saved: boolean;
  creator_blocked: boolean;
  my_vote?: number;
}

export interface GetCommentsParams {
  type_?: 'All' | 'Local' | 'Subscribed';
  sort?: 'Hot' | 'Top' | 'New' | 'Old';
  max_depth?: number;
  page?: number;
  limit?: number;
  community_id?: number;
  community_name?: string;
  post_id?: number;
  parent_id?: number;
  saved_only?: boolean;
  liked_only?: boolean;
  disliked_only?: boolean;
}

export interface GetCommentsResponse {
  comments: CommentView[];
}

export interface PersonView {
  person: Person;
  counts: PersonCounts;
}

export interface GetPersonDetailsParams {
  person_id?: number;
  username?: string;
  sort?: 'Active' | 'Hot' | 'New' | 'Old' | 'TopDay' | 'TopWeek' | 'TopMonth' | 'TopYear' | 'TopAll';
  page?: number;
  limit?: number;
  community_id?: number;
  saved_only?: boolean;
}

export interface GetPersonDetailsResponse {
  person_view: PersonView;
  posts: PostView[];
  comments: CommentView[];
  moderates: CommunityModeratorView[];
}

export interface SearchParams {
  q: string;
  type_?: 'All' | 'Comments' | 'Posts' | 'Communities' | 'Users' | 'Url';
  community_id?: number;
  community_name?: string;
  creator_id?: number;
  sort?: 'Active' | 'Hot' | 'New' | 'Old' | 'TopDay' | 'TopWeek' | 'TopMonth' | 'TopYear' | 'TopAll';
  listing_type?: 'All' | 'Local' | 'Subscribed';
  page?: number;
  limit?: number;
}

export interface SearchResponse {
  type_: string;
  comments: CommentView[];
  posts: PostView[];
  communities: CommunityView[];
  users: PersonView[];
}

// Admin action request/response interfaces
export interface BanPersonRequest {
  person_id: number;
  ban: boolean;
  remove_data?: boolean;
  reason?: string;
  expires?: number; // Unix timestamp
}

export interface BanPersonResponse {
  person_view: PersonView;
  banned: boolean;
}

export interface RemovePostRequest {
  post_id: number;
  removed: boolean;
  reason?: string;
}

export interface RemovePostResponse {
  post_view: PostView;
}

export interface RemoveCommentRequest {
  comment_id: number;
  removed: boolean;
  reason?: string;
}

export interface RemoveCommentResponse {
  comment_view: CommentView;
}

export interface PurgePersonRequest {
  person_id: number;
  reason?: string;
}

export interface PurgePersonResponse {
  success: boolean;
}

export interface PurgePostRequest {
  post_id: number;
  reason?: string;
}

export interface PurgePostResponse {
  success: boolean;
}

export interface PurgeCommentRequest {
  comment_id: number;
  reason?: string;
}

export interface PurgeCommentResponse {
  success: boolean;
}

class LemmyService {
  private api: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: `${config.lemmyInstanceUrl}/api/v3`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage on initialization
    const savedToken = localStorage.getItem('lemmy_auth_token');
    if (savedToken) {
      this.setAuthToken(savedToken);
    }

    // Add request interceptor to include auth token
    this.api.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
    if (token) {
      localStorage.setItem('lemmy_auth_token', token);
    } else {
      localStorage.removeItem('lemmy_auth_token');
    }
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>('/user/login', credentials);
    if (response.data.jwt) {
      this.setAuthToken(response.data.jwt);
    }
    return response.data;
  }

  async getSite(): Promise<GetSiteResponse> {
    const response = await this.api.get<GetSiteResponse>('/site');
    return response.data;
  }

  async logout() {
    // Optionally call the logout endpoint
    try {
      await this.api.post('/user/logout');
    } catch (error) {
      console.error('Error logging out:', error);
    }
    this.setAuthToken(null);
  }

  async getCommunity(params: { id?: number; name?: string }): Promise<GetCommunityResponse> {
    const response = await this.api.get<GetCommunityResponse>('/community', { params });
    return response.data;
  }

  async listCommunities(params?: ListCommunitiesParams): Promise<ListCommunitiesResponse> {
    const response = await this.api.get<ListCommunitiesResponse>('/community/list', { params });
    return response.data;
  }

  async getPosts(params?: GetPostsParams): Promise<GetPostsResponse> {
    const response = await this.api.get<GetPostsResponse>('/post/list', { params });
    return response.data;
  }

  async getComments(params?: GetCommentsParams): Promise<GetCommentsResponse> {
    const response = await this.api.get<GetCommentsResponse>('/comment/list', { params });
    return response.data;
  }

  async getPersonDetails(params: GetPersonDetailsParams): Promise<GetPersonDetailsResponse> {
    const response = await this.api.get<GetPersonDetailsResponse>('/user', { params });
    return response.data;
  }

  async search(params: SearchParams): Promise<SearchResponse> {
    const response = await this.api.get<SearchResponse>('/search', { params });
    return response.data;
  }

  // Admin Actions
  async banPerson(data: BanPersonRequest): Promise<BanPersonResponse> {
    const response = await this.api.post<BanPersonResponse>('/user/ban', data);
    return response.data;
  }

  async removePost(data: RemovePostRequest): Promise<RemovePostResponse> {
    const response = await this.api.post<RemovePostResponse>('/post/remove', data);
    return response.data;
  }

  async removeComment(data: RemoveCommentRequest): Promise<RemoveCommentResponse> {
    const response = await this.api.post<RemoveCommentResponse>('/comment/remove', data);
    return response.data;
  }

  async purgePerson(data: PurgePersonRequest): Promise<PurgePersonResponse> {
    const response = await this.api.post<PurgePersonResponse>('/admin/purge/person', data);
    return response.data;
  }

  async purgePost(data: PurgePostRequest): Promise<PurgePostResponse> {
    const response = await this.api.post<PurgePostResponse>('/admin/purge/post', data);
    return response.data;
  }

  async purgeComment(data: PurgeCommentRequest): Promise<PurgeCommentResponse> {
    const response = await this.api.post<PurgeCommentResponse>('/admin/purge/comment', data);
    return response.data;
  }

  isAuthenticated(): boolean {
    return this.authToken !== null;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }
}

export const lemmyService = new LemmyService();
