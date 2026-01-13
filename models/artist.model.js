const mongoose = require("mongoose");
const artistSchema = new mongoose.Schema(
  {
    details: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
    heartsReceived: { type: Number, default: 0 },
    reports: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
  },
  { timestamps: true }
);
artistSchema.index({ details: 1, status: 1 });
artistSchema.index({ reports: 1 });
artistSchema.index({ heartsReceived: -1 });
artistSchema.index({ createdAt: -1 });
module.exports = mongoose.model("Artist", artistSchema);
