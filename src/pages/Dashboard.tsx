import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { People, Groups, Article, Forum, TrendingUp } from '@mui/icons-material';
import { lemmyService, GetSiteResponse } from '../services/lemmy';

export const Dashboard: React.FC = () => {
  const [siteData, setSiteData] = useState<GetSiteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSiteData = async () => {
      try {
        setLoading(true);
        const data = await lemmyService.getSite();
        setSiteData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching site data:', err);
        setError('Failed to load site statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchSiteData();
  }, []);

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

  const stats = siteData?.site_view.counts;
  const siteName = siteData?.site_view.site.name || 'Lemmy';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Welcome to the {siteName} Admin Portal
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <People color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4">{stats?.users.toLocaleString() || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Users
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Groups color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4">{stats?.communities.toLocaleString() || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Communities
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Article color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4">{stats?.posts.toLocaleString() || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Posts
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Forum color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4">{stats?.comments.toLocaleString() || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Comments
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" mb={2}>
              <TrendingUp color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Active Users</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Active Today
                </Typography>
                <Typography variant="h5">{stats?.users_active_day.toLocaleString() || 0}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Active This Week
                </Typography>
                <Typography variant="h5">{stats?.users_active_week.toLocaleString() || 0}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Active This Month
                </Typography>
                <Typography variant="h5">{stats?.users_active_month.toLocaleString() || 0}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Active (6 months)
                </Typography>
                <Typography variant="h5">
                  {stats?.users_active_half_year.toLocaleString() || 0}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Instance Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Instance Name
              </Typography>
              <Typography variant="body1" paragraph>
                {siteData?.site_view.site.name}
              </Typography>

              <Typography variant="body2" color="text.secondary" gutterBottom>
                Lemmy Version
              </Typography>
              <Typography variant="body1" paragraph>
                {siteData?.version}
              </Typography>

              {siteData?.site_view.site.description && (
                <>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Description
                  </Typography>
                  <Typography variant="body1">{siteData.site_view.site.description}</Typography>
                </>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
