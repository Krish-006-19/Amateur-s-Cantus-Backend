const Auth = require('../models/auth.model');
const { headObject, deleteObject, cdnUrl } = require('../utilities/s3');

const MAX_PROFILE_BYTES = 2 * 1024 * 1024; // 2MB

// Called after the browser has PUT the image to S3 using a "profileImage" presigned URL.
async function completeProfileImage(req, res) {
  const { key } = req.body || {};
  const prefix = `uploads/profileImage/${req.user._id}/`;
  if (typeof key !== 'string' || !key.startsWith(prefix) || key.includes('..')) {
    return res.status(400).json({ message: 'Invalid object key' });
  }

  try {
    let object;
    try {
      object = await headObject(key);
    } catch (_) {
      return res.status(400).json({ message: 'Uploaded image not found. Upload it before completing.' });
    }
    if (!['image/jpeg', 'image/png'].includes(object.ContentType) || !object.ContentLength || object.ContentLength > MAX_PROFILE_BYTES) {
      await deleteObject(key).catch(() => {});
      return res.status(400).json({ message: 'Uploaded image failed type or size validation' });
    }

    const current = await Auth.findById(req.user._id).select('profileImageKey');
    const user = await Auth.findByIdAndUpdate(
      req.user._id,
      { profileImage: cdnUrl(key), profileImageKey: key, profileImagePublicId: key },
      { new: true }
    ).select('-password');

    if (current && current.profileImageKey && current.profileImageKey !== key) {
      await deleteObject(current.profileImageKey).catch(() => {});
    }
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = { completeProfileImage };
