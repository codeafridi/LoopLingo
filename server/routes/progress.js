const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// Get user progress
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "select * from user_progress where user_id = $1",
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

// Update progress
router.post("/", auth, async (req, res) => {
  const { language, level, xp } = req.body;

  try {
    await pool.query(
      `
      insert into user_progress (user_id, language, level, xp)
      values ($1, $2, $3, $4)
      on conflict (user_id, language)
      do update set level = $3, xp = $4, updated_at = now()
      `,
      [req.user.id, language, level, xp]
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to update progress" });
  }
});

module.exports = router;
