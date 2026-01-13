const musicModel = require("../models/music.model");

async function getApprovedMusicList(req, res) {
    try {
        const musicList = await musicModel.find({ status: "approved" }).sort({ createdAt: -1 });
        if (!musicList || musicList.length === 0)
            return res.status(404).json({ message: "No music found" });
        res.status(200).json(musicList);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function getApprovedMusicById(req, res) {
    try {
        const music = await musicModel.findOne({ _id: req.params.id, status: "approved" });
        if (!music) return res.status(404).json({ message: "Music not found" });
        res.status(200).json(music);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function createMusic(req, res) {
      const {
    title,
    musicImage,
    musicAudio,
    genre,
    description,
    isPolicyAccepted,
    duration,
    bytes,
    format,
  } = req.body;
  if (
    !title ||
    !musicAudio ||
    !genre ||
    !description ||
    isPolicyAccepted === false ||
    duration == null ||
    bytes == null ||
    format !== "mp3"
  ) {
    return res
      .status(400)
      .json({ message: "All required fields must be provided" });
  }
  if (description.length > 500) {
    return res
      .status(400)
      .json({
        message: "Description exceeds maximum length of 500 characters",
      });
  }
  if (duration > 360) {
    return res
      .status(400)
      .json({ message: "Duration exceeds maximum limit of 360 seconds" });
  }
  if (bytes > 6000000) {
    return res
      .status(400)
      .json({ message: "File size exceeds maximum limit of 6,000,000 bytes" });
  }
  try {
    const newMusic = await musicModel.create({
      uploadedBy: req.params.id,
      title,
      musicImage,
      musicAudio,
      genre,
      description,
      isPolicyAccepted,
      duration,
      bytes,
      format: "mp3",
    });
    if (!newMusic)
      return res.status(400).json({ message: "Failed to upload music" });
    res.status(201).json(newMusic);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
}

async function updateMusic(req, res) {
    const {
    title,
    musicImage,
    musicAudio,
    genre,
    description,
    isPolicyAccepted,
    duration,
    bytes,
    format
  } = req.body;
  if (
    !title ||
    !musicAudio ||
    !genre ||
    !description ||
    isPolicyAccepted === false ||
    duration == null ||
    bytes == null ||
    format !== "mp3"
  ) {
    return res
      .status(400)
      .json({ message: "All required fields must be provided" });
  }
  if (description.length > 500) {
    return res
      .status(400)
      .json({
        message: "Description exceeds maximum length of 500 characters",
      });
  }
  if (duration > 360) {
    return res
      .status(400)
      .json({ message: "Duration exceeds maximum limit of 360 seconds" });
  }
  if (bytes > 6000000) {
    return res
      .status(400)
      .json({ message: "File size exceeds maximum limit of 6,000,000 bytes" });
  }
  try {
    const updatedMusic = await musicModel.findOneAndUpdate(
      { _id: req.params.id, status: "approved" },
      {
      title,
      musicImage,
      musicAudio,
      genre,
      description,
      isPolicyAccepted,
      likes,
      plays,
      duration,
      bytes,
      format: "mp3",
      },{ new: true, runValidators: true });
    if (!updatedMusic)
      return res.status(400).json({ message: "Failed to update music" });
    res.status(200).json(updatedMusic);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
}
async function updateLikes(req, res) {
    try {
        const likesUpdate = await musicModel.findOneAndUpdate(
            { _id: req.params.id, status: "approved" },
            { $inc: { likes: 1 } },
            { new: true, runValidators: true }
        );
        res.status(200).json(likesUpdate);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function updatePlays(req, res) {
    try {
        const playsUpdate = await musicModel.findOneAndUpdate(
            { _id: req.params.id, status: "approved" },
            { $inc: { plays: 1 } },
            { new: true, runValidators: true }
        );
        res.status(200).json(playsUpdate);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

module.exports = {
    getApprovedMusicList,
    getApprovedMusicById,
    createMusic,
    updateMusic,
    updateLikes,
    updatePlays
};