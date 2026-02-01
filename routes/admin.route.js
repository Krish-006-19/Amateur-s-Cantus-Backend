const express = require("express");
const router = express.Router();
const { requireAdmin } = require('../middlewares/auth');
const {
  getPendingReports,
  getAllReports,
  getPendingReportById,
  dismissReport,
  takeActionOnReport,
  getArtistsWithReports,
  deactivateArtistById,
  getMusicWithReports,
  removeMusicById,
  hardDeleteMusic,
  getAllUsersForAdmin,
} = require("../controllers/admin.controller");

// Users (admin-only)
router.get('/users', requireAdmin, getAllUsersForAdmin);

router.get("/reports", requireAdmin, getAllReports);
router.get("/reports/:id", requireAdmin, getPendingReportById);
router.patch("/reports/:id/dismiss", requireAdmin, dismissReport);
router.patch("/reports/:id/action", requireAdmin, takeActionOnReport);

router.get("/artists/reported", requireAdmin, getArtistsWithReports);
router.patch("/artists/:id/deactivate", requireAdmin, deactivateArtistById);

router.get("/music/reported", requireAdmin, getMusicWithReports);
router.patch("/music/:id/remove", requireAdmin, removeMusicById);
router.delete("/music/:id", requireAdmin, hardDeleteMusic);

// Backward compat aliases
router.get("/artist/reports", requireAdmin, getArtistsWithReports);
router.get("/music/reports", requireAdmin, getMusicWithReports);

module.exports = router;