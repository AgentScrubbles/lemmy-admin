import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Avatar,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link as MuiLink,
  Button,
  Skeleton,
} from '@mui/material';
import {
  People,
  Article,
  Forum,
  TrendingUp,
  Public,
  Lock,
  VisibilityOff,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  ArrowForward,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { lemmyService, CommunityView, GetPostsResponse } from '../services/lemmy';
import { backendAPI, CommunityDiagnosticsSummary } from '../services/backend';
import { config } from '../config';

interface CommunityWithStats extends CommunityView {
  recentPosts?: GetPostsResponse;
  diagnostics?: CommunityDiagnosticsSummary;
  diagnosticsLoading?: boolean;
}

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

export const Communities: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<CommunityWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCommunityData = async () => {
      if (!user?.moderates) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const communityPromises = user.moderates.map(async (modView) => {
          try {
            const communityData = await lemmyService.getCommunity({
              id: modView.community.id,
            });

            const recentPosts = await lemmyService.getPosts({
              community_id: modView.community.id,
              limit: 5,
              sort: 'New',
            });

            return {
              ...communityData.community_view,
              recentPosts,
              diagnosticsLoading: true,
            } as CommunityWithStats;
          } catch (err) {
            console.error(`Error fetching data for community ${modView.community.name}:`, err);
            return null;
          }
        });

        const communityData = await Promise.all(communityPromises);
        const validCommunities = communityData.filter(
          (c) => c !== null
        ) as CommunityWithStats[];
        setCommunities(validCommunities);
        setError(null);

        // Fetch diagnostics in parallel after initial render
        validCommunities.forEach(async (cv, idx) => {
          try {
            const diagnostics = await backendAPI.getCommunityDiagnosticsSummary(cv.community.id);
            setCommunities(prev => prev.map((c, i) =>
              i === idx ? { ...c, diagnostics, diagnosticsLoading: false } : c
            ));
          } catch (err) {
            console.error(`Error fetching diagnostics for ${cv.community.name}:`, err);
            setCommunities(prev => prev.map((c, i) =>
              i === idx ? { ...c, diagnosticsLoading: false } : c
            ));
          }
        });
      } catch (err) {
        console.error('Error fetching community data:', err);
        setError('Failed to load community data');
      } finally {
        setLoading(false);
      }
    };

    fetchCommunityData();
  }, [user]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (communities.length === 0) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Moderated Communities
        </Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          You are not moderating any communities.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Moderated Communities
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Communities you moderate ({communities.length})
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {communities.map((communityView) => {
          const { community, counts, diagnostics, diagnosticsLoading } = communityView;
          const communityUrl = `${config.lemmyInstanceUrl}/c/${community.name}`;
          const instanceDomain = new URL(config.lemmyInstanceUrl).hostname;
          const communityHandle = `${community.name}@${instanceDomain}`;

          return (
            <Grid item xs={12} key={community.id}>
              <Card>
                <CardContent>
                  <Grid container spacing={3}>
                    {/* Community Header */}
                    <Grid item xs={12} md={4}>
                      <Box display="flex" alignItems="start" mb={2}>
                        {community.icon && (
                          <Avatar
                            src={community.icon}
                            alt={community.name}
                            sx={{ width: 60, height: 60, mr: 2 }}
                          />
                        )}
                        <Box flexGrow={1}>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <MuiLink
                              href={communityUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              underline="hover"
                            >
                              <Typography variant="h6">{community.title}</Typography>
                            </MuiLink>
                            {community.nsfw && (
                              <Chip label="NSFW" color="error" size="small" />
                            )}
                            {community.hidden && (
                              <Chip
                                icon={<VisibilityOff />}
                                label="Hidden"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            !{community.name}
                          </Typography>
                          {community.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 1, maxHeight: 60, overflow: 'hidden' }}
                            >
                              {community.description}
                            </Typography>
                          )}
                          <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                            {community.local ? (
                              <Chip icon={<Public />} label="Local" size="small" />
                            ) : (
                              <Chip label="Federated" size="small" variant="outlined" />
                            )}
                            {community.posting_restricted_to_mods && (
                              <Chip
                                icon={<Lock />}
                                label="Mod Posts Only"
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {diagnosticsLoading ? (
                              <Skeleton width={80} height={24} />
                            ) : diagnostics ? (
                              <Chip
                                {...healthChipProps(diagnostics.healthStatus)}
                                size="small"
                                variant="filled"
                              />
                            ) : null}
                          </Box>
                        </Box>
                      </Box>
                    </Grid>

                    {/* Community Stats */}
                    <Grid item xs={12} md={8}>
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                            <People color="primary" sx={{ fontSize: 32 }} />
                            <Typography variant="h6">
                              {counts.subscribers.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Subscribers
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                            <Article color="primary" sx={{ fontSize: 32 }} />
                            <Typography variant="h6">{counts.posts.toLocaleString()}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Posts
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                            <Forum color="primary" sx={{ fontSize: 32 }} />
                            <Typography variant="h6">
                              {counts.comments.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Comments
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
                            <TrendingUp color="primary" sx={{ fontSize: 32 }} />
                            <Typography variant="h6">
                              {counts.users_active_day.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Active Today
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      {/* Diagnostics mini-stats */}
                      {diagnostics && (
                        <Box mt={2} display="flex" gap={2} flexWrap="wrap" alignItems="center">
                          <Chip
                            label={`${diagnostics.activePerWeek} active/wk`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={`${diagnostics.controversialCount} controversial`}
                            size="small"
                            variant="outlined"
                            color={diagnostics.controversialCount > 5 ? 'error' : diagnostics.controversialCount > 3 ? 'warning' : 'default'}
                          />
                          <Chip
                            label={`${diagnostics.downvoteRisk}% downvote risk`}
                            size="small"
                            variant="outlined"
                            color={diagnostics.downvoteRisk > 25 ? 'error' : diagnostics.downvoteRisk > 10 ? 'warning' : 'default'}
                          />
                          <Box flexGrow={1} />
                          <Button
                            variant="outlined"
                            size="small"
                            endIcon={<ArrowForward />}
                            onClick={() => navigate(`/communities/${communityHandle}`)}
                          >
                            Diagnostics
                          </Button>
                        </Box>
                      )}

                      {/* Active Users Over Time */}
                      <Box mt={2}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Active Users
                        </Typography>
                        <Grid container spacing={1}>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary">
                              Week:
                            </Typography>
                            <Typography variant="body2">
                              {counts.users_active_week.toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary">
                              Month:
                            </Typography>
                            <Typography variant="body2">
                              {counts.users_active_month.toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary">
                              6 Months:
                            </Typography>
                            <Typography variant="body2">
                              {counts.users_active_half_year.toLocaleString()}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    </Grid>

                    {/* Recent Posts */}
                    {communityView.recentPosts &&
                      communityView.recentPosts.posts.length > 0 && (
                        <Grid item xs={12}>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="h6" gutterBottom>
                            Recent Posts
                          </Typography>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Title</TableCell>
                                  <TableCell>Author</TableCell>
                                  <TableCell align="right">Score</TableCell>
                                  <TableCell align="right">Comments</TableCell>
                                  <TableCell>Created</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {communityView.recentPosts.posts.map((postView) => {
                                  const postUrl = `${config.lemmyInstanceUrl}/post/${postView.post.id}`;
                                  const postDate = new Date(postView.post.published);

                                  return (
                                    <TableRow key={postView.post.id} hover>
                                      <TableCell>
                                        <MuiLink
                                          href={postUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          underline="hover"
                                        >
                                          {postView.post.name}
                                        </MuiLink>
                                      </TableCell>
                                      <TableCell>{postView.creator.name}</TableCell>
                                      <TableCell align="right">
                                        {postView.counts.score}
                                      </TableCell>
                                      <TableCell align="right">
                                        {postView.counts.comments}
                                      </TableCell>
                                      <TableCell>
                                        {postDate.toLocaleDateString()}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>
                      )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};
