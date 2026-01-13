const express = require("express");
const router = express.Router();
const { createReport } = require("../controllers/report.controller");
const { requireAuth } = require("../clerk");

router.post("/:consumerId/:artistId", requireAuth, createReport);

module.exports = router;