const express = require("express");
const router = express.Router();
const { createReport } = require("../controllers/report.controller");

router.post("/:consumerId/:artistId", createReport);

module.exports = router;