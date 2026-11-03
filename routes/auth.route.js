const express = require("express");
const router = express.Router();
const { requireUser } = require("../middlewares/auth");
const { completeProfileImage } = require('../controllers/profile-upload.controller');
const { credentialChangeOncePerWeek } = require('../middlewares/appLimits');
const {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  register,
  login,
  getMe,
  updateMe,
  deleteMe,
} = require("../controllers/auth.controller.js");

router.post("/register", register);
router.post("/login", login);

router.get("/me", requireUser, getMe);
router.patch("/me", requireUser, credentialChangeOncePerWeek, updateMe);
router.put('/me/profile-image', requireUser, completeProfileImage);
router.delete("/me", requireUser, deleteMe);

router.get("/", getAllUsers);
router.post("/", createUser);
router.patch("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;
