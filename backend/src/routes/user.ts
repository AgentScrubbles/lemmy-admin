import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Apply authentication and admin check to all user routes
router.use(authenticateToken);
router.use(requireAdmin);

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT COUNT(*) FROM person');
    res.json({
      status: 'ok',
      database: 'connected',
      userCount: parseInt(result.rows[0].count, 10)
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      database: 'disconnected'
    });
  }
});

// Lookup user by handle (username@instance.tld)
router.get('/lookup/:userHandle', async (req: Request, res: Response) => {
  try {
    const userHandle = decodeURIComponent(req.params.userHandle);

    // Parse username@instance format
    const parts = userHandle.split('@');
    if (parts.length !== 2) {
      res.status(400).json({ error: 'Invalid user handle format. Expected: username@instance.tld' });
      return;
    }

    const [username, instanceDomain] = parts;

    // Lookup user by name and instance
    const result = await db.query(
      `SELECT p.id, p.name, i.domain as instance_domain
       FROM person p
       JOIN instance i ON i.id = p.instance_id
       WHERE LOWER(p.name) = LOWER($1) AND LOWER(i.domain) = LOWER($2)
       LIMIT 1`,
      [username, instanceDomain]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error looking up user by handle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Lookup community by handle (communityname@instance.tld)
router.get('/lookup-community/:communityHandle', async (req: Request, res: Response) => {
  try {
    const communityHandle = decodeURIComponent(req.params.communityHandle);

    // Parse communityname@instance format
    const parts = communityHandle.split('@');
    if (parts.length !== 2) {
      res.status(400).json({ error: 'Invalid community handle format. Expected: communityname@instance.tld' });
      return;
    }

    const [communityName, instanceDomain] = parts;

    // Lookup community by name and instance
    const result = await db.query(
      `SELECT c.id, c.name, c.title, i.domain as instance_domain
       FROM community c
       JOIN instance i ON i.id = c.instance_id
       WHERE LOWER(c.name) = LOWER($1) AND LOWER(i.domain) = LOWER($2)
       LIMIT 1`,
      [communityName, instanceDomain]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error looking up community by handle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user basic details by ID
router.get('/:userId/details', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Join with person_aggregates for stats
    const result = await db.query(
      `SELECT
        p.id,
        p.name,
        p.display_name,
        p.avatar,
        p.published as published_at,
        p.bio,
        p.local,
        p.bot_account,
        p.deleted,
        p.banned,
        pa.post_count,
        pa.post_score,
        pa.comment_count,
        pa.comment_score,
        p.instance_id,
        i.domain as instance_domain
      FROM person p
      LEFT JOIN person_aggregates pa ON pa.person_id = p.id
      JOIN instance i ON i.id = p.instance_id
      WHERE p.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];

    // Parse numeric fields to prevent string concatenation issues
    res.json({
      ...user,
      post_count: parseInt(user.post_count) || 0,
      post_score: parseInt(user.post_score) || 0,
      comment_count: parseInt(user.comment_count) || 0,
      comment_score: parseInt(user.comment_score) || 0,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user voting patterns
router.get('/:userId/voting-patterns', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const communityId = req.query.communityId ? parseInt(req.query.communityId as string, 10) : null;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Get voting statistics (votes GIVEN by this user)
    const votingQuery = communityId
      ? `SELECT
          COUNT(*) FILTER (WHERE pl.score = 1) as upvotes_given,
          COUNT(*) FILTER (WHERE pl.score = -1) as downvotes_given,
          COUNT(*) as total_votes,
          COUNT(DISTINCT p.community_id) as communities_voted_in
        FROM post_like pl
        JOIN post p ON pl.post_id = p.id
        WHERE pl.person_id = $1
          AND p.community_id = $2
        UNION ALL
        SELECT
          COUNT(*) FILTER (WHERE cl.score = 1) as upvotes_given,
          COUNT(*) FILTER (WHERE cl.score = -1) as downvotes_given,
          COUNT(*) as total_votes,
          COUNT(DISTINCT p.community_id) as communities_voted_in
        FROM comment_like cl
        JOIN comment c ON cl.comment_id = c.id
        JOIN post p ON c.post_id = p.id
        WHERE cl.person_id = $1
          AND p.community_id = $2`
      : `SELECT
          COUNT(*) FILTER (WHERE pl.score = 1) as upvotes_given,
          COUNT(*) FILTER (WHERE pl.score = -1) as downvotes_given,
          COUNT(*) as total_votes,
          COUNT(DISTINCT p.community_id) as communities_voted_in
        FROM post_like pl
        JOIN post p ON pl.post_id = p.id
        WHERE pl.person_id = $1
        UNION ALL
        SELECT
          COUNT(*) FILTER (WHERE cl.score = 1) as upvotes_given,
          COUNT(*) FILTER (WHERE cl.score = -1) as downvotes_given,
          COUNT(*) as total_votes,
          COUNT(DISTINCT p.community_id) as communities_voted_in
        FROM comment_like cl
        JOIN comment c ON cl.comment_id = c.id
        JOIN post p ON c.post_id = p.id
        WHERE cl.person_id = $1`;

    const params = communityId ? [userId, communityId] : [userId];
    const result = await db.query(votingQuery, params);

    // Sum up the results from both queries
    const upvotesGiven = result.rows.reduce((sum, row) => sum + parseInt(row.upvotes_given), 0);
    const downvotesGiven = result.rows.reduce((sum, row) => sum + parseInt(row.downvotes_given), 0);
    const totalVotes = result.rows.reduce((sum, row) => sum + parseInt(row.total_votes), 0);

    // Get votes RECEIVED on user's content (aggregate from individual posts/comments)
    const receivedPostsQuery = communityId
      ? await db.query(
          `SELECT
            COALESCE(SUM(pa.upvotes), 0) as post_upvotes,
            COALESCE(SUM(pa.downvotes), 0) as post_downvotes,
            COALESCE(SUM(pa.score), 0) as post_score
          FROM post p
          JOIN post_aggregates pa ON pa.post_id = p.id
          WHERE p.creator_id = $1 AND p.community_id = $2`,
          [userId, communityId]
        )
      : await db.query(
          `SELECT
            COALESCE(SUM(pa.upvotes), 0) as post_upvotes,
            COALESCE(SUM(pa.downvotes), 0) as post_downvotes,
            COALESCE(SUM(pa.score), 0) as post_score
          FROM post p
          JOIN post_aggregates pa ON pa.post_id = p.id
          WHERE p.creator_id = $1`,
          [userId]
        );

    const receivedCommentsQuery = communityId
      ? await db.query(
          `SELECT
            COALESCE(SUM(ca.upvotes), 0) as comment_upvotes,
            COALESCE(SUM(ca.downvotes), 0) as comment_downvotes,
            COALESCE(SUM(ca.score), 0) as comment_score
          FROM comment c
          JOIN comment_aggregates ca ON ca.comment_id = c.id
          JOIN post p ON p.id = c.post_id
          WHERE c.creator_id = $1 AND p.community_id = $2`,
          [userId, communityId]
        )
      : await db.query(
          `SELECT
            COALESCE(SUM(ca.upvotes), 0) as comment_upvotes,
            COALESCE(SUM(ca.downvotes), 0) as comment_downvotes,
            COALESCE(SUM(ca.score), 0) as comment_score
          FROM comment c
          JOIN comment_aggregates ca ON ca.comment_id = c.id
          WHERE c.creator_id = $1`,
          [userId]
        );

    const postVotes = receivedPostsQuery.rows[0] || { post_upvotes: 0, post_downvotes: 0, post_score: 0 };
    const commentVotes = receivedCommentsQuery.rows[0] || { comment_upvotes: 0, comment_downvotes: 0, comment_score: 0 };

    // Parse all values as integers
    const postUpvotes = parseInt(postVotes.post_upvotes) || 0;
    const postDownvotes = parseInt(postVotes.post_downvotes) || 0;
    const postScore = parseInt(postVotes.post_score) || 0;
    const commentUpvotes = parseInt(commentVotes.comment_upvotes) || 0;
    const commentDownvotes = parseInt(commentVotes.comment_downvotes) || 0;
    const commentScore = parseInt(commentVotes.comment_score) || 0;

    res.json({
      votesGiven: {
        upvotes: upvotesGiven,
        downvotes: downvotesGiven,
        total: totalVotes,
        upvoteRate: totalVotes > 0 ? (upvotesGiven / totalVotes) : 0
      },
      votesReceived: {
        posts: {
          upvotes: postUpvotes,
          downvotes: postDownvotes,
          score: postScore
        },
        comments: {
          upvotes: commentUpvotes,
          downvotes: commentDownvotes,
          score: commentScore
        },
        // Legacy fields for backward compatibility
        postScore: postScore,
        commentScore: commentScore,
        totalScore: postScore + commentScore
      }
    });
  } catch (error) {
    console.error('Error fetching voting patterns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user activity over time
router.get('/:userId/activity-timeline', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const communityId = req.query.communityId ? parseInt(req.query.communityId as string, 10) : null;
    const weeks = parseInt(req.query.weeks as string, 10) || 12;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Get posts and comments grouped by week
    const timelineQuery = communityId
      ? `SELECT
          date_trunc('week', p.published) as week,
          'post' as type,
          COUNT(*) as count,
          SUM(pa.score) as total_score,
          SUM(pa.upvotes) as upvotes,
          SUM(pa.downvotes) as downvotes
        FROM post p
        JOIN post_aggregates pa ON pa.post_id = p.id
        WHERE p.creator_id = $1
          AND p.community_id = $2
          AND p.published > NOW() - INTERVAL '${weeks} weeks'
        GROUP BY week
        UNION ALL
        SELECT
          date_trunc('week', c.published) as week,
          'comment' as type,
          COUNT(*) as count,
          SUM(ca.score) as total_score,
          SUM(ca.upvotes) as upvotes,
          SUM(ca.downvotes) as downvotes
        FROM comment c
        JOIN comment_aggregates ca ON ca.comment_id = c.id
        JOIN post p ON c.post_id = p.id
        WHERE c.creator_id = $1
          AND p.community_id = $2
          AND c.published > NOW() - INTERVAL '${weeks} weeks'
        GROUP BY week
        ORDER BY week ASC`
      : `SELECT
          date_trunc('week', p.published) as week,
          'post' as type,
          COUNT(*) as count,
          SUM(pa.score) as total_score,
          SUM(pa.upvotes) as upvotes,
          SUM(pa.downvotes) as downvotes
        FROM post p
        JOIN post_aggregates pa ON pa.post_id = p.id
        WHERE p.creator_id = $1
          AND p.published > NOW() - INTERVAL '${weeks} weeks'
        GROUP BY week
        UNION ALL
        SELECT
          date_trunc('week', c.published) as week,
          'comment' as type,
          COUNT(*) as count,
          SUM(ca.score) as total_score,
          SUM(ca.upvotes) as upvotes,
          SUM(ca.downvotes) as downvotes
        FROM comment c
        JOIN comment_aggregates ca ON ca.comment_id = c.id
        WHERE c.creator_id = $1
          AND c.published > NOW() - INTERVAL '${weeks} weeks'
        GROUP BY week
        ORDER BY week ASC`;

    const params = communityId ? [userId, communityId] : [userId];
    const result = await db.query(timelineQuery, params);

    // Group by week and aggregate
    const weeklyData = new Map();
    result.rows.forEach(row => {
      const weekKey = row.week.toISOString().split('T')[0];
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          week: weekKey,
          posts: 0,
          comments: 0,
          totalScore: 0,
          upvotes: 0,
          downvotes: 0
        });
      }
      const data = weeklyData.get(weekKey);
      if (row.type === 'post') {
        data.posts = parseInt(row.count);
      } else {
        data.comments = parseInt(row.count);
      }
      data.totalScore += parseInt(row.total_score) || 0;
      data.upvotes += parseInt(row.upvotes) || 0;
      data.downvotes += parseInt(row.downvotes) || 0;
    });

    res.json(Array.from(weeklyData.values()));
  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user community participation breakdown
router.get('/:userId/community-breakdown', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Get activity breakdown by community - optimized query
    // This aggregates post and comment activity separately then combines them
    const result = await db.query(
      `WITH user_post_communities AS (
        SELECT
          c.id,
          c.name,
          c.title,
          i.domain as instance_domain,
          COUNT(p.id) as post_count,
          COALESCE(SUM(pa.score), 0) as post_score,
          MAX(p.published) as last_post_at
        FROM post p
        JOIN post_aggregates pa ON pa.post_id = p.id
        JOIN community c ON c.id = p.community_id
        JOIN instance i ON i.id = c.instance_id
        WHERE p.creator_id = $1
        GROUP BY c.id, c.name, c.title, i.domain
      ),
      user_comment_communities AS (
        SELECT
          c.id,
          c.name,
          c.title,
          i.domain as instance_domain,
          COUNT(cm.id) as comment_count,
          COALESCE(SUM(ca.score), 0) as comment_score,
          MAX(cm.published) as last_comment_at
        FROM comment cm
        JOIN comment_aggregates ca ON ca.comment_id = cm.id
        JOIN post p ON p.id = cm.post_id
        JOIN community c ON c.id = p.community_id
        JOIN instance i ON i.id = c.instance_id
        WHERE cm.creator_id = $1
        GROUP BY c.id, c.name, c.title, i.domain
      )
      SELECT
        COALESCE(pc.id, cc.id) as community_id,
        COALESCE(pc.name, cc.name) as community_name,
        COALESCE(pc.title, cc.title) as community_title,
        COALESCE(pc.instance_domain, cc.instance_domain) as instance_domain,
        COALESCE(pc.post_count, 0) as post_count,
        COALESCE(cc.comment_count, 0) as comment_count,
        COALESCE(pc.post_score, 0) as post_score,
        COALESCE(cc.comment_score, 0) as comment_score,
        GREATEST(
          COALESCE(pc.last_post_at, '1970-01-01'::timestamp),
          COALESCE(cc.last_comment_at, '1970-01-01'::timestamp)
        ) as last_activity
      FROM user_post_communities pc
      FULL OUTER JOIN user_comment_communities cc ON pc.id = cc.id
      ORDER BY (COALESCE(pc.post_count, 0) + COALESCE(cc.comment_count, 0)) DESC
      LIMIT 20`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching community breakdown:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's most recent posts and comments
router.get('/:userId/recent-content', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const communityId = req.query.communityId ? parseInt(req.query.communityId as string, 10) : null;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const contentType = req.query.type as string; // 'posts', 'comments', or undefined for both

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    if (contentType === 'posts' || !contentType) {
      const postsQuery = communityId
        ? `SELECT
            p.id,
            p.name,
            p.url,
            p.published as published_at,
            pa.score,
            pa.upvotes,
            pa.downvotes,
            pa.comments as comment_count,
            p.community_id,
            c.name as community_name,
            c.title as community_title,
            i.domain as instance_domain
          FROM post p
          JOIN post_aggregates pa ON pa.post_id = p.id
          JOIN community c ON p.community_id = c.id
          JOIN instance i ON i.id = c.instance_id
          WHERE p.creator_id = $1 AND p.community_id = $2
          ORDER BY p.published DESC
          LIMIT $3`
        : `SELECT
            p.id,
            p.name,
            p.url,
            p.published as published_at,
            pa.score,
            pa.upvotes,
            pa.downvotes,
            pa.comments as comment_count,
            p.community_id,
            c.name as community_name,
            c.title as community_title,
            i.domain as instance_domain
          FROM post p
          JOIN post_aggregates pa ON pa.post_id = p.id
          JOIN community c ON p.community_id = c.id
          JOIN instance i ON i.id = c.instance_id
          WHERE p.creator_id = $1
          ORDER BY p.published DESC
          LIMIT $2`;

      const params = communityId ? [userId, communityId, limit] : [userId, limit];
      const postsResult = await db.query(postsQuery, params);

      if (contentType === 'posts') {
        res.json({ posts: postsResult.rows });
        return;
      }
    }

    if (contentType === 'comments' || !contentType) {
      const commentsQuery = communityId
        ? `SELECT
            cm.id,
            cm.content,
            cm.published as published_at,
            ca.score,
            ca.upvotes,
            ca.downvotes,
            cm.post_id,
            p.name as post_name,
            p.community_id,
            c.name as community_name,
            c.title as community_title,
            i.domain as instance_domain
          FROM comment cm
          JOIN comment_aggregates ca ON ca.comment_id = cm.id
          JOIN post p ON cm.post_id = p.id
          JOIN community c ON p.community_id = c.id
          JOIN instance i ON i.id = c.instance_id
          WHERE cm.creator_id = $1 AND p.community_id = $2
          ORDER BY cm.published DESC
          LIMIT $3`
        : `SELECT
            cm.id,
            cm.content,
            cm.published as published_at,
            ca.score,
            ca.upvotes,
            ca.downvotes,
            cm.post_id,
            p.name as post_name,
            p.community_id,
            c.name as community_name,
            c.title as community_title,
            i.domain as instance_domain
          FROM comment cm
          JOIN comment_aggregates ca ON ca.comment_id = cm.id
          JOIN post p ON cm.post_id = p.id
          JOIN community c ON p.community_id = c.id
          JOIN instance i ON i.id = c.instance_id
          WHERE cm.creator_id = $1
          ORDER BY cm.published DESC
          LIMIT $2`;

      const params = communityId ? [userId, communityId, limit] : [userId, limit];
      const commentsResult = await db.query(commentsQuery, params);

      if (contentType === 'comments') {
        res.json({ comments: commentsResult.rows });
        return;
      }

      // Return both if no specific type requested
      const postsQuery = communityId
        ? `SELECT
            p.id,
            p.name,
            p.url,
            p.published as published_at,
            pa.score,
            pa.upvotes,
            pa.downvotes,
            pa.comments as comment_count,
            p.community_id,
            c.name as community_name,
            c.title as community_title,
            i.domain as instance_domain
          FROM post p
          JOIN post_aggregates pa ON pa.post_id = p.id
          JOIN community c ON p.community_id = c.id
          JOIN instance i ON i.id = c.instance_id
          WHERE p.creator_id = $1 AND p.community_id = $2
          ORDER BY p.published DESC
          LIMIT $3`
        : `SELECT
            p.id,
            p.name,
            p.url,
            p.published as published_at,
            pa.score,
            pa.upvotes,
            pa.downvotes,
            pa.comments as comment_count,
            p.community_id,
            c.name as community_name,
            c.title as community_title,
            i.domain as instance_domain
          FROM post p
          JOIN post_aggregates pa ON pa.post_id = p.id
          JOIN community c ON p.community_id = c.id
          JOIN instance i ON i.id = c.instance_id
          WHERE p.creator_id = $1
          ORDER BY p.published DESC
          LIMIT $2`;

      const postsParams = communityId ? [userId, communityId, limit] : [userId, limit];
      const postsResult = await db.query(postsQuery, postsParams);

      res.json({
        posts: postsResult.rows,
        comments: commentsResult.rows
      });
    }
  } catch (error) {
    console.error('Error fetching recent content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user behavior analysis (troll indicators, controversy, etc.)
router.get('/:userId/behavior-analysis', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const communityId = req.query.communityId ? parseInt(req.query.communityId as string, 10) : null;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Calculate controversy metrics
    const controversyQuery = communityId
      ? `SELECT
          COUNT(DISTINCT p.id) as total_posts,
          COUNT(DISTINCT c.id) as total_comments,
          AVG(CASE WHEN pa.upvotes + pa.downvotes > 0
            THEN CAST(pa.downvotes AS FLOAT) / (pa.upvotes + pa.downvotes)
            ELSE 0 END) as avg_post_controversy,
          AVG(CASE WHEN ca.upvotes + ca.downvotes > 0
            THEN CAST(ca.downvotes AS FLOAT) / (ca.upvotes + ca.downvotes)
            ELSE 0 END) as avg_comment_controversy,
          COUNT(DISTINCT CASE WHEN pa.downvotes > pa.upvotes THEN p.id END) as negative_posts,
          COUNT(DISTINCT CASE WHEN ca.downvotes > ca.upvotes THEN c.id END) as negative_comments
        FROM person per
        LEFT JOIN post p ON p.creator_id = per.id AND p.community_id = $2
        LEFT JOIN post_aggregates pa ON pa.post_id = p.id
        LEFT JOIN comment c ON c.creator_id = per.id AND c.post_id IN (
          SELECT id FROM post WHERE community_id = $2
        )
        LEFT JOIN comment_aggregates ca ON ca.comment_id = c.id
        WHERE per.id = $1`
      : `SELECT
          COUNT(DISTINCT p.id) as total_posts,
          COUNT(DISTINCT c.id) as total_comments,
          AVG(CASE WHEN pa.upvotes + pa.downvotes > 0
            THEN CAST(pa.downvotes AS FLOAT) / (pa.upvotes + pa.downvotes)
            ELSE 0 END) as avg_post_controversy,
          AVG(CASE WHEN ca.upvotes + ca.downvotes > 0
            THEN CAST(ca.downvotes AS FLOAT) / (ca.upvotes + ca.downvotes)
            ELSE 0 END) as avg_comment_controversy,
          COUNT(DISTINCT CASE WHEN pa.downvotes > pa.upvotes THEN p.id END) as negative_posts,
          COUNT(DISTINCT CASE WHEN ca.downvotes > ca.upvotes THEN c.id END) as negative_comments
        FROM person per
        LEFT JOIN post p ON p.creator_id = per.id
        LEFT JOIN post_aggregates pa ON pa.post_id = p.id
        LEFT JOIN comment c ON c.creator_id = per.id
        LEFT JOIN comment_aggregates ca ON ca.comment_id = c.id
        WHERE per.id = $1`;

    const params = communityId ? [userId, communityId] : [userId];
    const result = await db.query(controversyQuery, params);
    const data = result.rows[0];

    // Calculate behavior indicators
    const totalContent = parseInt(data.total_posts) + parseInt(data.total_comments);
    const negativeContent = parseInt(data.negative_posts) + parseInt(data.negative_comments);
    const negativeRate = totalContent > 0 ? negativeContent / totalContent : 0;
    const avgControversy = (parseFloat(data.avg_post_controversy || 0) + parseFloat(data.avg_comment_controversy || 0)) / 2;

    // Determine behavior type
    let behaviorType = 'neutral';
    let behaviorScore = 0;

    if (negativeRate > 0.6) {
      behaviorType = 'troll';
      behaviorScore = negativeRate * 100;
    } else if (negativeRate > 0.4 || avgControversy > 0.4) {
      behaviorType = 'controversial';
      behaviorScore = Math.max(negativeRate, avgControversy) * 100;
    } else if (negativeRate < 0.2 && totalContent > 10) {
      behaviorType = 'contributor';
      behaviorScore = (1 - negativeRate) * 100;
    }

    res.json({
      behaviorType,
      behaviorScore: Math.round(behaviorScore),
      metrics: {
        totalPosts: parseInt(data.total_posts),
        totalComments: parseInt(data.total_comments),
        negativePosts: parseInt(data.negative_posts),
        negativeComments: parseInt(data.negative_comments),
        negativeRate: Math.round(negativeRate * 100),
        avgControversy: Math.round(avgControversy * 100)
      }
    });
  } catch (error) {
    console.error('Error analyzing user behavior:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users by username
router.get('/search/:query', async (req: Request, res: Response) => {
  try {
    const query = req.params.query;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    if (!query || query.length < 2) {
      res.status(400).json({ error: 'Query must be at least 2 characters' });
      return;
    }

    const result = await db.query(
      `SELECT
        p.id,
        p.name,
        p.display_name,
        p.avatar,
        p.local,
        p.bot_account,
        pa.post_count,
        pa.post_score,
        pa.comment_count,
        pa.comment_score,
        i.domain as instance_domain
      FROM person p
      LEFT JOIN person_aggregates pa ON pa.person_id = p.id
      JOIN instance i ON i.id = p.instance_id
      WHERE p.name ILIKE $1 OR p.display_name ILIKE $1
      ORDER BY pa.comment_count DESC, pa.post_count DESC
      LIMIT $2`,
      [`%${query}%`, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
