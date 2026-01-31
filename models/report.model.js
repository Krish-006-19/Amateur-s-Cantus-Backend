const mongoose = require("mongoose");
const reportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Consumer",
      required: true,
    },
    music: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Music",
      required: true,
    },
    reportedAgainst: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
    reason: { type: String, maxlength: 500, required: true },
    proof: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed", "approved"],
      default: "pending",
    },
  },
  { timestamps: true }
);
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedAgainst: 1, status: 1 });
reportSchema.index({ music: 1, status: 1 });
reportSchema.index({ reportedBy: 1, music: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
module.exports = mongoose.model("Report", reportSchema);
