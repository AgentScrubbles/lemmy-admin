import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { config } from '../config';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

const getThreativoreClient = () => {
  if (!config.threativore.url) {
    throw new Error('Threativore URL not configured');
  }
  return axios.create({
    baseURL: config.threativore.url,
    headers: {
      'Content-Type': 'application/json',
      apikey: config.threativore.apiKey,
    },
    timeout: 10000,
  });
};

// GET /user/:username
router.get('/user/:username', async (req: Request, res: Response) => {
  try {
    const client = getThreativoreClient();
    const response = await client.get(`/api/v1/user/${encodeURIComponent(req.params.username)}`);
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.message === 'Threativore URL not configured') {
      res.status(503).json({ error: 'Threativore not configured' });
    } else {
      console.error('Threativore proxy error:', error.message);
      res.status(502).json({ error: 'Failed to reach Threativore' });
    }
  }
});

// PUT /user/:username
router.put('/user/:username', async (req: Request, res: Response) => {
  try {
    const client = getThreativoreClient();
    const response = await client.put(`/api/v1/user/${encodeURIComponent(req.params.username)}`, req.body);
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Threativore proxy error:', error.message);
      res.status(502).json({ error: 'Failed to reach Threativore' });
    }
  }
});

// PATCH /user/:username
router.patch('/user/:username', async (req: Request, res: Response) => {
  try {
    const client = getThreativoreClient();
    const response = await client.patch(`/api/v1/user/${encodeURIComponent(req.params.username)}`, req.body);
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Threativore proxy error:', error.message);
      res.status(502).json({ error: 'Failed to reach Threativore' });
    }
  }
});

// DELETE /user/:username
router.delete('/user/:username', async (req: Request, res: Response) => {
  try {
    const client = getThreativoreClient();
    const response = await client.delete(`/api/v1/user/${encodeURIComponent(req.params.username)}`);
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Threativore proxy error:', error.message);
      res.status(502).json({ error: 'Failed to reach Threativore' });
    }
  }
});

// GET /tag/:tag
router.get('/tag/:tag', async (req: Request, res: Response) => {
  try {
    const client = getThreativoreClient();
    const response = await client.get(`/api/v1/tag/${encodeURIComponent(req.params.tag)}`);
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Threativore proxy error:', error.message);
      res.status(502).json({ error: 'Failed to reach Threativore' });
    }
  }
});

// POST /tag/:tag
router.post('/tag/:tag', async (req: Request, res: Response) => {
  try {
    const client = getThreativoreClient();
    const response = await client.post(`/api/v1/tag/${encodeURIComponent(req.params.tag)}`, req.body);
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Threativore proxy error:', error.message);
      res.status(502).json({ error: 'Failed to reach Threativore' });
    }
  }
});

// DELETE /tag/:tag
router.delete('/tag/:tag', async (req: Request, res: Response) => {
  try {
    const client = getThreativoreClient();
    const response = await client.delete(`/api/v1/tag/${encodeURIComponent(req.params.tag)}`, { data: req.body });
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Threativore proxy error:', error.message);
      res.status(502).json({ error: 'Failed to reach Threativore' });
    }
  }
});

// GET /votes
router.get('/votes', async (req: Request, res: Response) => {
  try {
    const client = getThreativoreClient();
    const response = await client.get('/api/v1/open_votes');
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Threativore proxy error:', error.message);
      res.status(502).json({ error: 'Failed to reach Threativore' });
    }
  }
});

export default router;
