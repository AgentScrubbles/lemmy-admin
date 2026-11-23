import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link as MuiLink,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { backendAPI, ThreativoreOpenVote } from '../services/backend';

export const OpenVotes: React.FC = () => {
  const [votes, setVotes] = useState<ThreativoreOpenVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await backendAPI.getOpenVotes();
      setVotes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err.response?.status === 503) {
        setError('Threativore is not configured on the backend.');
      } else {
        setError('Failed to load open votes.');
      }
      console.error('Error fetching open votes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVotes();
  }, []);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Open Governance Votes</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchVotes} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          <CardContent>
            {votes.length === 0 ? (
              <Typography variant="body1" color="text.secondary" textAlign="center" py={4}>
                No open governance votes at this time.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Post</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Expires</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {votes.map((vote, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>
                          <MuiLink
                            href={vote.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            underline="hover"
                          >
                            {vote.post_url}
                          </MuiLink>
                        </TableCell>
                        <TableCell>
                          <Chip label={vote.type} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{vote.user}</TableCell>
                        <TableCell>
                          {vote.expires
                            ? new Date(vote.expires).toLocaleString()
                            : 'No expiry'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
