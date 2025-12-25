const pool = require("../db");

module.exports = async function usageLimit(req, res, next) {
  const userId = req.user.id;
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM

  const limit = 300; // monthly quota

  const { rows } = await pool.query(
    `
    INSERT INTO user_usage (user_id, month, monthly_count)
    VALUES ($1, $2, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET
      monthly_count = user_usage.monthly_count + 1,
      updated_at = now()
    RETURNING monthly_count
    `,
    [userId, month]
  );

  if (rows[0].monthly_count > limit) {
    return res.status(429).json({
      error: "Monthly usage limit exceeded",
    });
  }

  next();
};
