const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * GET /progress
 * Fetch all progress or filter by ?user_id=...
 */
router.get("/", async (req, res) => {
  // handle optional user_id query
  const { user_id } = req.query;

  try {
    if (user_id) {
      const { rows } = await pool.query(
        "SELECT * FROM user_progress WHERE user_id = $1 ORDER BY created_at DESC",
        [user_id]
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(
      "SELECT * FROM user_progress ORDER BY created_at DESC"
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch progress" });
  }
});

/**
 * POST /progress
 * Insert new progress (upsert)
 */
router.post("/", async (req, res) => {
  const { user_id, language, section, unit, score } = req.body;

  if (!user_id || !language || !section || !unit || score == null) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    await pool.query(
      `
        INSERT INTO user_progress (user_id, language, section, unit, score)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, language, section, unit)
        DO UPDATE SET
          score = EXCLUDED.score,
          created_at = now()
        `,
      [user_id, language, section, unit, score]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upsert progress" });
  }
});

module.exports = router;
