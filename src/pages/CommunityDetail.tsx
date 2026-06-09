import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Avatar,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Link as MuiLink,
  Skeleton,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  OpenInNew,
  Person,
  ThumbDown,
  ThumbUp,
  Gavel,
} from '@mui/icons-material';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { lemmyService, CommunityView, PostView, CommentView } from '../services/lemmy';
import {
  backendAPI,
  CommunityDiagnosticsSummary,
  VoteBrigadingPost,
  PostVotersResponse,
  SerialDownvoter,
  UserDownvoteHistory,
  ControversialPost,
  HealthTrendPoint,
  TopContributor,
} from '../services/backend';
import { config } from '../config';

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 365) return `${Math.floor(days / 365)}yr ago`;
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return 'just now';
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString();
};

const healthChipProps = (status: string) => {
  switch (status) {
    case 'healthy':
      return { icon: <CheckCircle />, label: 'Healthy', color: 'success' as const };
    case 'watch':
      return { icon: <Warning />, label: 'Watch', color: 'warning' as const };
    case 'at_risk':
      return { icon: <ErrorIcon />, label: 'At Risk', color: 'error' as const };
    default:
      return { icon: <CheckCircle />, label: 'Unknown', color: 'default' as const };
  }
};

// Anomaly chip
const anomalyChip = (level: string) => {
  switch (level) {
    case 'HIGH': return <Chip label="HIGH" color="error" size="small" />;
    case 'MED': return <Chip label="MED" color="warning" size="small" />;
    default: return <Chip label="LOW" size="small" variant="outlined" />;
  }
};

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

