const mongoose = require("mongoose");
const authSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      maxlength: 100,
      minlength: 3,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Invalid email address"],
      unique: true,
    },
    profileImage: { type: String, default: null },
    profileImagePublicId: { type: String, default: null },
    password: { type: String, required: true, minlength: 6, maxlength: 100 },
    role: {
      type: String,
      enum: ["consumer", "artist", "admin"],
      default: "consumer",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "deactivated"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);
authSchema.index({ email: 1, status: 1 });
authSchema.index({ username: 1, status: 1 });
module.exports = mongoose.model("Auth", authSchema);
