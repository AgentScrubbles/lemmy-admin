import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// GET /:id/diagnostics/summary
// Health score, red flags, engagement %, downvote risk, controversy count
router.get('/:id/diagnostics/summary', async (req: Request, res: Response) => {
  try {
    const communityId = parseInt(req.params.id, 10);
    if (isNaN(communityId)) {
      res.status(400).json({ error: 'Invalid community ID' });
      return;
    }

    // Engagement: % positive votes (posts + comments) in last 30 days
    const engagementResult = await db.query(
      `SELECT
        COALESCE(SUM(pa.upvotes), 0) as total_upvotes,
        COALESCE(SUM(pa.downvotes), 0) as total_downvotes
      FROM post p
      JOIN post_aggregates pa ON pa.post_id = p.id
      WHERE p.community_id = $1
        AND p.published > NOW() - INTERVAL '30 days'`,
      [communityId]
    );

    const commentEngagement = await db.query(
      `SELECT
        COALESCE(SUM(ca.upvotes), 0) as total_upvotes,
        COALESCE(SUM(ca.downvotes), 0) as total_downvotes
      FROM comment c
      JOIN comment_aggregates ca ON ca.comment_id = c.id
      JOIN post p ON c.post_id = p.id
      WHERE p.community_id = $1
        AND c.published > NOW() - INTERVAL '30 days'`,
      [communityId]
    );

    const postUp = parseInt(engagementResult.rows[0].total_upvotes) || 0;
    const postDown = parseInt(engagementResult.rows[0].total_downvotes) || 0;
    const commentUp = parseInt(commentEngagement.rows[0].total_upvotes) || 0;
    const commentDown = parseInt(commentEngagement.rows[0].total_downvotes) || 0;
    const totalUp = postUp + commentUp;
    const totalDown = postDown + commentDown;
    const totalVotes = totalUp + totalDown;
    const engagementScore = totalVotes > 0 ? Math.round((totalUp / totalVotes) * 100) : 100;

    // Controversial posts (30 days): posts where min(up, down) >= 3
    const controversialResult = await db.query(
      `SELECT COUNT(*) as count
      FROM post p
      JOIN post_aggregates pa ON pa.post_id = p.id
      WHERE p.community_id = $1
        AND p.published > NOW() - INTERVAL '30 days'
        AND LEAST(pa.upvotes, pa.downvotes) >= 3`,
      [communityId]
    );
    const controversialCount = parseInt(controversialResult.rows[0].count) || 0;

    // Downvote risk: % of total votes that are downvotes in last 30 days
    const downvoteRisk = totalVotes > 0 ? Math.round((totalDown / totalVotes) * 100) : 0;

    // Serial downvoters (90 days): users with >= 5 downvotes and >= 70% downvote ratio
    const serialDownvoterResult = await db.query(
      `WITH user_votes AS (
        SELECT
          pl.person_id,
          COUNT(*) FILTER (WHERE pl.score = -1) as downvotes,
          COUNT(*) FILTER (WHERE pl.score = 1) as upvotes
        FROM post_like pl
        JOIN post p ON pl.post_id = p.id
        WHERE p.community_id = $1
          AND pl.published > NOW() - INTERVAL '90 days'
        GROUP BY pl.person_id
        UNION ALL
        SELECT
          cl.person_id,
          COUNT(*) FILTER (WHERE cl.score = -1) as downvotes,
          COUNT(*) FILTER (WHERE cl.score = 1) as upvotes
        FROM comment_like cl
        JOIN comment c ON cl.comment_id = c.id
        JOIN post p ON c.post_id = p.id
        WHERE p.community_id = $1
          AND cl.published > NOW() - INTERVAL '90 days'
        GROUP BY cl.person_id
      ),
      aggregated AS (
        SELECT
          person_id,
          SUM(downvotes) as total_down,
          SUM(upvotes) as total_up
        FROM user_votes
        GROUP BY person_id
      )
      SELECT COUNT(*) as count
      FROM aggregated
      WHERE total_down >= 5
        AND total_down::float / GREATEST(total_down + total_up, 1) >= 0.7`,
      [communityId]
    );
    const serialDownvoterCount = parseInt(serialDownvoterResult.rows[0].count) || 0;

    // Posts with vote anomalies in last 7 days
    const anomalyResult = await db.query(
      `WITH community_avg AS (
        SELECT AVG(pa.upvotes + pa.downvotes) as avg_votes
        FROM post p
        JOIN post_aggregates pa ON pa.post_id = p.id
        WHERE p.community_id = $1
          AND p.published > NOW() - INTERVAL '30 days'
      )
      SELECT COUNT(*) as count
      FROM post p
      JOIN post_aggregates pa ON pa.post_id = p.id
      CROSS JOIN community_avg ca
      WHERE p.community_id = $1
        AND p.published > NOW() - INTERVAL '7 days'
        AND (pa.upvotes + pa.downvotes) > GREATEST(ca.avg_votes * 2, 10)
        AND (pa.upvotes + pa.downvotes > 0)
        AND (LEAST(pa.upvotes, pa.downvotes)::float / GREATEST(pa.upvotes + pa.downvotes, 1) > 0.3)`,
      [communityId]
    );
    const recentAnomalyCount = parseInt(anomalyResult.rows[0].count) || 0;

    // Active users per week (last 7 days)
    const activeResult = await db.query(
      `SELECT COUNT(DISTINCT creator_id) as active_users
      FROM (
        SELECT p.creator_id FROM post p
        WHERE p.community_id = $1 AND p.published > NOW() - INTERVAL '7 days'
        UNION
        SELECT c.creator_id FROM comment c
        JOIN post p ON c.post_id = p.id
        WHERE p.community_id = $1 AND c.published > NOW() - INTERVAL '7 days'
      ) u`,
      [communityId]
    );
    const activePerWeek = parseInt(activeResult.rows[0].active_users) || 0;

    // Health status
    let healthStatus: 'healthy' | 'watch' | 'at_risk' = 'healthy';
    if (downvoteRisk > 25 || controversialCount > 5 || recentAnomalyCount > 0) {
      healthStatus = 'at_risk';
    } else if (downvoteRisk > 10 || controversialCount > 3) {
      healthStatus = 'watch';
    }

    res.json({
      engagementScore,
      controversialCount,
      downvoteRisk,
      serialDownvoterCount,
      recentAnomalyCount,
      activePerWeek,
      healthStatus,
      redFlags: [
        ...(serialDownvoterCount > 0 ? [`${serialDownvoterCount} potential serial downvoter${serialDownvoterCount > 1 ? 's' : ''} detected (90 days)`] : []),
        ...(recentAnomalyCount > 0 ? [`${recentAnomalyCount} post${recentAnomalyCount > 1 ? 's' : ''} with vote anomaly in last 7 days`] : []),
        ...(controversialCount > 5 ? [`${controversialCount} controversial posts in last 30 days`] : []),
      ],
    });
  } catch (error) {
    console.error('Error fetching community diagnostics summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/diagnostics/vote-brigading
// Posts with unusual vote patterns sorted by anomaly
router.get('/:id/diagnostics/vote-brigading', async (req: Request, res: Response) => {
  try {
    const communityId = parseInt(req.params.id, 10);
    const days = parseInt(req.query.days as string, 10) || 30;
    if (isNaN(communityId)) {
      res.status(400).json({ error: 'Invalid community ID' });
      return;
    }

    const result = await db.query(
      `WITH community_avg AS (
        SELECT
          AVG(pa.upvotes + pa.downvotes) as avg_votes,
          STDDEV(pa.upvotes + pa.downvotes) as stddev_votes
        FROM post p
        JOIN post_aggregates pa ON pa.post_id = p.id
        WHERE p.community_id = $1
          AND p.published > NOW() - INTERVAL '${days} days'
          AND pa.upvotes + pa.downvotes > 0
      )
      SELECT
        p.id as post_id,
        p.name as title,
        p.published,
        p.ap_id,
        per.name as author_name,
        per.id as author_id,
        i.domain as author_instance,
        pa.score,
        pa.upvotes,
        pa.downvotes,
        CASE WHEN pa.upvotes + pa.downvotes > 0
          THEN ROUND(pa.upvotes::numeric / (pa.upvotes + pa.downvotes) * 100)
          ELSE 100
        END as upvote_ratio,
        pa.upvotes + pa.downvotes as total_votes,
        ca.avg_votes,
        CASE
          WHEN pa.upvotes + pa.downvotes > 0 AND (
            ROUND(pa.upvotes::numeric / (pa.upvotes + pa.downvotes) * 100) < 30
            OR (pa.upvotes + pa.downvotes) > GREATEST(ca.avg_votes * 2, 10)
          ) AND LEAST(pa.upvotes, pa.downvotes) >= 3
          THEN 'HIGH'
          WHEN pa.upvotes + pa.downvotes > 0 AND (
            ROUND(pa.upvotes::numeric / (pa.upvotes + pa.downvotes) * 100) < 45
            OR (pa.upvotes + pa.downvotes) > GREATEST(ca.avg_votes * 1.5, 8)
          ) AND LEAST(pa.upvotes, pa.downvotes) >= 2
          THEN 'MED'
          ELSE 'LOW'
        END as anomaly
      FROM post p
      JOIN post_aggregates pa ON pa.post_id = p.id
      JOIN person per ON per.id = p.creator_id
      JOIN instance i ON i.id = per.instance_id
      CROSS JOIN community_avg ca
      WHERE p.community_id = $1
        AND p.published > NOW() - INTERVAL '${days} days'
        AND pa.upvotes + pa.downvotes >= 3
      ORDER BY
        CASE
          WHEN ROUND(pa.upvotes::numeric / (pa.upvotes + pa.downvotes) * 100) < 30
            OR (pa.upvotes + pa.downvotes) > GREATEST(ca.avg_votes * 2, 10)
          THEN 0
          WHEN ROUND(pa.upvotes::numeric / (pa.upvotes + pa.downvotes) * 100) < 45
            OR (pa.upvotes + pa.downvotes) > GREATEST(ca.avg_votes * 1.5, 8)
          THEN 1
          ELSE 2
        END ASC,
        LEAST(pa.upvotes, pa.downvotes) DESC
      LIMIT 50`,
      [communityId]
    );

    res.json(result.rows.map(row => ({
      ...row,
      score: parseInt(row.score),
      upvotes: parseInt(row.upvotes),
      downvotes: parseInt(row.downvotes),
      upvote_ratio: parseInt(row.upvote_ratio),
      total_votes: parseInt(row.total_votes),
      avg_votes: parseFloat(row.avg_votes) || 0,
    })));
  } catch (error) {
    console.error('Error fetching vote brigading data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/diagnostics/post/:postId/voters
// Vote timeline + voter list for a single post
router.get('/:id/diagnostics/post/:postId/voters', async (req: Request, res: Response) => {
  try {
    const communityId = parseInt(req.params.id, 10);
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(communityId) || isNaN(postId)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    // Voter list with account age
    const votersResult = await db.query(
      `SELECT
        pl.person_id,
        per.name as username,
        i.domain as instance_domain,
        pl.score,
        pl.published as vote_time,
        per.published as account_created,
        per.local,
        per.bot_account
      FROM post_like pl
      JOIN person per ON per.id = pl.person_id
      JOIN instance i ON i.id = per.instance_id
      JOIN post p ON p.id = pl.post_id
      WHERE pl.post_id = $1
        AND p.community_id = $2
      ORDER BY pl.published ASC
      LIMIT 50`,
      [postId, communityId]
    );

    // Vote timeline: group by hour
    const timelineResult = await db.query(
      `SELECT
        date_trunc('hour', pl.published) as hour,
        COUNT(*) FILTER (WHERE pl.score = 1) as upvotes,
        COUNT(*) FILTER (WHERE pl.score = -1) as downvotes
      FROM post_like pl
      JOIN post p ON p.id = pl.post_id
      WHERE pl.post_id = $1
        AND p.community_id = $2
      GROUP BY hour
      ORDER BY hour ASC`,
      [postId, communityId]
    );

    // Post info
    const postResult = await db.query(
      `SELECT
        p.id, p.name as title, p.published, p.ap_id,
        per.name as author_name, per.id as author_id,
        i.domain as author_instance,
        pa.score, pa.upvotes, pa.downvotes, pa.comments
      FROM post p
      JOIN post_aggregates pa ON pa.post_id = p.id
      JOIN person per ON per.id = p.creator_id
      JOIN instance i ON i.id = per.instance_id
      WHERE p.id = $1 AND p.community_id = $2`,
      [postId, communityId]
    );

    if (postResult.rows.length === 0) {
      res.status(404).json({ error: 'Post not found in this community' });
      return;
    }

    const post = postResult.rows[0];

    res.json({
      post: {
        ...post,
        score: parseInt(post.score),
        upvotes: parseInt(post.upvotes),
        downvotes: parseInt(post.downvotes),
        comments: parseInt(post.comments),
      },
      voters: votersResult.rows.map(v => ({
        ...v,
        score: parseInt(v.score),
      })),
      timeline: timelineResult.rows.map(t => ({
        hour: t.hour,
        upvotes: parseInt(t.upvotes),
        downvotes: parseInt(t.downvotes),
      })),
    });
  } catch (error) {
    console.error('Error fetching post voters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/diagnostics/serial-downvoters
// Users with high downvote ratios in this community
router.get('/:id/diagnostics/serial-downvoters', async (req: Request, res: Response) => {
  try {
    const communityId = parseInt(req.params.id, 10);
    const days = parseInt(req.query.days as string, 10) || 90;
    if (isNaN(communityId)) {
      res.status(400).json({ error: 'Invalid community ID' });
      return;
    }

    const result = await db.query(
      `WITH post_votes AS (
        SELECT
          pl.person_id,
          COUNT(*) FILTER (WHERE pl.score = -1) as downvotes,
          COUNT(*) FILTER (WHERE pl.score = 1) as upvotes,
          COUNT(DISTINCT p.creator_id) FILTER (WHERE pl.score = -1) as targets
        FROM post_like pl
        JOIN post p ON pl.post_id = p.id
        WHERE p.community_id = $1
          AND pl.published > NOW() - INTERVAL '${days} days'
        GROUP BY pl.person_id
      ),
      comment_votes AS (
        SELECT
          cl.person_id,
          COUNT(*) FILTER (WHERE cl.score = -1) as downvotes,
          COUNT(*) FILTER (WHERE cl.score = 1) as upvotes,
          COUNT(DISTINCT c.creator_id) FILTER (WHERE cl.score = -1) as targets
        FROM comment_like cl
        JOIN comment c ON cl.comment_id = c.id
        JOIN post p ON c.post_id = p.id
        WHERE p.community_id = $1
          AND cl.published > NOW() - INTERVAL '${days} days'
        GROUP BY cl.person_id
      ),
      combined AS (
        SELECT
          COALESCE(pv.person_id, cv.person_id) as person_id,
          COALESCE(pv.downvotes, 0) + COALESCE(cv.downvotes, 0) as total_downvotes,
          COALESCE(pv.upvotes, 0) + COALESCE(cv.upvotes, 0) as total_upvotes,
          COALESCE(pv.targets, 0) + COALESCE(cv.targets, 0) as unique_targets
        FROM post_votes pv
        FULL OUTER JOIN comment_votes cv ON pv.person_id = cv.person_id
      )
      SELECT
        c.person_id,
        per.name as username,
        i.domain as instance_domain,
        per.published as account_created,
        per.local,
        per.banned,
        c.total_downvotes,
        c.total_upvotes,
        c.unique_targets,
        ROUND(c.total_downvotes::numeric / GREATEST(c.total_downvotes + c.total_upvotes, 1) * 100) as downvote_ratio
      FROM combined c
      JOIN person per ON per.id = c.person_id
      JOIN instance i ON i.id = per.instance_id
      WHERE c.total_downvotes >= 5
      ORDER BY
        ROUND(c.total_downvotes::numeric / GREATEST(c.total_downvotes + c.total_upvotes, 1) * 100) DESC,
        c.total_downvotes DESC
      LIMIT 50`,
      [communityId]
    );

    res.json(result.rows.map(row => ({
      ...row,
      total_downvotes: parseInt(row.total_downvotes),
      total_upvotes: parseInt(row.total_upvotes),
      unique_targets: parseInt(row.unique_targets),
      downvote_ratio: parseInt(row.downvote_ratio),
    })));
  } catch (error) {
    console.error('Error fetching serial downvoters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/diagnostics/user/:userId/downvote-history
// What a specific user downvoted in this community
router.get('/:id/diagnostics/user/:userId/downvote-history', async (req: Request, res: Response) => {
  try {
    const communityId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    const days = parseInt(req.query.days as string, 10) || 90;
    if (isNaN(communityId) || isNaN(userId)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    // Site-wide voting stats for context
    const siteWideResult = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE score = -1) as downvotes,
        COUNT(*) FILTER (WHERE score = 1) as upvotes
      FROM (
        SELECT pl.score FROM post_like pl WHERE pl.person_id = $1
        UNION ALL
        SELECT cl.score FROM comment_like cl WHERE cl.person_id = $1
      ) all_votes`,
      [userId]
    );
    const siteWide = siteWideResult.rows[0];

    // Target distribution: who did they downvote most
    const targetResult = await db.query(
      `WITH downvoted AS (
        SELECT p.creator_id as target_id
        FROM post_like pl
        JOIN post p ON pl.post_id = p.id
        WHERE pl.person_id = $1 AND p.community_id = $2
          AND pl.score = -1
          AND pl.published > NOW() - INTERVAL '${days} days'
        UNION ALL
        SELECT c.creator_id as target_id
        FROM comment_like cl
        JOIN comment c ON cl.comment_id = c.id
        JOIN post p ON c.post_id = p.id
        WHERE cl.person_id = $1 AND p.community_id = $2
          AND cl.score = -1
          AND cl.published > NOW() - INTERVAL '${days} days'
      )
      SELECT
        d.target_id,
        per.name as target_name,
        i.domain as target_instance,
        COUNT(*) as downvote_count
      FROM downvoted d
      JOIN person per ON per.id = d.target_id
      JOIN instance i ON i.id = per.instance_id
      GROUP BY d.target_id, per.name, i.domain
      ORDER BY downvote_count DESC
      LIMIT 10`,
      [userId, communityId]
    );

    // Recent downvoted content
    const recentResult = await db.query(
      `(
        SELECT
          'post' as content_type,
          p.id as content_id,
          p.name as title,
          NULL as content_text,
          per.name as author_name,
          i.domain as author_instance,
          pl.published as vote_time,
          pa.score
        FROM post_like pl
        JOIN post p ON pl.post_id = p.id
        JOIN person per ON per.id = p.creator_id
        JOIN instance i ON i.id = per.instance_id
        JOIN post_aggregates pa ON pa.post_id = p.id
        WHERE pl.person_id = $1 AND p.community_id = $2
          AND pl.score = -1
          AND pl.published > NOW() - INTERVAL '${days} days'
        ORDER BY pl.published DESC
        LIMIT 25
      ) UNION ALL (
        SELECT
          'comment' as content_type,
          c.id as content_id,
          p.name as title,
          LEFT(c.content, 100) as content_text,
          per.name as author_name,
          i.domain as author_instance,
          cl.published as vote_time,
          ca.score
        FROM comment_like cl
        JOIN comment c ON cl.comment_id = c.id
        JOIN post p ON c.post_id = p.id
        JOIN person per ON per.id = c.creator_id
        JOIN instance i ON i.id = per.instance_id
        JOIN comment_aggregates ca ON ca.comment_id = c.id
        WHERE cl.person_id = $1 AND p.community_id = $2
          AND cl.score = -1
          AND cl.published > NOW() - INTERVAL '${days} days'
        ORDER BY cl.published DESC
        LIMIT 25
      )
      ORDER BY vote_time DESC
      LIMIT 30`,
      [userId, communityId]
    );

    res.json({
      siteWide: {
        downvotes: parseInt(siteWide.downvotes) || 0,
        upvotes: parseInt(siteWide.upvotes) || 0,
      },
      targets: targetResult.rows.map(r => ({
        ...r,
        downvote_count: parseInt(r.downvote_count),
      })),
      recentDownvotes: recentResult.rows.map(r => ({
        ...r,
        score: parseInt(r.score),
      })),
    });
  } catch (error) {
    console.error('Error fetching user downvote history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/diagnostics/controversial-posts
// Posts with high min(up, down) — most divisive
router.get('/:id/diagnostics/controversial-posts', async (req: Request, res: Response) => {
  try {
    const communityId = parseInt(req.params.id, 10);
    const days = parseInt(req.query.days as string, 10) || 30;
    if (isNaN(communityId)) {
      res.status(400).json({ error: 'Invalid community ID' });
      return;
    }

    const result = await db.query(
      `SELECT
        p.id as post_id,
        p.name as title,
        p.published,
        p.ap_id,
        per.name as author_name,
        per.id as author_id,
        i.domain as author_instance,
        pa.score,
        pa.upvotes,
        pa.downvotes,
        pa.comments,
        LEAST(pa.upvotes, pa.downvotes) as controversy_score
      FROM post p
      JOIN post_aggregates pa ON pa.post_id = p.id
      JOIN person per ON per.id = p.creator_id
      JOIN instance i ON i.id = per.instance_id
      WHERE p.community_id = $1
        AND p.published > NOW() - INTERVAL '${days} days'
        AND LEAST(pa.upvotes, pa.downvotes) >= 2
      ORDER BY LEAST(pa.upvotes, pa.downvotes) DESC
      LIMIT 50`,
      [communityId]
    );

    res.json(result.rows.map(row => ({
      ...row,
      score: parseInt(row.score),
      upvotes: parseInt(row.upvotes),
      downvotes: parseInt(row.downvotes),
      comments: parseInt(row.comments),
      controversy_score: parseInt(row.controversy_score),
    })));
  } catch (error) {
    console.error('Error fetching controversial posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/diagnostics/health-trends
// Weekly activity, unique authors, vote sentiment
router.get('/:id/diagnostics/health-trends', async (req: Request, res: Response) => {
  try {
    const communityId = parseInt(req.params.id, 10);
    const weeks = parseInt(req.query.weeks as string, 10) || 12;
    if (isNaN(communityId)) {
      res.status(400).json({ error: 'Invalid community ID' });
      return;
    }

    // Activity + unique contributors per week
    const activityResult = await db.query(
      `WITH post_weeks AS (
        SELECT
          date_trunc('week', p.published) as week,
          COUNT(*) as post_count,
          COUNT(DISTINCT p.creator_id) as unique_posters,
          COALESCE(SUM(pa.upvotes), 0) as post_upvotes,
          COALESCE(SUM(pa.downvotes), 0) as post_downvotes
        FROM post p
        JOIN post_aggregates pa ON pa.post_id = p.id
        WHERE p.community_id = $1
          AND p.published > NOW() - INTERVAL '${weeks} weeks'
        GROUP BY week
      ),
      comment_weeks AS (
        SELECT
          date_trunc('week', c.published) as week,
          COUNT(*) as comment_count,
          COUNT(DISTINCT c.creator_id) as unique_commenters,
          COALESCE(SUM(ca.upvotes), 0) as comment_upvotes,
          COALESCE(SUM(ca.downvotes), 0) as comment_downvotes
        FROM comment c
        JOIN comment_aggregates ca ON ca.comment_id = c.id
        JOIN post p ON c.post_id = p.id
        WHERE p.community_id = $1
          AND c.published > NOW() - INTERVAL '${weeks} weeks'
        GROUP BY week
      )
      SELECT
        COALESCE(pw.week, cw.week) as week,
        COALESCE(pw.post_count, 0) as posts,
        COALESCE(cw.comment_count, 0) as comments,
        COALESCE(pw.unique_posters, 0) as unique_posters,
        COALESCE(cw.unique_commenters, 0) as unique_commenters,
        COALESCE(pw.post_upvotes, 0) + COALESCE(cw.comment_upvotes, 0) as upvotes,
        COALESCE(pw.post_downvotes, 0) + COALESCE(cw.comment_downvotes, 0) as downvotes
      FROM post_weeks pw
      FULL OUTER JOIN comment_weeks cw ON pw.week = cw.week
      ORDER BY week ASC`,
      [communityId]
    );

    res.json(activityResult.rows.map(row => ({
      week: row.week,
      posts: parseInt(row.posts),
      comments: parseInt(row.comments),
      uniquePosters: parseInt(row.unique_posters),
      uniqueCommenters: parseInt(row.unique_commenters),
      upvotes: parseInt(row.upvotes),
      downvotes: parseInt(row.downvotes),
    })));
  } catch (error) {
    console.error('Error fetching health trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/diagnostics/top-contributors
// Most active posters/commenters (30d)
router.get('/:id/diagnostics/top-contributors', async (req: Request, res: Response) => {
  try {
    const communityId = parseInt(req.params.id, 10);
    const days = parseInt(req.query.days as string, 10) || 30;
    if (isNaN(communityId)) {
      res.status(400).json({ error: 'Invalid community ID' });
      return;
    }

    const result = await db.query(
      `WITH post_activity AS (
        SELECT p.creator_id, COUNT(*) as post_count
        FROM post p
        WHERE p.community_id = $1
          AND p.published > NOW() - INTERVAL '${days} days'
        GROUP BY p.creator_id
      ),
      comment_activity AS (
        SELECT c.creator_id, COUNT(*) as comment_count
        FROM comment c
        JOIN post p ON c.post_id = p.id
        WHERE p.community_id = $1
          AND c.published > NOW() - INTERVAL '${days} days'
        GROUP BY c.creator_id
      )
      SELECT
        COALESCE(pa.creator_id, ca.creator_id) as person_id,
        per.name as username,
        i.domain as instance_domain,
        per.avatar,
        COALESCE(pa.post_count, 0) as post_count,
        COALESCE(ca.comment_count, 0) as comment_count,
        COALESCE(pa.post_count, 0) + COALESCE(ca.comment_count, 0) as total_activity
      FROM post_activity pa
      FULL OUTER JOIN comment_activity ca ON pa.creator_id = ca.creator_id
      JOIN person per ON per.id = COALESCE(pa.creator_id, ca.creator_id)
      JOIN instance i ON i.id = per.instance_id
      ORDER BY (COALESCE(pa.post_count, 0) + COALESCE(ca.comment_count, 0)) DESC
      LIMIT 20`,
      [communityId]
    );

    res.json(result.rows.map(row => ({
      ...row,
      post_count: parseInt(row.post_count),
      comment_count: parseInt(row.comment_count),
      total_activity: parseInt(row.total_activity),
    })));
  } catch (error) {
    console.error('Error fetching top contributors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
