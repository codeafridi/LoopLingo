const express = require("express");
const router = express.Router();
const pool = require("../db");
// #region agent log
fetch("http://127.0.0.1:7242/ingest/3d931270-8e7c-45cc-9d3c-4ba99a28c742", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    location: "server/routes/progress.js:4",
    message: "Attempting to require supabaseAuth in progress.js",
    data: { path: "../middleware/supabaseAuth" },
    timestamp: Date.now(),
    sessionId: "debug-session",
    runId: "run1",
    hypothesisId: "2",
  }),
}).catch(() => {});
// #endregion
const auth = require("../middleware/supabaseauth");

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
