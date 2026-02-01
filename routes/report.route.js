const express = require("express");
const router = express.Router();
const { requireUser } = require("../middlewares/auth");
const { limitReportsPerDay } = require('../middlewares/appLimits');
const { createReport, getMyReports } = require("../controllers/report.controller");

router.get("/my", requireUser, getMyReports);

// Report a specific song (requires auth)
router.post("/:consumerId/:musicId", requireUser, limitReportsPerDay, createReport);

// Backward compat (treat :artistId as :musicId if old client)
router.post("/:consumerId/:artistId", requireUser, (req, res, next) => {
	req.params.musicId = req.params.artistId;
	return limitReportsPerDay(req, res, () => createReport(req, res, next));
});

module.exports = router;