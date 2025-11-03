import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Autocomplete,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link as MuiLink,
  CircularProgress,
  Alert,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  TrendingUp,
  Article,
  Forum,
  Block,
  Warning,
  ThumbUp,
  ThumbDown,
  Balance,
  FilterAlt,
  CheckCircle,
  Dangerous,
  Help,
  Gavel,
  Delete,
  RemoveCircle,
  Restore,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  backendAPI,
  UserDetails,
  VotingPatterns,
  ActivityTimelinePoint,
  CommunityBreakdown,
  RecentContent,
  BehaviorAnalysis,
} from '../services/backend';
import { lemmyService } from '../services/lemmy';
import { openaiService } from '../services/openai';
import { config } from '../config';
import { useAuth } from '../contexts/AuthContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface UserSearchResult {
  id: number;
  name: string;
  display_name: string | null;
  avatar: string | null;
  post_count: number;
  comment_count: number;
  local: boolean;
  bot_account: boolean;
  instance_domain: string;
}

export const Users: React.FC = () => {
  const { user: authUser } = useAuth();
  const { userHandle } = useParams<{ userHandle?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserHandle, setSelectedUserHandle] = useState<string | null>(null);

  // User data from backend
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [votingPatterns, setVotingPatterns] = useState<VotingPatterns | null>(null);
  const [activityTimeline, setActivityTimeline] = useState<ActivityTimelinePoint[]>([]);
  const [communityBreakdown, setCommunityBreakdown] = useState<CommunityBreakdown[]>([]);
  const [recentContent, setRecentContent] = useState<RecentContent | null>(null);
  const [behaviorAnalysis, setBehaviorAnalysis] = useState<BehaviorAnalysis | null>(null);

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [communityFilter, setCommunityFilter] = useState<number | 'all'>('all');

  // Loading progress tracking
  interface LoadingStep {
    name: string;
    status: 'pending' | 'loading' | 'complete' | 'error';
  }
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([
    { name: 'User Details', status: 'pending' },
    { name: 'Voting Patterns', status: 'pending' },
    { name: 'Activity Timeline', status: 'pending' },
    { name: 'Community Breakdown', status: 'pending' },
    { name: 'Recent Content', status: 'pending' },
    { name: 'Behavior Analysis', status: 'pending' },
  ]);

  const updateStepStatus = (stepName: string, status: LoadingStep['status']) => {
    setLoadingSteps(prev => prev.map(step =>
      step.name === stepName ? { ...step, status } : step
    ));
  };

  const loadingProgress = useMemo(() => {
    const completed = loadingSteps.filter(s => s.status === 'complete').length;
    return Math.round((completed / loadingSteps.length) * 100);
  }, [loadingSteps]);

  // Content safety settings
  const [hideOffensiveContent, setHideOffensiveContent] = useState(false);
  const [blurLowScoreImages, setBlurLowScoreImages] = useState(true);

  // Confirmation dialogs
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [purgeReason, setPurgeReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Track removed content
  const [removedPosts, setRemovedPosts] = useState<Set<number>>(new Set());
  const [removedComments, setRemovedComments] = useState<Set<number>>(new Set());

  // AI Summary state
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  // Search for users with backend API
  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const results = await backendAPI.searchUsers(searchTerm, 20);
        setSearchResults(results);
      } catch (err) {
        console.error('Error searching users:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  // Load user from URL parameter on mount
  useEffect(() => {
    const loadUserFromURL = async () => {
      if (!userHandle) return;

      try {
        const user = await backendAPI.lookupUserByHandle(userHandle);
        setSelectedUserId(user.id);
        setSelectedUserHandle(`${user.name}@${user.instance_domain}`);
      } catch (err) {
        console.error('Error loading user from URL:', err);
        setError(`User not found: ${userHandle}`);
      }
    };

    loadUserFromURL();
  }, [userHandle]);

  // Load community filter from URL parameter
  useEffect(() => {
    const loadCommunityFromURL = async () => {
      const communityParam = searchParams.get('community');
      if (!communityParam) {
        setCommunityFilter('all');
        return;
      }

      try {
        const community = await backendAPI.lookupCommunityByHandle(communityParam);
        setCommunityFilter(community.id);
      } catch (err) {
        console.error('Error loading community from URL:', err);
        // Don't show error, just default to 'all'
        setCommunityFilter('all');
      }
    };

    loadCommunityFromURL();
  }, [searchParams]);

  // Fetch all user data when selected
  useEffect(() => {
    const fetchUserData = async () => {
      if (!selectedUserId) return;

      setLoading(true);
      setError(null);

      // Reset all steps to pending
      setLoadingSteps([
        { name: 'User Details', status: 'pending' },
        { name: 'Voting Patterns', status: 'pending' },
        { name: 'Activity Timeline', status: 'pending' },
        { name: 'Community Breakdown', status: 'pending' },
        { name: 'Recent Content', status: 'pending' },
        { name: 'Behavior Analysis', status: 'pending' },
      ]);

      try {
        const communityFilterId = communityFilter !== 'all' ? communityFilter : undefined;

        // Fetch data with individual tracking
        updateStepStatus('User Details', 'loading');
        const details = await backendAPI.getUserDetails(selectedUserId);
        setUserDetails(details);

        // Set user handle for URL
        if (!selectedUserHandle) {
          setSelectedUserHandle(`${details.name}@${details.instance_domain}`);
        }

        updateStepStatus('User Details', 'complete');

        updateStepStatus('Voting Patterns', 'loading');
        const voting = backendAPI.getVotingPatterns(selectedUserId, communityFilterId);

        updateStepStatus('Activity Timeline', 'loading');
        const timeline = backendAPI.getActivityTimeline(selectedUserId, 12, communityFilterId);

        updateStepStatus('Community Breakdown', 'loading');
        const communities = communityFilter === 'all'
          ? backendAPI.getCommunityBreakdown(selectedUserId)
          : (() => { updateStepStatus('Community Breakdown', 'complete'); return Promise.resolve([]); })();

        updateStepStatus('Recent Content', 'loading');
        const content = backendAPI.getRecentContent(selectedUserId, { communityId: communityFilterId, limit: 50 });

        updateStepStatus('Behavior Analysis', 'loading');
        const behavior = backendAPI.getBehaviorAnalysis(selectedUserId, communityFilterId);

        // Wait for all to complete and update status
        const [votingResult, timelineResult, communitiesResult, contentResult, behaviorResult] = await Promise.all([
          voting.then(r => { updateStepStatus('Voting Patterns', 'complete'); return r; }).catch(e => { updateStepStatus('Voting Patterns', 'error'); throw e; }),
          timeline.then(r => { updateStepStatus('Activity Timeline', 'complete'); return r; }).catch(e => { updateStepStatus('Activity Timeline', 'error'); throw e; }),
          communities.then(r => { updateStepStatus('Community Breakdown', 'complete'); return r; }).catch(e => { updateStepStatus('Community Breakdown', 'error'); throw e; }),
          content.then(r => { updateStepStatus('Recent Content', 'complete'); return r; }).catch(e => { updateStepStatus('Recent Content', 'error'); throw e; }),
          behavior.then(r => { updateStepStatus('Behavior Analysis', 'complete'); return r; }).catch(e => { updateStepStatus('Behavior Analysis', 'error'); throw e; }),
        ]);

        setVotingPatterns(votingResult);
        setActivityTimeline(timelineResult);
        if (communityFilter === 'all' && communitiesResult.length > 0) {
          setCommunityBreakdown(communitiesResult);
        }
        setRecentContent(contentResult);
        setBehaviorAnalysis(behaviorResult);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [selectedUserId, communityFilter]);

  // Update URL when user or community filter changes
  useEffect(() => {
    if (!selectedUserHandle) return;

    // Build new URL
    let newPath = `/users/${encodeURIComponent(selectedUserHandle)}`;

    // Add community query parameter if set
    const params = new URLSearchParams();
    if (communityFilter !== 'all' && communityBreakdown.length > 0) {
      const selectedCommunity = communityBreakdown.find(cb => cb.community_id === communityFilter);
      if (selectedCommunity) {
        params.set('community', `${selectedCommunity.community_name}@${selectedCommunity.instance_domain}`);
      }
    }

    const queryString = params.toString();
    const fullPath = queryString ? `${newPath}?${queryString}` : newPath;

    // Update URL without adding to history if we're already on the right page
    if (window.location.pathname + window.location.search !== fullPath) {
      navigate(fullPath, { replace: true });
    }
  }, [selectedUserHandle, communityFilter, communityBreakdown, navigate]);

  // Check AI service availability when config is set
  useEffect(() => {
    const checkAiAvailability = async () => {
      if (!config.openaiApiUrl) {
        setAiAvailable(false);
        return;
      }

      try {
        const available = await openaiService.isAvailable();
        setAiAvailable(available);
      } catch (error) {
        console.error('Error checking AI availability:', error);
        setAiAvailable(false);
      }
    };

    checkAiAvailability();
  }, []);

  // Auto-generate AI summary when user data is loaded
  useEffect(() => {
    if (aiAvailable === true && userDetails && recentContent && !aiSummary && !aiGenerating && !aiError) {
      generateAISummary();
    }
  }, [aiAvailable, userDetails, recentContent]);

  // Generate AI summary when user data is loaded
  const generateAISummary = async () => {
    if (!userDetails || !recentContent || !aiAvailable) return;

    setAiGenerating(true);
    setAiError(null);
    setAiSummary(null);
    setAiProgress('Initializing...');

    try {
      const summary = await openaiService.summarizeUserActivity(
        `${userDetails.name}@${userDetails.instance_domain}`,
        recentContent,
        (message) => setAiProgress(message)
      );

      setAiSummary(summary);
    } catch (error) {
      console.error('Error generating AI summary:', error);
      setAiError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setAiGenerating(false);
      setAiProgress('');
    }
  };

  // Admin action handlers
  const handleBanUser = async () => {
    if (!userDetails) return;

    setActionLoading(true);
    try {
      await lemmyService.banPerson({
        person_id: userDetails.id,
        ban: !userDetails.banned,
        reason: banReason || undefined,
        remove_data: false,
      });

      setSuccess(userDetails.banned ? 'User unbanned successfully' : 'User banned successfully');
      setBanDialogOpen(false);
      setBanReason('');

      // Refresh user data
      const details = await backendAPI.getUserDetails(userDetails.id);
      setUserDetails(details);
    } catch (err) {
      console.error('Error banning user:', err);
      setError('Failed to ban/unban user. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurgeUser = async () => {
    if (!userDetails) return;

    setActionLoading(true);
    try {
      await lemmyService.purgePerson({
        person_id: userDetails.id,
        reason: purgeReason || undefined,
      });

      setSuccess('User purged successfully. All their content has been removed.');
      setPurgeDialogOpen(false);
      setPurgeReason('');

      // Clear selected user
      setSelectedUserId(null);
      setUserDetails(null);
    } catch (err) {
      console.error('Error purging user:', err);
      setError('Failed to purge user. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePost = async (postId: number, currentlyRemoved: boolean) => {
    setActionLoading(true);
    try {
      await lemmyService.removePost({
        post_id: postId,
        removed: !currentlyRemoved,
        reason: currentlyRemoved ? 'Restored' : 'Removed by admin',
      });

      if (!currentlyRemoved) {
        setRemovedPosts(new Set([...removedPosts, postId]));
      } else {
        const newSet = new Set(removedPosts);
        newSet.delete(postId);
        setRemovedPosts(newSet);
      }

      setSuccess(currentlyRemoved ? 'Post restored' : 'Post removed');
    } catch (err) {
      console.error('Error removing post:', err);
      setError('Failed to remove/restore post. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveComment = async (commentId: number, currentlyRemoved: boolean) => {
    setActionLoading(true);
    try {
      await lemmyService.removeComment({
        comment_id: commentId,
        removed: !currentlyRemoved,
        reason: currentlyRemoved ? 'Restored' : 'Removed by admin',
      });

      if (!currentlyRemoved) {
        setRemovedComments(new Set([...removedComments, commentId]));
      } else {
        const newSet = new Set(removedComments);
        newSet.delete(commentId);
        setRemovedComments(newSet);
      }

      setSuccess(currentlyRemoved ? 'Comment restored' : 'Comment removed');
    } catch (err) {
      console.error('Error removing comment:', err);
      setError('Failed to remove/restore comment. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurgePost = async (postId: number) => {
    if (!window.confirm('Are you sure you want to permanently purge this post? This cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      await lemmyService.purgePost({
        post_id: postId,
        reason: 'Purged by admin',
      });

      setSuccess('Post purged successfully');

      // Refresh content
      if (selectedUserId) {
        const communityFilterId = communityFilter !== 'all' ? communityFilter : undefined;
        const content = await backendAPI.getRecentContent(selectedUserId, {
          communityId: communityFilterId,
          limit: 50
        });
        setRecentContent(content);
      }
    } catch (err) {
      console.error('Error purging post:', err);
      setError('Failed to purge post. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurgeComment = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to permanently purge this comment? This cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      await lemmyService.purgeComment({
        comment_id: commentId,
        reason: 'Purged by admin',
      });

      setSuccess('Comment purged successfully');

      // Refresh content
      if (selectedUserId) {
        const communityFilterId = communityFilter !== 'all' ? communityFilter : undefined;
        const content = await backendAPI.getRecentContent(selectedUserId, {
          communityId: communityFilterId,
          limit: 50
        });
        setRecentContent(content);
      }
    } catch (err) {
      console.error('Error purging comment:', err);
      setError('Failed to purge comment. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper function to determine if content should be hidden
  const shouldHideContent = (score: number) => {
    return hideOffensiveContent && score < -5;
  };

  // Helper function to determine if images should be blurred
  const shouldBlurImage = (score: number) => {
    return blurLowScoreImages && score < -3;
  };

  // Prepare voting chart data - Posts and Comments separately
  // Each chart shows Given (upvotes/downvotes) and Received (upvotes/downvotes)
  // Downvotes are shown as negative values (below axis)

  const postsVotingChartData = useMemo(() => {
    if (!votingPatterns) return [];

    // Approximate: split total votes given roughly 50/50 between posts and comments
    const givenUpvotes = Math.round(votingPatterns.votesGiven.upvotes * 0.5);
    const givenDownvotes = Math.round(votingPatterns.votesGiven.downvotes * 0.5);

    // Use actual received votes for posts
    const receivedUpvotes = votingPatterns.votesReceived.posts.upvotes;
    const receivedDownvotes = votingPatterns.votesReceived.posts.downvotes;

    return [
      {
        category: 'Given',
        Upvotes: givenUpvotes,
        Downvotes: -givenDownvotes, // Negative to show below axis
      },
      {
        category: 'Received',
        Upvotes: receivedUpvotes,
        Downvotes: -receivedDownvotes, // Negative to show below axis
      },
    ];
  }, [votingPatterns]);

  const commentsVotingChartData = useMemo(() => {
    if (!votingPatterns) return [];

    // Approximate: split total votes given roughly 50/50 between posts and comments
    const givenUpvotes = Math.round(votingPatterns.votesGiven.upvotes * 0.5);
    const givenDownvotes = Math.round(votingPatterns.votesGiven.downvotes * 0.5);

    // Use actual received votes for comments
    const receivedUpvotes = votingPatterns.votesReceived.comments.upvotes;
    const receivedDownvotes = votingPatterns.votesReceived.comments.downvotes;

    return [
      {
        category: 'Given',
        Upvotes: givenUpvotes,
        Downvotes: -givenDownvotes, // Negative to show below axis
      },
      {
        category: 'Received',
        Upvotes: receivedUpvotes,
        Downvotes: -receivedDownvotes, // Negative to show below axis
      },
    ];
  }, [votingPatterns]);

  // Format timeline data
  const formattedTimeline = useMemo(() => {
    return activityTimeline.map((point) => ({
      week: new Date(point.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      posts: point.posts,
      comments: point.comments,
      score: point.totalScore,
    }));
  }, [activityTimeline]);

  // Prepare pie chart data
  const pieChartData = useMemo(() => {
    return communityBreakdown.slice(0, 5).map((cb) => ({
      name: `${cb.community_name}@${cb.instance_domain}`,
      value: parseInt(cb.post_count) + parseInt(cb.comment_count),
    }));
  }, [communityBreakdown]);

  // Get behavior indicator
  const getBehaviorColor = (type: string) => {
    switch (type) {
      case 'troll':
        return 'error';
      case 'controversial':
        return 'warning';
      case 'contributor':
        return 'success';
      default:
        return 'default';
    }
  };

  const getBehaviorIcon = (type: string) => {
    switch (type) {
      case 'troll':
        return <Dangerous />;
      case 'controversial':
        return <Warning />;
      case 'contributor':
        return <CheckCircle />;
      default:
        return <Help />;
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Render search interface if no user selected
  if (!selectedUserId) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          User Analysis
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Search for a user to view comprehensive behavior analytics, voting patterns, and activity metrics
        </Typography>

        <Paper sx={{ p: 3, mt: 3 }}>
          <Autocomplete
            freeSolo
            options={searchResults}
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.name
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={searching}
            onInputChange={(_, value) => setSearchTerm(value)}
            onChange={(_, value) => {
              if (value && typeof value !== 'string') {
                setSelectedUserId(value.id);
                setSelectedUserHandle(`${value.name}@${value.instance_domain}`);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search users by username"
                variant="outlined"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searching ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props} display="flex" alignItems="center" gap={2}>
                <Avatar src={option.avatar || undefined} sx={{ width: 32, height: 32 }}>
                  {option.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body1">{option.name}@{option.instance_domain}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.post_count} posts • {option.comment_count} comments
                  </Typography>
                </Box>
              </Box>
            )}
          />
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">User Analysis</Typography>
        <Chip
          label="Change User"
          onClick={() => {
            navigate('/users');
            setSelectedUserId(null);
            setSelectedUserHandle(null);
            setSearchTerm('');
            setUserDetails(null);
            setVotingPatterns(null);
            setActivityTimeline([]);
            setCommunityBreakdown([]);
            setRecentContent(null);
            setBehaviorAnalysis(null);
            setCommunityFilter('all');
            // Reset AI summary state
            setAiSummary(null);
            setAiGenerating(false);
            setAiProgress('');
            setAiError(null);
          }}
          color="primary"
          variant="outlined"
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Loading Progress Indicator */}
      {loading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <CircularProgress size={24} />
              <Typography variant="h6">
                Loading User Data... {loadingProgress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={loadingProgress}
              sx={{ mb: 3, height: 8, borderRadius: 4 }}
            />
            <Grid container spacing={1}>
              {loadingSteps.map((step) => (
                <Grid item xs={12} sm={6} md={4} key={step.name}>
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: step.status === 'complete' ? 'success.light' :
                               step.status === 'loading' ? 'primary.light' :
                               step.status === 'error' ? 'error.light' : 'grey.100'
                    }}
                  >
                    {step.status === 'complete' && <CheckCircle color="success" fontSize="small" />}
                    {step.status === 'loading' && <CircularProgress size={16} />}
                    {step.status === 'error' && <Dangerous color="error" fontSize="small" />}
                    {step.status === 'pending' && <Help color="disabled" fontSize="small" />}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: step.status === 'loading' ? 'bold' : 'normal',
                        color: step.status === 'complete' ? 'success.dark' :
                               step.status === 'loading' ? 'primary.dark' :
                               step.status === 'error' ? 'error.dark' : 'text.secondary'
                      }}
                    >
                      {step.name}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {!loading && userDetails ? (
        <>
          {/* User Profile Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <Avatar
                      src={userDetails.avatar || undefined}
                      sx={{ width: 120, height: 120, mb: 2 }}
                    >
                      {userDetails.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="h5">{userDetails.name}</Typography>
                    {userDetails.display_name && (
                      <Typography variant="body2" color="text.secondary">
                        {userDetails.display_name}
                      </Typography>
                    )}
                    <Box display="flex" gap={1} mt={2} flexWrap="wrap" justifyContent="center">
                      {userDetails.deleted && (
                        <Chip icon={<Block />} label="Deleted" color="error" size="small" />
                      )}
                      {userDetails.bot_account && (
                        <Chip label="Bot" size="small" variant="outlined" />
                      )}
                      {userDetails.local ? (
                        <Chip label="Local" size="small" />
                      ) : (
                        <Chip label="Federated" size="small" variant="outlined" />
                      )}
                    </Box>

                    {/* Behavior Indicator */}
                    {behaviorAnalysis && (
                      <Box mt={2} width="100%">
                        <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                          <Chip
                            icon={getBehaviorIcon(behaviorAnalysis.behaviorType)}
                            label={behaviorAnalysis.behaviorType.toUpperCase()}
                            color={getBehaviorColor(behaviorAnalysis.behaviorType) as any}
                            sx={{ mb: 1 }}
                          />
                          <Typography variant="caption" display="block" color="text.secondary">
                            Behavior Score
                          </Typography>
                          <Typography variant="h6">{behaviorAnalysis.behaviorScore}</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={behaviorAnalysis.behaviorScore}
                            color={getBehaviorColor(behaviorAnalysis.behaviorType) as any}
                            sx={{ mt: 1 }}
                          />
                        </Paper>
                      </Box>
                    )}

                    {/* Admin Action Buttons */}
                    {authUser?.local_user_view?.local_user?.admin && (
                      <Box mt={2} width="100%" display="flex" flexDirection="column" gap={1}>
                        <Button
                          variant="contained"
                          color={userDetails.banned ? 'success' : 'warning'}
                          startIcon={<Gavel />}
                          onClick={() => setBanDialogOpen(true)}
                          disabled={actionLoading}
                          fullWidth
                        >
                          {userDetails.banned ? 'Unban User' : 'Ban User'}
                        </Button>
                        <Button
                          variant="contained"
                          color="error"
                          startIcon={<Delete />}
                          onClick={() => setPurgeDialogOpen(true)}
                          disabled={actionLoading}
                          fullWidth
                        >
                          Purge User
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} md={9}>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                        <Article color="primary" sx={{ fontSize: 32 }} />
                        <Typography variant="h6">
                          {userDetails.post_count.toLocaleString()}
                        </Typography>
                        <Typography variant="caption">Posts</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                        <Forum color="primary" sx={{ fontSize: 32 }} />
                        <Typography variant="h6">
                          {userDetails.comment_count.toLocaleString()}
                        </Typography>
                        <Typography variant="caption">Comments</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                        <TrendingUp color="success" sx={{ fontSize: 32 }} />
                        <Typography variant="h6">
                          {userDetails.post_score.toLocaleString()}
                        </Typography>
                        <Typography variant="caption">Post Karma</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                        <TrendingUp color="success" sx={{ fontSize: 32 }} />
                        <Typography variant="h6">
                          {userDetails.comment_score.toLocaleString()}
                        </Typography>
                        <Typography variant="caption">Comment Karma</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Voting Patterns Card */}
                  {votingPatterns && (
                    <Paper sx={{ p: 2, mt: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Voting Analysis
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" gutterBottom color="primary">
                            Votes Given (by this user)
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <ThumbUp fontSize="small" color="success" />
                            <Typography variant="body2">
                              Upvotes: {votingPatterns.votesGiven.upvotes.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <ThumbDown fontSize="small" color="error" />
                            <Typography variant="body2">
                              Downvotes: {votingPatterns.votesGiven.downvotes.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <Balance fontSize="small" color="primary" />
                            <Typography variant="body2">
                              Upvote Rate: {(votingPatterns.votesGiven.upvoteRate * 100).toFixed(1)}%
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" gutterBottom color="secondary">
                            Votes Received (on their content)
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Article fontSize="small" />
                            <Typography variant="body2">
                              Post Score: {votingPatterns.votesReceived.postScore.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <Forum fontSize="small" />
                            <Typography variant="body2">
                              Comment Score: {votingPatterns.votesReceived.commentScore.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <TrendingUp fontSize="small" color="success" />
                            <Typography variant="body2">
                              Total Karma: {votingPatterns.votesReceived.totalScore.toLocaleString()}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  )}

                  {/* Behavior Metrics */}
                  {behaviorAnalysis && (
                    <Paper sx={{ p: 2, mt: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Behavior Metrics
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary">
                            Negative Posts
                          </Typography>
                          <Typography variant="body1">
                            {behaviorAnalysis.metrics.negativePosts} / {behaviorAnalysis.metrics.totalPosts}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary">
                            Negative Comments
                          </Typography>
                          <Typography variant="body1">
                            {behaviorAnalysis.metrics.negativeComments} / {behaviorAnalysis.metrics.totalComments}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary">
                            Negative Rate
                          </Typography>
                          <Chip
                            label={`${behaviorAnalysis.metrics.negativeRate}%`}
                            size="small"
                            color={behaviorAnalysis.metrics.negativeRate > 40 ? 'error' : 'default'}
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary">
                            Controversy
                          </Typography>
                          <Chip
                            label={`${behaviorAnalysis.metrics.avgControversy}%`}
                            size="small"
                            color={behaviorAnalysis.metrics.avgControversy > 40 ? 'warning' : 'default'}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  )}

                  {/* Impact Summary */}
                  {userDetails && votingPatterns && (
                    <Paper sx={{ p: 2, mt: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Platform Impact
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Paper sx={{ p: 2, bgcolor: 'success.light' }} variant="outlined">
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <ThumbUp color="success" />
                              <Typography variant="subtitle2">Positive Contributions</Typography>
                            </Box>
                            <Typography variant="body2">
                              Total Content: {(userDetails.post_count + userDetails.comment_count).toLocaleString()} ({userDetails.post_count} posts, {userDetails.comment_count} comments)
                            </Typography>
                            <Typography variant="body2">
                              Upvotes Received: {(votingPatterns.votesReceived.posts.upvotes + votingPatterns.votesReceived.comments.upvotes).toLocaleString()} ({votingPatterns.votesReceived.posts.upvotes} on posts, {votingPatterns.votesReceived.comments.upvotes} on comments)
                            </Typography>
                            <Typography variant="body2">
                              Karma Earned: {votingPatterns.votesReceived.totalScore.toLocaleString()} ({votingPatterns.votesReceived.postScore} posts, {votingPatterns.votesReceived.commentScore} comments)
                            </Typography>
                            <Typography variant="body2">
                              Upvotes Given: {votingPatterns.votesGiven.upvotes.toLocaleString()}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Paper sx={{ p: 2, bgcolor: 'error.light' }} variant="outlined">
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <ThumbDown color="error" />
                              <Typography variant="subtitle2">Negative Impact</Typography>
                            </Box>
                            <Typography variant="body2">
                              Downvotes Received: {(votingPatterns.votesReceived.posts.downvotes + votingPatterns.votesReceived.comments.downvotes).toLocaleString()} ({votingPatterns.votesReceived.posts.downvotes} on posts, {votingPatterns.votesReceived.comments.downvotes} on comments)
                            </Typography>
                            <Typography variant="body2">
                              Downvotes Given: {votingPatterns.votesGiven.downvotes.toLocaleString()}
                            </Typography>
                            {behaviorAnalysis && (
                              <>
                                <Typography variant="body2">
                                  Negative Content: {(behaviorAnalysis.metrics.negativePosts + behaviorAnalysis.metrics.negativeComments).toLocaleString()} ({behaviorAnalysis.metrics.negativePosts} posts, {behaviorAnalysis.metrics.negativeComments} comments)
                                </Typography>
                                <Typography variant="body2">
                                  Controversy Score: {behaviorAnalysis.metrics.avgControversy}%
                                </Typography>
                              </>
                            )}
                          </Paper>
                        </Grid>
                        <Grid item xs={12}>
                          <Box display="flex" justifyContent="center" alignItems="center" mt={1}>
                            <Typography variant="h6" color="text.secondary">
                              Overall Impact Rating:
                            </Typography>
                            <Chip
                              label={
                                votingPatterns.votesReceived.totalScore > 1000
                                  ? 'HIGHLY POSITIVE'
                                  : votingPatterns.votesReceived.totalScore > 100
                                  ? 'POSITIVE'
                                  : votingPatterns.votesReceived.totalScore > 0
                                  ? 'NEUTRAL'
                                  : 'NEGATIVE'
                              }
                              color={
                                votingPatterns.votesReceived.totalScore > 100
                                  ? 'success'
                                  : votingPatterns.votesReceived.totalScore > 0
                                  ? 'default'
                                  : 'error'
                              }
                              sx={{ ml: 2, fontSize: '1rem', py: 2 }}
                            />
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* AI Summary Panel */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ✨ AI Summary
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {/* AI not available */}
              {(aiAvailable === false || aiAvailable === null) && (
                <Alert severity="info">
                  AI summary is not available. To enable this feature, configure VITE_OPENAI_API_URL in your environment.
                </Alert>
              )}

              {/* AI available, show generate button */}
              {aiAvailable === true && !aiSummary && !aiGenerating && !aiError && (
                <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                  <Typography variant="body2" color="text.secondary">
                    Generate an AI-powered summary of this user's activity and behavior patterns.
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={generateAISummary}
                  >
                    Generate Summary
                  </Button>
                </Box>
              )}

              {/* Generating */}
              {aiGenerating && (
                <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary">
                    {aiProgress}
                  </Typography>
                </Box>
              )}

              {/* Summary generated */}
              {aiSummary && !aiGenerating && (
                <Box>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }} variant="outlined">
                    <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
                      {aiSummary}
                    </Typography>
                  </Paper>
                  <Box mt={2} display="flex" justifyContent="center">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={generateAISummary}
                      disabled={aiGenerating}
                    >
                      Regenerate Summary
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Error */}
              {aiError && !aiGenerating && (
                <Box>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {aiError}
                  </Alert>
                  <Box display="flex" justifyContent="center">
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={generateAISummary}
                    >
                      Retry
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Community Filter Section */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                <Box display="flex" alignItems="center" gap={2} flex={1}>
                  <FilterAlt color="primary" />
                  <Typography variant="h6">
                    Community Filter
                  </Typography>
                  {communityFilter !== 'all' && (
                    <Chip
                      label="FILTER ACTIVE"
                      color="primary"
                      size="small"
                      onDelete={() => setCommunityFilter('all')}
                    />
                  )}
                </Box>
                <FormControl sx={{ minWidth: 350 }}>
                  <InputLabel>View Impact in Specific Community</InputLabel>
                  <Select
                    value={communityFilter}
                    onChange={(e) => setCommunityFilter(e.target.value as number | 'all')}
                    label="View Impact in Specific Community"
                    disabled={loading}
                  >
                    <MenuItem value="all">
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography fontWeight="bold">All Communities</Typography>
                        <Typography variant="caption" color="text.secondary">
                          (Site-wide activity)
                        </Typography>
                      </Box>
                    </MenuItem>
                    {communityBreakdown.map((cb) => (
                      <MenuItem key={cb.community_id} value={cb.community_id}>
                        <Box>
                          <Typography>{cb.community_name}@{cb.instance_domain}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {parseInt(cb.post_count) + parseInt(cb.comment_count)} activities • Score: {parseInt(cb.post_score) + parseInt(cb.comment_score)}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {loading && <CircularProgress size={24} />}
              </Box>
              {communityFilter !== 'all' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  All charts, metrics, and content below are filtered to show only activity in the selected community.
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Charts Row */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Activity Timeline */}
            <Grid item xs={12} lg={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Activity Over Time (Last 12 Weeks)
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={formattedTimeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <RechartsTooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="posts" stroke="#8884d8" name="Posts" />
                      <Line yAxisId="left" type="monotone" dataKey="comments" stroke="#82ca9d" name="Comments" />
                      <Line yAxisId="right" type="monotone" dataKey="score" stroke="#ffc658" name="Score" strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Posts Voting Pattern */}
            <Grid item xs={12} lg={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Posts Voting Pattern
                  </Typography>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Given = votes this user gave on others' posts | Received = votes this user's posts received | Downvotes shown below axis
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={postsVotingChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
                      {/* Upvotes (green, above axis) and Downvotes (red, below axis) */}
                      <Bar dataKey="Upvotes" fill="#4caf50" name="Upvotes" />
                      <Bar dataKey="Downvotes" fill="#f44336" name="Downvotes" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Comments Voting Pattern */}
            <Grid item xs={12} lg={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Comments Voting Pattern
                  </Typography>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Given = votes this user gave on others' comments | Received = votes this user's comments received | Downvotes shown below axis
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={commentsVotingChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
                      {/* Upvotes (green, above axis) and Downvotes (red, below axis) */}
                      <Bar dataKey="Upvotes" fill="#4caf50" name="Upvotes" />
                      <Bar dataKey="Downvotes" fill="#f44336" name="Downvotes" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Community Distribution Pie */}
            <Grid item xs={12} lg={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top 5 Communities by Activity
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name} (${entry.value})`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Content Safety Controls */}
          <Box display="flex" alignItems="center" gap={3} mb={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={hideOffensiveContent}
                  onChange={(e) => setHideOffensiveContent(e.target.checked)}
                />
              }
              label="Hide Offensive Content (score < -5)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={blurLowScoreImages}
                  onChange={(e) => setBlurLowScoreImages(e.target.checked)}
                />
              }
              label="Blur Low-Score Images (score < -3)"
            />
          </Box>

          {/* Content Tabs */}
          <Card>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label={`Posts (${recentContent?.posts?.length || 0})`} />
              <Tab label={`Comments (${recentContent?.comments?.length || 0})`} />
              <Tab label={`Communities (${communityBreakdown.length})`} />
            </Tabs>

            {/* Posts Tab */}
            <TabPanel value={tabValue} index={0}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Community</TableCell>
                      <TableCell align="right">Score</TableCell>
                      <TableCell align="right">Comments</TableCell>
                      <TableCell>Date</TableCell>
                      {authUser?.local_user_view?.local_user?.admin && (
                        <TableCell align="center">Actions</TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentContent?.posts
                      ?.filter((post) => !shouldHideContent(post.score))
                      .map((post) => {
                        const isRemoved = removedPosts.has(post.id);
                        return (
                          <TableRow
                            key={post.id}
                            hover
                            sx={{
                              opacity: isRemoved ? 0.5 : 1,
                              bgcolor: post.score < -3 ? 'error.light' : undefined,
                            }}
                          >
                            <TableCell>
                              <Box sx={{ filter: shouldBlurImage(post.score) ? 'blur(4px)' : 'none' }}>
                                <MuiLink
                                  href={`${config.lemmyInstanceUrl}/post/${post.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  underline="hover"
                                >
                                  {post.name}
                                </MuiLink>
                                {isRemoved && (
                                  <Chip label="REMOVED" size="small" color="error" sx={{ ml: 1 }} />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>{post.community_name}@{post.instance_domain}</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={post.score}
                                size="small"
                                color={post.score > 10 ? 'success' : post.score < 0 ? 'error' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="right">{post.comment_count}</TableCell>
                            <TableCell>
                              {new Date(post.published_at).toLocaleDateString()}
                            </TableCell>
                            {authUser?.local_user_view?.local_user?.admin && (
                              <TableCell align="center">
                                <Tooltip title={isRemoved ? "Restore post" : "Remove post"}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRemovePost(post.id, isRemoved)}
                                    color={isRemoved ? "success" : "warning"}
                                    disabled={actionLoading}
                                  >
                                    {isRemoved ? <Restore /> : <RemoveCircle />}
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Permanently delete post">
                                  <IconButton
                                    size="small"
                                    onClick={() => handlePurgePost(post.id)}
                                    color="error"
                                    disabled={actionLoading}
                                  >
                                    <Delete />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    {(!recentContent?.posts || recentContent.posts.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={authUser?.local_user_view?.local_user?.admin ? 6 : 5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No posts found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>

            {/* Comments Tab */}
            <TabPanel value={tabValue} index={1}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Content</TableCell>
                      <TableCell>Post</TableCell>
                      <TableCell>Community</TableCell>
                      <TableCell align="right">Score</TableCell>
                      <TableCell>Date</TableCell>
                      {authUser?.local_user_view?.local_user?.admin && (
                        <TableCell align="center">Actions</TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentContent?.comments
                      ?.filter((comment) => !shouldHideContent(comment.score))
                      .map((comment) => {
                        const isRemoved = removedComments.has(comment.id);
                        return (
                          <TableRow
                            key={comment.id}
                            hover
                            sx={{
                              opacity: isRemoved ? 0.5 : 1,
                              bgcolor: comment.score < -3 ? 'error.light' : undefined,
                            }}
                          >
                            <TableCell>
                              <Box sx={{ filter: shouldBlurImage(comment.score) ? 'blur(4px)' : 'none' }}>
                                <Typography variant="body2" sx={{ maxWidth: 400 }}>
                                  {comment.content.substring(0, 150)}
                                  {comment.content.length > 150 ? '...' : ''}
                                </Typography>
                                {isRemoved && (
                                  <Chip label="REMOVED" size="small" color="error" sx={{ mt: 0.5 }} />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <MuiLink
                                href={`${config.lemmyInstanceUrl}/post/${comment.post_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                              >
                                {comment.post_name.substring(0, 40)}...
                              </MuiLink>
                            </TableCell>
                            <TableCell>{comment.community_name}@{comment.instance_domain}</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={comment.score}
                                size="small"
                                color={comment.score > 5 ? 'success' : comment.score < 0 ? 'error' : 'default'}
                              />
                            </TableCell>
                            <TableCell>
                              {new Date(comment.published_at).toLocaleDateString()}
                            </TableCell>
                            {authUser?.local_user_view?.local_user?.admin && (
                              <TableCell align="center">
                                <Tooltip title={isRemoved ? "Restore comment" : "Remove comment"}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRemoveComment(comment.id, isRemoved)}
                                    color={isRemoved ? "success" : "warning"}
                                    disabled={actionLoading}
                                  >
                                    {isRemoved ? <Restore /> : <RemoveCircle />}
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Permanently delete comment">
                                  <IconButton
                                    size="small"
                                    onClick={() => handlePurgeComment(comment.id)}
                                    color="error"
                                    disabled={actionLoading}
                                  >
                                    <Delete />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    {(!recentContent?.comments || recentContent.comments.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={authUser?.local_user_view?.local_user?.admin ? 6 : 5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No comments found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>

            {/* Communities Tab */}
            <TabPanel value={tabValue} index={2}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Community</TableCell>
                      <TableCell align="right">Posts</TableCell>
                      <TableCell align="right">Comments</TableCell>
                      <TableCell align="right">Post Score</TableCell>
                      <TableCell align="right">Comment Score</TableCell>
                      <TableCell>Last Activity</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {communityBreakdown.map((cb) => (
                      <TableRow key={cb.community_id} hover>
                        <TableCell>
                          <MuiLink
                            href={`${config.lemmyInstanceUrl}/c/${cb.community_name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            underline="hover"
                          >
                            {cb.community_name}@{cb.instance_domain}
                          </MuiLink>
                          <Typography variant="caption" display="block" color="text.secondary">
                            {cb.community_title}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{cb.post_count}</TableCell>
                        <TableCell align="right">{cb.comment_count}</TableCell>
                        <TableCell align="right">
                          <Chip label={cb.post_score} size="small" />
                        </TableCell>
                        <TableCell align="right">
                          <Chip label={cb.comment_score} size="small" />
                        </TableCell>
                        <TableCell>
                          {cb.last_activity ? new Date(cb.last_activity).toLocaleDateString() : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {communityBreakdown.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No community activity found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>
          </Card>
        </>
      ) : null}

      {/* Ban User Confirmation Dialog */}
      <Dialog open={banDialogOpen} onClose={() => setBanDialogOpen(false)}>
        <DialogTitle>
          {userDetails?.banned ? 'Unban User' : 'Ban User'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {userDetails?.banned
              ? `Are you sure you want to unban ${userDetails.name}?`
              : `Are you sure you want to ban ${userDetails?.name}? This will prevent them from posting and commenting.`}
          </DialogContentText>
          {!userDetails?.banned && (
            <TextField
              autoFocus
              margin="dense"
              label="Reason (optional)"
              fullWidth
              multiline
              rows={3}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBanDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleBanUser}
            color={userDetails?.banned ? 'success' : 'warning'}
            variant="contained"
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={24} /> : userDetails?.banned ? 'Unban' : 'Ban'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purge User Confirmation Dialog */}
      <Dialog open={purgeDialogOpen} onClose={() => setPurgeDialogOpen(false)}>
        <DialogTitle>Purge User - Permanent Action</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            WARNING: This action is PERMANENT and cannot be undone!
          </Alert>
          <DialogContentText>
            Are you sure you want to permanently purge user <strong>{userDetails?.name}</strong>?
            This will:
          </DialogContentText>
          <Box component="ul" sx={{ mt: 1 }}>
            <li>Delete the user account permanently</li>
            <li>Remove all their posts and comments from the database</li>
            <li>This action CANNOT be reversed</li>
          </Box>
          <TextField
            autoFocus
            margin="dense"
            label="Reason (required)"
            fullWidth
            multiline
            rows={3}
            value={purgeReason}
            onChange={(e) => setPurgeReason(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurgeDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handlePurgeUser}
            color="error"
            variant="contained"
            disabled={actionLoading || !purgeReason.trim()}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Permanently Purge'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
