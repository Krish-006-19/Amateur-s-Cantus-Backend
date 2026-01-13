const mongoose = require("mongoose");
const consumerSchema = new mongoose.Schema(
  {
    details: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
    playlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Music" }],
  },
  { timestamps: true }
);
module.exports = mongoose.model("Consumer", consumerSchema);
