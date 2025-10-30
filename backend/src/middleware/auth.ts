import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { config } from '../config';

export interface AuthUser {
  id: number;
  name: string;
  admin: boolean;
  local: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      isAdmin?: boolean;
      authToken?: string;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'No authentication token provided' });
      return;
    }

    // Validate token by calling Lemmy's /site endpoint
    try {
      const response = await axios.get(`${config.lemmy.instanceUrl}/api/v3/site`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Check if user is authenticated (my_user exists)
      if (!response.data.my_user) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }

      const myUser = response.data.my_user.local_user_view;
      const person = myUser.person;
      const localUser = myUser.local_user;

      // Check if user is banned
      if (person.banned) {
        res.status(403).json({ error: 'User is banned' });
        return;
      }

      // Set user info on request
      req.user = {
        id: person.id,
        name: person.name,
        admin: localUser.admin,
        local: person.local,
      };
      req.isAdmin = localUser.admin;
      req.authToken = token;

      next();
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};