export const CommunityDetail: React.FC = () => {
  const { communityHandle } = useParams<{ communityHandle: string }>();
  const navigate = useNavigate();
  useAuth();

  const [communityView, setCommunityView] = useState<CommunityView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Tab data states
  const [summary, setSummary] = useState<CommunityDiagnosticsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [brigading, setBrigading] = useState<VoteBrigadingPost[] | null>(null);
  const [brigadingLoading, setBrigadingLoading] = useState(false);
  const [brigadingDays, setBrigadingDays] = useState(30);
  const [serialDownvoters, setSerialDownvoters] = useState<SerialDownvoter[] | null>(null);
  const [serialLoading, setSerialLoading] = useState(false);
  const [serialDays, setSerialDays] = useState(90);
  const [controversial, setControversial] = useState<ControversialPost[] | null>(null);
  const [controversialLoading, setControversialLoading] = useState(false);
  const [controversialDays, setControversialDays] = useState(30);
  const [healthTrends, setHealthTrends] = useState<HealthTrendPoint[] | null>(null);
  const [healthWeeks, setHealthWeeks] = useState(12);
  const [healthLoading, setHealthLoading] = useState(false);
  const [topContributors, setTopContributors] = useState<TopContributor[] | null>(null);

  // Recent content
  const [recentPosts, setRecentPosts] = useState<PostView[] | null>(null);
  const [recentComments, setRecentComments] = useState<CommentView[] | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);

  // Dialogs
  const [voterDialog, setVoterDialog] = useState<PostVotersResponse | null>(null);
  const [voterLoading, setVoterLoading] = useState(false);
  const [downvoteDialog, setDownvoteDialog] = useState<{ userId: number; username: string; history: UserDownvoteHistory } | null>(null);
  const [downvoteLoading, setDownvoteLoading] = useState(false);
  const [banDialog, setBanDialog] = useState<{ personId: number; username: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<string>('permanent');
  const [banLoading, setBanLoading] = useState(false);
  const [banSuccess, setBanSuccess] = useState<string | null>(null);

  // Parse community handle and load community
  useEffect(() => {
    const loadCommunity = async () => {
      if (!communityHandle) return;
      try {
        setLoading(true);
        const parts = communityHandle.split('@');
        if (parts.length !== 2) {
          setError('Invalid community handle format');
          return;
        }
        const [name] = parts;
        const result = await lemmyService.getCommunity({ name });
        setCommunityView(result.community_view);
      } catch (err) {
        console.error('Error loading community:', err);
        setError('Failed to load community');
      } finally {
        setLoading(false);
      }
    };
    loadCommunity();
  }, [communityHandle]);

  const communityId = communityView?.community.id;

  // Load summary on mount
  const loadSummary = useCallback(async () => {
    if (!communityId) return;
    setSummaryLoading(true);
    try {
      const data = await backendAPI.getCommunityDiagnosticsSummary(communityId);
      setSummary(data);
    } catch (err) {
      console.error('Error loading summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (communityId) loadSummary();
  }, [communityId, loadSummary]);

  // Load recent posts and comments
  useEffect(() => {
    if (!communityId) return;
    const loadRecent = async () => {
      setRecentLoading(true);
      try {
        const [postsRes, commentsRes] = await Promise.all([
          lemmyService.getPosts({ community_id: communityId, limit: 20, sort: 'New' }),
          lemmyService.getComments({ community_id: communityId, limit: 20, sort: 'New' }),
        ]);
        setRecentPosts(postsRes.posts);
        setRecentComments(commentsRes.comments);
      } catch (err) {
        console.error('Error loading recent content:', err);
      } finally {
        setRecentLoading(false);
      }
    };
    loadRecent();
  }, [communityId]);

  // Lazy load tab data
  const loadBrigading = useCallback(async () => {
    if (!communityId || brigadingLoading) return;
    setBrigadingLoading(true);
    try {
      const data = await backendAPI.getVoteBrigading(communityId, brigadingDays);
      setBrigading(data);
    } catch (err) {
      console.error('Error loading brigading:', err);
    } finally {
      setBrigadingLoading(false);
    }
  }, [communityId, brigadingDays]);

  const loadSerialDownvoters = useCallback(async () => {
    if (!communityId || serialLoading) return;
    setSerialLoading(true);
    try {
      const data = await backendAPI.getSerialDownvoters(communityId, serialDays);
      setSerialDownvoters(data);
    } catch (err) {
      console.error('Error loading serial downvoters:', err);
    } finally {
      setSerialLoading(false);
    }
  }, [communityId, serialDays]);

  const loadControversial = useCallback(async () => {
    if (!communityId || controversialLoading) return;
    setControversialLoading(true);
    try {
      const data = await backendAPI.getControversialPosts(communityId, controversialDays);
      setControversial(data);
    } catch (err) {
      console.error('Error loading controversial:', err);
    } finally {
      setControversialLoading(false);
    }
  }, [communityId, controversialDays]);

  const loadHealthTrends = useCallback(async () => {
    if (!communityId || healthLoading) return;
    setHealthLoading(true);
    try {
      const [trends, contributors] = await Promise.all([
        backendAPI.getHealthTrends(communityId, healthWeeks),
        backendAPI.getTopContributors(communityId, 30),
      ]);
      setHealthTrends(trends);
      setTopContributors(contributors);
    } catch (err) {
      console.error('Error loading health trends:', err);
    } finally {
      setHealthLoading(false);
    }
  }, [communityId, healthWeeks]);

  // Load tab data when tab changes
  useEffect(() => {
    switch (activeTab) {
      case 1: if (!brigading) loadBrigading(); break;
      case 2: if (!serialDownvoters) loadSerialDownvoters(); break;
      case 3: if (!controversial) loadControversial(); break;
      case 4: if (!healthTrends) loadHealthTrends(); break;
    }
  }, [activeTab, brigading, serialDownvoters, controversial, healthTrends,
      loadBrigading, loadSerialDownvoters, loadControversial, loadHealthTrends]);

  // Reload when time params change
  useEffect(() => { setBrigading(null); }, [brigadingDays]);
  useEffect(() => { setSerialDownvoters(null); }, [serialDays]);
  useEffect(() => { setControversial(null); }, [controversialDays]);
  useEffect(() => { setHealthTrends(null); setTopContributors(null); }, [healthWeeks]);

  const openVoterDialog = async (postId: number) => {
    if (!communityId) return;
    setVoterLoading(true);
    setVoterDialog(null);
    try {
      const data = await backendAPI.getPostVoters(communityId, postId);
      setVoterDialog(data);
    } catch (err) {
      console.error('Error loading voters:', err);
    } finally {
      setVoterLoading(false);
    }
  };

  const openDownvoteDialog = async (userId: number, username: string) => {
    if (!communityId) return;
    setDownvoteLoading(true);
    setDownvoteDialog(null);
    try {
      const history = await backendAPI.getUserDownvoteHistory(communityId, userId);
      setDownvoteDialog({ userId, username, history });
    } catch (err) {
      console.error('Error loading downvote history:', err);
    } finally {
      setDownvoteLoading(false);
    }
  };

  const handleBan = async () => {
    if (!communityId || !banDialog) return;
    setBanLoading(true);
    try {
      let expires: number | undefined;
      if (banDuration !== 'permanent') {
        const daysNum = parseInt(banDuration, 10);
        expires = Math.floor(Date.now() / 1000) + daysNum * 86400;
      }
      await lemmyService.banFromCommunity({
        community_id: communityId,
        person_id: banDialog.personId,
        ban: true,
        reason: banReason || undefined,
        expires,
      });
      setBanSuccess(`${banDialog.username} has been banned from this community.`);
      setBanDialog(null);
      setBanReason('');
      setBanDuration('permanent');
      // Refresh serial downvoters
      setSerialDownvoters(null);
      if (activeTab === 2) loadSerialDownvoters();
    } catch (err) {
      console.error('Error banning user:', err);
    } finally {
      setBanLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !communityView) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/communities')} sx={{ mb: 2 }}>
          Back to Communities
        </Button>
        <Alert severity="error">{error || 'Community not found'}</Alert>
      </Box>
    );
  }

  const { community, counts } = communityView;
  const instanceDomain = new URL(config.lemmyInstanceUrl).hostname;

  return (
    <Box>
      {/* Header */}
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/communities')} sx={{ mb: 2 }}>
        Back to Communities
      </Button>

      <Box display="flex" alignItems="center" gap={2} mb={2}>
        {community.icon && (
          <Avatar src={community.icon} alt={community.name} sx={{ width: 64, height: 64 }} />
        )}
        <Box>
          <Typography variant="h4">!{community.name}@{instanceDomain}</Typography>
          <Box display="flex" gap={2} flexWrap="wrap" mt={0.5}>
            <Typography variant="body2" color="text.secondary">
              {counts.subscribers.toLocaleString()} subscribers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {counts.posts.toLocaleString()} posts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {counts.comments.toLocaleString()} comments
            </Typography>
            {summary && (
              <Typography variant="body2" color="text.secondary">
                {summary.activePerWeek} active/wk
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {banSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setBanSuccess(null)}>
          {banSuccess}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab label="Overview" />
        <Tab label="Vote Brigading" />
        <Tab label="Serial Downvoters" />
        <Tab label="Controversial Posts" />
        <Tab label="Health Trends" />
      </Tabs>

      {/* Tab 0: Overview */}
      <TabPanel value={activeTab} index={0}>
        {summaryLoading ? (
          <Box>
            <Grid container spacing={2}>
              {[1, 2, 3].map(i => (
                <Grid item xs={12} sm={4} key={i}>
                  <Skeleton variant="rectangular" height={100} />
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : summary ? (
          <Box>
            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                  <Typography variant="h4">{summary.engagementScore}%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Engagement Score (% positive votes)
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                  <Typography variant="h4">{summary.controversialCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Controversial Posts (30 days)
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                  <Chip {...healthChipProps(summary.healthStatus)} sx={{ mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {summary.downvoteRisk}% downvote risk | {summary.serialDownvoterCount} suspects
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Red Flags */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Red Flags</Typography>
              {summary.redFlags.length === 0 ? (
                <Box display="flex" alignItems="center" gap={1}>
                  <CheckCircle color="success" />
                  <Typography variant="body2" color="text.secondary">
                    No suspicious activity detected
                  </Typography>
                </Box>
              ) : (
                summary.redFlags.map((flag, idx) => (
                  <Box key={idx} display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Warning color="warning" fontSize="small" />
                    <Typography variant="body2">{flag}</Typography>
                  </Box>
                ))
              )}
            </Paper>

            {/* Recent Posts */}
            <Typography variant="h6" gutterBottom>Recent Posts</Typography>
            {recentLoading ? <LinearProgress sx={{ mb: 2 }} /> : recentPosts && recentPosts.length > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Author</TableCell>
                      <TableCell align="right">Score</TableCell>
                      <TableCell align="right">Up</TableCell>
                      <TableCell align="right">Down</TableCell>
                      <TableCell align="right">Comments</TableCell>
                      <TableCell>Posted</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentPosts.map((pv) => (
                      <TableRow key={pv.post.id} hover>
                        <TableCell
                          sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                          onClick={() => openVoterDialog(pv.post.id)}
                        >
                          <Tooltip title="View voters">
                            <span>{pv.post.name}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <MuiLink
                            component="button"
                            variant="body2"
                            onClick={() => navigate(`/users/${pv.creator.name}@${new URL(pv.creator.actor_id).hostname}`)}
                          >
                            @{pv.creator.name}
                          </MuiLink>
                        </TableCell>
                        <TableCell align="right">{pv.counts.score}</TableCell>
                        <TableCell align="right">{pv.counts.upvotes}</TableCell>
                        <TableCell align="right">{pv.counts.downvotes}</TableCell>
                        <TableCell align="right">{pv.counts.comments}</TableCell>
                        <TableCell>{formatTimeAgo(pv.post.published)}</TableCell>
                        <TableCell align="center">
                          <Box display="flex" gap={0.5} justifyContent="center">
                            <Tooltip title="View on Lemmy">
                              <IconButton
                                size="small"
                                href={`${config.lemmyInstanceUrl}/post/${pv.post.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Ban author from community">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setBanDialog({ personId: pv.creator.id, username: pv.creator.name })}
                              >
                                <Gavel fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>No recent posts</Typography>
            )}

            {/* Recent Comments */}
            <Typography variant="h6" gutterBottom>Recent Comments</Typography>
            {recentLoading ? <LinearProgress sx={{ mb: 2 }} /> : recentComments && recentComments.length > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Comment</TableCell>
                      <TableCell>Author</TableCell>
                      <TableCell>Post</TableCell>
                      <TableCell align="right">Score</TableCell>
                      <TableCell align="right">Up</TableCell>
                      <TableCell align="right">Down</TableCell>
                      <TableCell>Posted</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentComments.map((cv) => (
                      <TableRow key={cv.comment.id} hover>
                        <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cv.comment.content.length > 100 ? cv.comment.content.substring(0, 100) + '...' : cv.comment.content}
                        </TableCell>
                        <TableCell>
                          <MuiLink
                            component="button"
                            variant="body2"
                            onClick={() => navigate(`/users/${cv.creator.name}@${new URL(cv.creator.actor_id).hostname}`)}
                          >
                            @{cv.creator.name}
                          </MuiLink>
                        </TableCell>
                        <TableCell
                          sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                          onClick={() => openVoterDialog(cv.post.id)}
                        >
                          <Tooltip title="View post voters">
                            <span>{cv.post.name}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">{cv.counts.score}</TableCell>
                        <TableCell align="right">{cv.counts.upvotes}</TableCell>
                        <TableCell align="right">{cv.counts.downvotes}</TableCell>
                        <TableCell>{formatTimeAgo(cv.comment.published)}</TableCell>
                        <TableCell align="center">
                          <Box display="flex" gap={0.5} justifyContent="center">
                            <Tooltip title="View on Lemmy">
                              <IconButton
                                size="small"
                                href={`${config.lemmyInstanceUrl}/comment/${cv.comment.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Ban author from community">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setBanDialog({ personId: cv.creator.id, username: cv.creator.name })}
                              >
                                <Gavel fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>No recent comments</Typography>
            )}
          </Box>
        ) : (
          <Alert severity="warning">Failed to load diagnostics summary</Alert>
        )}
      </TabPanel>

      {/* Tab 1: Vote Brigading */}
      <TabPanel value={activeTab} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Vote Brigading Detection
          </Typography>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Days</InputLabel>
            <Select value={brigadingDays} label="Days" onChange={(e) => setBrigadingDays(e.target.value as number)}>
              <MenuItem value={7}>7 days</MenuItem>
              <MenuItem value={30}>30 days</MenuItem>
              <MenuItem value={90}>90 days</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          Posts sorted by anomaly score (unusual vote patterns)
        </Typography>

        {brigadingLoading ? <LinearProgress /> : brigading && brigading.length === 0 ? (
          <Box display="flex" alignItems="center" gap={1} p={3}>
            <CheckCircle color="success" />
            <Typography color="text.secondary">No suspicious vote patterns detected</Typography>
          </Box>
        ) : brigading ? (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Author</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell align="right">Up</TableCell>
                  <TableCell align="right">Down</TableCell>
                  <TableCell align="right">Ratio</TableCell>
                  <TableCell>Anomaly</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {brigading.map((post) => (
                  <TableRow
                    key={post.post_id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openVoterDialog(post.post_id)}
                  >
                    <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.title}
                    </TableCell>
                    <TableCell>@{post.author_name}</TableCell>
                    <TableCell align="right">{post.score}</TableCell>
                    <TableCell align="right">{post.upvotes}</TableCell>
                    <TableCell align="right">{post.downvotes}</TableCell>
                    <TableCell align="right">{post.upvote_ratio}%</TableCell>
                    <TableCell>{anomalyChip(post.anomaly)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}
      </TabPanel>

      {/* Tab 2: Serial Downvoters */}
      <TabPanel value={activeTab} index={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Serial Downvoters</Typography>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Days</InputLabel>
            <Select value={serialDays} label="Days" onChange={(e) => setSerialDays(e.target.value as number)}>
              <MenuItem value={30}>30 days</MenuItem>
              <MenuItem value={90}>90 days</MenuItem>
              <MenuItem value={180}>180 days</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          Users who primarily downvote in this community (min 5 downvotes)
        </Typography>

        {serialLoading ? <LinearProgress /> : serialDownvoters && serialDownvoters.length === 0 ? (
          <Box display="flex" alignItems="center" gap={1} p={3}>
            <CheckCircle color="success" />
            <Typography color="text.secondary">No serial downvoters detected</Typography>
          </Box>
        ) : serialDownvoters ? (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell align="right">Down</TableCell>
                  <TableCell align="right">Up</TableCell>
                  <TableCell align="right">Ratio</TableCell>
                  <TableCell align="right">Targets</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {serialDownvoters.map((dv) => (
                  <TableRow
                    key={dv.person_id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openDownvoteDialog(dv.person_id, dv.username)}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        @{dv.username}
                        {!dv.local && (
                          <Typography variant="caption" color="text.secondary">
                            @{dv.instance_domain}
                          </Typography>
                        )}
                        {dv.banned && <Chip label="Banned" size="small" color="error" sx={{ ml: 0.5 }} />}
                      </Box>
                    </TableCell>
                    <TableCell>{formatTimeAgo(dv.account_created)}</TableCell>
                    <TableCell align="right">{dv.total_downvotes}</TableCell>
                    <TableCell align="right">{dv.total_upvotes}</TableCell>
                    <TableCell align="right">{dv.downvote_ratio}%</TableCell>
                    <TableCell align="right">{dv.unique_targets}</TableCell>
                    <TableCell>
                      <Tooltip title="Ban from community">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBanDialog({ personId: dv.person_id, username: dv.username });
                          }}
                        >
                          <Gavel fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}
      </TabPanel>

      {/* Tab 3: Controversial Posts */}
      <TabPanel value={activeTab} index={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Controversial Posts</Typography>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Days</InputLabel>
            <Select value={controversialDays} label="Days" onChange={(e) => setControversialDays(e.target.value as number)}>
              <MenuItem value={7}>7 days</MenuItem>
              <MenuItem value={30}>30 days</MenuItem>
              <MenuItem value={90}>90 days</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          Posts with high engagement on both sides, sorted by min(upvotes, downvotes)
        </Typography>

        {controversialLoading ? <LinearProgress /> : controversial && controversial.length === 0 ? (
          <Box display="flex" alignItems="center" gap={1} p={3}>
            <CheckCircle color="success" />
            <Typography color="text.secondary">No controversial posts found</Typography>
          </Box>
        ) : controversial ? (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Author</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell align="right">Up</TableCell>
                  <TableCell align="right">Down</TableCell>
                  <TableCell align="right">Comments</TableCell>
                  <TableCell>Controversy</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {controversial.map((post) => {
                  const maxControversy = controversial[0]?.controversy_score || 1;
                  const barWidth = Math.round((post.controversy_score / maxControversy) * 100);
                  return (
                    <TableRow
                      key={post.post_id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => openVoterDialog(post.post_id)}
                    >
                      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {post.title}
                      </TableCell>
                      <TableCell>@{post.author_name}</TableCell>
                      <TableCell align="right">{post.score >= 0 ? '+' : ''}{post.score}</TableCell>
                      <TableCell align="right">{post.upvotes}</TableCell>
                      <TableCell align="right">{post.downvotes}</TableCell>
                      <TableCell align="right">{post.comments}</TableCell>
                      <TableCell sx={{ minWidth: 100 }}>
                        <Box sx={{ width: '100%', bgcolor: 'action.hover', borderRadius: 1, height: 16, overflow: 'hidden' }}>
                          <Box sx={{ width: `${barWidth}%`, bgcolor: 'warning.main', height: '100%', borderRadius: 1 }} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}
      </TabPanel>

      {/* Tab 4: Health Trends */}
      <TabPanel value={activeTab} index={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Health Trends</Typography>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Weeks</InputLabel>
            <Select value={healthWeeks} label="Weeks" onChange={(e) => setHealthWeeks(e.target.value as number)}>
              <MenuItem value={4}>4 weeks</MenuItem>
              <MenuItem value={12}>12 weeks</MenuItem>
              <MenuItem value={26}>26 weeks</MenuItem>
              <MenuItem value={52}>52 weeks</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {healthLoading ? <LinearProgress /> : healthTrends ? (
          <Box>
            <Grid container spacing={3}>
              {/* Activity Chart */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Activity</Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={healthTrends.map(t => ({ ...t, week: formatDate(t.week) }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="posts" stroke="#1976d2" name="Posts" />
                      <Line type="monotone" dataKey="comments" stroke="#9c27b0" name="Comments" />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Unique Contributors Chart */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Unique Contributors</Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={healthTrends.map(t => ({ ...t, week: formatDate(t.week) }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="uniquePosters" stroke="#1976d2" name="Posters" />
                      <Line type="monotone" dataKey="uniqueCommenters" stroke="#9c27b0" name="Commenters" />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Vote Sentiment Chart */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Vote Sentiment</Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={healthTrends.map(t => ({
                      week: formatDate(t.week),
                      upvotes: t.upvotes,
                      downvotes: t.downvotes,
                      pctPositive: t.upvotes + t.downvotes > 0
                        ? Math.round((t.upvotes / (t.upvotes + t.downvotes)) * 100)
                        : 100,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="upvotes" stackId="a" fill="#4caf50" name="Upvotes" />
                      <Bar dataKey="downvotes" stackId="a" fill="#f44336" name="Downvotes" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Top Contributors */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Top Contributors (30 days)</Typography>
                  {topContributors && topContributors.length > 0 ? (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>User</TableCell>
                          <TableCell align="right">Posts</TableCell>
                          <TableCell align="right">Comments</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topContributors.slice(0, 10).map((c) => (
                          <TableRow key={c.person_id} hover>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                {c.avatar && <Avatar src={c.avatar} sx={{ width: 20, height: 20 }} />}
                                <MuiLink
                                  component="button"
                                  variant="body2"
                                  onClick={() => navigate(`/users/${c.username}@${c.instance_domain}`)}
                                >
                                  @{c.username}
                                </MuiLink>
                              </Box>
                            </TableCell>
                            <TableCell align="right">{c.post_count}</TableCell>
                            <TableCell align="right">{c.comment_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No activity in this period</Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        ) : null}
      </TabPanel>

      {/* Post Voter Detail Dialog */}
      <Dialog
        open={!!voterDialog || voterLoading}
        onClose={() => { setVoterDialog(null); setVoterLoading(false); }}
        maxWidth="md"
        fullWidth
      >
        {voterLoading ? (
          <DialogContent>
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          </DialogContent>
        ) : voterDialog ? (
          <>
            <DialogTitle>
              <Typography variant="h6" noWrap>{voterDialog.post.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                by @{voterDialog.post.author_name} | {formatTimeAgo(voterDialog.post.published)} | Score: {voterDialog.post.score} ({voterDialog.post.upvotes} up / {voterDialog.post.downvotes} down)
              </Typography>
            </DialogTitle>
            <DialogContent>
              {/* Vote Timeline */}
              {voterDialog.timeline.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle2" gutterBottom>Vote Timeline (hourly)</Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={voterDialog.timeline.map(t => ({
                      hour: new Date(t.hour).toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit' }),
                      upvotes: t.upvotes,
                      downvotes: t.downvotes,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="upvotes" fill="#4caf50" name="Upvotes" />
                      <Bar dataKey="downvotes" fill="#f44336" name="Downvotes" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}

              {/* Voters Table */}
              <Typography variant="subtitle2" gutterBottom>Voters</Typography>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Vote</TableCell>
                      <TableCell>When</TableCell>
                      <TableCell>Account Age</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {voterDialog.voters.map((v, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <MuiLink
                            component="button"
                            variant="body2"
                            onClick={() => navigate(`/users/${v.username}@${v.instance_domain}`)}
                          >
                            @{v.username}
                            {!v.local && <Typography variant="caption" component="span">@{v.instance_domain}</Typography>}
                          </MuiLink>
                        </TableCell>
                        <TableCell>
                          {v.score === 1 ? (
                            <ThumbUp color="success" fontSize="small" />
                          ) : (
                            <ThumbDown color="error" fontSize="small" />
                          )}
                        </TableCell>
                        <TableCell>{formatTimeAgo(v.vote_time)}</TableCell>
                        <TableCell>{formatTimeAgo(v.account_created)}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="Ban from community">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBanDialog({ personId: v.person_id, username: v.username });
                              }}
                            >
                              <Gavel fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </DialogContent>
            <DialogActions>
              <Button
                href={`${config.lemmyInstanceUrl}/post/${voterDialog.post.id}`}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<OpenInNew />}
              >
                View on Lemmy
              </Button>
              <Button
                onClick={() => navigate(`/users/${voterDialog.post.author_name}@${voterDialog.post.author_instance}`)}
              >
                View Author Profile
              </Button>
              <Button onClick={() => setVoterDialog(null)}>Close</Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>

      {/* Downvote History Dialog */}
      <Dialog
        open={!!downvoteDialog || downvoteLoading}
        onClose={() => { setDownvoteDialog(null); setDownvoteLoading(false); }}
        maxWidth="md"
        fullWidth
      >
        {downvoteLoading ? (
          <DialogContent>
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          </DialogContent>
        ) : downvoteDialog ? (
          <>
            <DialogTitle>
              @{downvoteDialog.username} — Downvote History
            </DialogTitle>
            <DialogContent>
              {/* Site-wide context */}
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Site-wide: {downvoteDialog.history.siteWide.downvotes} downvotes, {downvoteDialog.history.siteWide.upvotes} upvotes
                  ({downvoteDialog.history.siteWide.downvotes + downvoteDialog.history.siteWide.upvotes > 0
                    ? Math.round((downvoteDialog.history.siteWide.downvotes / (downvoteDialog.history.siteWide.downvotes + downvoteDialog.history.siteWide.upvotes)) * 100)
                    : 0}% downvotes)
                </Typography>
              </Box>

              {/* Target Distribution */}
              {downvoteDialog.history.targets.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle2" gutterBottom>Target Distribution</Typography>
                  {downvoteDialog.history.targets.map((t) => {
                    const totalDown = downvoteDialog.history.targets.reduce((s, x) => s + x.downvote_count, 0);
                    const pct = totalDown > 0 ? Math.round((t.downvote_count / totalDown) * 100) : 0;
                    return (
                      <Box key={t.target_id} display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Box sx={{ width: `${pct}%`, minWidth: 4, bgcolor: 'error.main', height: 16, borderRadius: 1 }} />
                        <Typography variant="body2">
                          @{t.target_name} ({pct}%, {t.downvote_count} downvotes)
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}

              {/* Recent Downvotes */}
              <Typography variant="subtitle2" gutterBottom>Recent Downvotes</Typography>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Content</TableCell>
                      <TableCell>Author</TableCell>
                      <TableCell>When</TableCell>
                      <TableCell align="right">Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {downvoteDialog.history.recentDownvotes.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Chip
                            label={item.content_type}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.content_type === 'comment' && item.content_text
                            ? item.content_text
                            : item.title}
                        </TableCell>
                        <TableCell>@{item.author_name}</TableCell>
                        <TableCell>{formatTimeAgo(item.vote_time)}</TableCell>
                        <TableCell align="right">{item.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => navigate(`/users/${downvoteDialog.username}@${downvoteDialog.history.targets[0]?.target_instance || instanceDomain}`)}
                startIcon={<Person />}
              >
                View Full Profile
              </Button>
              <Button
                color="error"
                startIcon={<Gavel />}
                onClick={() => {
                  setBanDialog({ personId: downvoteDialog.userId, username: downvoteDialog.username });
                }}
              >
                Ban from Community
              </Button>
              <Button onClick={() => setDownvoteDialog(null)}>Close</Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>

      {/* Ban Dialog */}
      <Dialog open={!!banDialog} onClose={() => setBanDialog(null)} maxWidth="sm" fullWidth>
        {banDialog && (
          <>
            <DialogTitle>Ban @{banDialog.username} from !{community.name}</DialogTitle>
            <DialogContent>
              <TextField
                label="Reason"
                fullWidth
                multiline
                rows={2}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                sx={{ mt: 1, mb: 2 }}
              />
              <FormControl fullWidth>
                <InputLabel>Duration</InputLabel>
                <Select value={banDuration} label="Duration" onChange={(e) => setBanDuration(e.target.value)}>
                  <MenuItem value="1">1 day</MenuItem>
                  <MenuItem value="7">7 days</MenuItem>
                  <MenuItem value="30">30 days</MenuItem>
                  <MenuItem value="90">90 days</MenuItem>
                  <MenuItem value="365">1 year</MenuItem>
                  <MenuItem value="permanent">Permanent</MenuItem>
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setBanDialog(null)}>Cancel</Button>
              <Button
                color="error"
                variant="contained"
                onClick={handleBan}
                disabled={banLoading}
                startIcon={banLoading ? <CircularProgress size={16} /> : <Gavel />}
              >
                Ban
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};
