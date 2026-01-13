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
    musicAudio: { type: String, required: true },
    genre: { type: String, required: true },
    description: { type: String, maxlength: 500, required: true },
    isPolicyAccepted: { type: Boolean, required: true, default: false },
    likes: { type: Number, default: 0 },
    plays: { type: Number, default: 0 },
    reports: { type: Number, default: 0 },
    duration: { type: Number, max: 360, required: true },
    bytes: { type: Number, max: 6000000, required: true },
    format: { type: String, enum: ["mp3"], required: true },
  },
  { timestamps: true }
);
musicSchema.index({ uploadedBy: 1 });
musicSchema.index({ status: 1 });
musicSchema.index({ uploadedBy: 1, status: 1 });
musicSchema.index({ createdAt: -1 });
module.exports = mongoose.model("Music", musicSchema);