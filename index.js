require('dotenv').config();
const express = require("express");
const app = express();
const port = 3000;
const mongoose = require("mongoose");
app.use(require("cookie-parser")());
app.use(require("cors")());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

mongoose
  .connect("mongodb://127.0.0.1:27017/ACantus")
  .then(() => {
    console.log("Mongo connected!");
    startOrphanCleaner();
  })
  .catch((err) => console.error(err));

async function orphanCleaner() {
  try {
    const Artist = mongoose.model("Artist");
    const Music = mongoose.model("Music");
    const Report = mongoose.model("Report");
    const Consumer = mongoose.model("Consumer");

    const artistIds = await Artist.distinct("_id");

    const musicRes = await Music.deleteMany({
      uploadedBy: { $nin: artistIds },
    });

    const reportRes = await Report.deleteMany({
      reportedAgainst: { $nin: artistIds },
    });

    const musicIds = await Music.distinct("_id");

    await Consumer.updateMany(
      {},
      { $pull: { playlist: { $nin: musicIds } } }
    );

    console.log("Orphan cleanup:", {
      musicDeleted: musicRes.deletedCount,
      reportsDeleted: reportRes.deletedCount,
    });
  } catch (err) {
    console.error("Orphan cleaner error:", err);
  }
}

function startOrphanCleaner() {
  orphanCleaner();
  setInterval(orphanCleaner, 1000 * 60 * 10);
}

app.use("/api/consumer", require("./routes/consumer.route.js"));
app.use("/api/artist", require("./routes/artist.route.js"));
app.use("/api/music", require("./routes/music.route.js"));
app.use("/api/auth", require("./routes/auth.route.js"));
app.use("/api/admin", require("./routes/admin.route.js"));
app.use("/api/report", require("./routes/report.route.js"));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});