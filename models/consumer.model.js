const mongoose = require("mongoose");
const consumerSchema = new mongoose.Schema(
  {
    details: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
      unique: true,
    },
    playlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Music" }],
  },
  { timestamps: true }
);
consumerSchema.index({ createdAt: -1 });
module.exports = mongoose.model("Consumer", consumerSchema);
