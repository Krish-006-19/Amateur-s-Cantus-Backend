const mongoose = require("mongoose");
const musicSchema = new mongoose.Schema(
  {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
    title: { type: String, required: true },
    musicImage: { type: String, default: null },
    musicImagePublicId: { type: String, default: null },
    musicImageKey: { type: String, default: null },
    musicAudio: { type: String, required: true },
    musicAudioPublicId: { type: String, default: null },
    musicAudioKey: { type: String, default: null },
    genre: { type: String, required: true },
    description: { type: String, maxlength: 500, required: true },
    isPolicyAccepted: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "removed"],
      default: "approved",
      index: true,
    },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Consumer" }],
    plays: { type: Number, default: 0 },
    reports: { type: Number, default: 0 },
    flaggedForEdit: { type: Boolean, default: false },
    duration: { type: Number, max: 360, default: 0 },
    bytes: { type: Number, max: 6000000, required: true },
    format: { type: String, enum: ["mp3"], default: "mp3" },
  },
  { timestamps: true }
);
musicSchema.index({ uploadedBy: 1 });
musicSchema.index({ uploadedBy: 1, status: 1 });
musicSchema.index({ plays: -1, createdAt: -1 });
musicSchema.index({ likes: -1, createdAt: -1 });
musicSchema.index({ createdAt: -1 });
module.exports = mongoose.model("Music", musicSchema);
