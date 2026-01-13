const express = require("express");
const router = express.Router();
const {
  getPendingReports,
  getPendingReportById,
  deleteReportFailure,
  getArtistsWithReports,
  deleteArtistById,
  getMusicWithReports,
  deleteMusicById,
  updateReports,
  reportArtist
} = require("../controllers/admin.controller");

const { requireAuth } = require("../clerk");

router.patch("/reports/:id/artist", requireAuth, reportArtist);
router.patch("/reports/:id", requireAuth, updateReports);
router.get("/reports", requireAuth, getPendingReports);
router.get("/reports/:id", requireAuth, getPendingReportById);
router.delete("/reports/:id/failure", requireAuth, deleteReportFailure);
router.get("/artist/reports", requireAuth, getArtistsWithReports);
router.delete("/artist/:id", requireAuth, deleteArtistById);

router.get("/music/reports", requireAuth, getMusicWithReports);
router.delete("/music/:id", requireAuth, deleteMusicById);
module.exports = router;