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
} from '@mui/material';
import {
  People,
  Article,
  Forum,
  TrendingUp,
  Public,
  Lock,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { lemmyService, CommunityView, GetPostsResponse } from '../services/lemmy';
import { config } from '../config';

interface CommunityWithStats extends CommunityView {
  recentPosts?: GetPostsResponse;
}

export const Communities: React.FC = () => {
  const { user } = useAuth();
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

        // Fetch detailed data for each moderated community
        const communityPromises = user.moderates.map(async (modView) => {
          try {
            const communityData = await lemmyService.getCommunity({
              id: modView.community.id,
            });

            // Fetch recent posts for this community
            const recentPosts = await lemmyService.getPosts({
              community_id: modView.community.id,
              limit: 5,
              sort: 'New',
            });

            return {
              ...communityData.community_view,
              recentPosts,
            };
          } catch (err) {
            console.error(`Error fetching data for community ${modView.community.name}:`, err);
            return null;
          }
        });

        const communityData = await Promise.all(communityPromises);
        const validCommunities: CommunityWithStats[] = communityData.filter(
          (c) => c !== null
        ) as CommunityWithStats[];
        setCommunities(validCommunities);
        setError(null);
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
          const { community, counts } = communityView;
          const communityUrl = `${config.lemmyInstanceUrl}/c/${community.name}`;

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
                          <Box display="flex" gap={1} mt={1}>
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
