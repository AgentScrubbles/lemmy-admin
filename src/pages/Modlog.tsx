import React from 'react';
import { Box, Typography } from '@mui/material';

export const Modlog: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Moderation Log
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Moderation log features will be implemented here.
      </Typography>
    </Box>
  );
};
