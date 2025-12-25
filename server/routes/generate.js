const express = require("express");
const router = express.Router();

const auth = require("../middleware/temp_supabase");
const usageLimit = require("../middleware/usageLimit");

// POST /generate
router.post("/", auth, usageLimit, async (req, res) => {
  res.json({
    message: "AI generation allowed",
  });
});

module.exports = router;
