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


router.patch("/reports/:id/artist", reportArtist);
router.patch("/reports/:id", updateReports);
router.get("/reports", getPendingReports);
router.get("/reports/:id", getPendingReportById);
router.delete("/reports/:id/failure", deleteReportFailure);
router.get("/artist/reports", getArtistsWithReports);
router.delete("/artist/:id", deleteArtistById);

router.get("/music/reports", getMusicWithReports);
router.delete("/music/:id", deleteMusicById);
module.exports = router;