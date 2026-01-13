const mongoose = require("mongoose");
const adminSchema = new mongoose.Schema(
  {
    authDetails: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Admin", adminSchema);
