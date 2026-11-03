// One-off: copy existing Cloudinary-hosted songs, covers and profile pictures into S3
// and rewrite the stored URLs. Safe to re-run: records that already have an S3 key are skipped.
// Usage: node scripts/migrate-cloudinary.js
require('dotenv').config();
const mongoose = require('mongoose');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Music = require('../models/music.model');
const Auth = require('../models/auth.model');
const { cdnUrl } = require('../utilities/s3');

const s3 = new S3Client({ region: process.env.AWS_REGION, requestChecksumCalculation: 'WHEN_REQUIRED' });
const isCloudinary = (u) => typeof u === 'string' && /cloudinary\.com/.test(u);

function imageType(url, headerType) {
  if (/^image\/(jpeg|png)$/.test(headerType || '')) return headerType;
  return /\.png(\?|$)/i.test(url) ? 'image/png' : 'image/jpeg';
}

async function copy(url, key, contentType) {
  const res = await fetch(url.replace(/^http:/, 'https:'));
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  const body = Buffer.from(await res.arrayBuffer());
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType || imageType(url, res.headers.get('content-type')),
  }));
  return key;
}

const extFor = (type) => (type === 'image/png' ? 'png' : 'jpg');

async function migrateImage(url, prefix, id) {
  const probe = await fetch(url.replace(/^http:/, 'https:'), { method: 'HEAD' }).catch(() => null);
  const type = imageType(url, probe && probe.headers.get('content-type'));
  return copy(url, `${prefix}/migrated/${id}.${extFor(type)}`, type);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  let ok = 0;
  let failed = 0;

  for (const m of await Music.find({ musicAudioKey: null, musicAudio: /cloudinary\.com/ })) {
    try {
      m.musicAudioKey = await copy(m.musicAudio, `uploads/audio/migrated/${m._id}.mp3`, 'audio/mpeg');
      m.musicAudioPublicId = m.musicAudioKey;
      m.musicAudio = cdnUrl(m.musicAudioKey);
      if (!m.musicImageKey && isCloudinary(m.musicImage)) {
        m.musicImageKey = await migrateImage(m.musicImage, 'uploads/image', m._id);
        m.musicImagePublicId = m.musicImageKey;
        m.musicImage = cdnUrl(m.musicImageKey);
      }
      await m.save();
      ok += 1;
      console.log('song migrated', String(m._id));
    } catch (err) {
      failed += 1;
      console.error('song FAILED', String(m._id), err.message);
    }
  }

  for (const u of await Auth.find({ profileImageKey: null, profileImage: /cloudinary\.com/ })) {
    try {
      u.profileImageKey = await migrateImage(u.profileImage, 'uploads/profileImage', u._id);
      u.profileImagePublicId = u.profileImageKey;
      u.profileImage = cdnUrl(u.profileImageKey);
      await u.save({ validateBeforeSave: false });
      ok += 1;
      console.log('profile migrated', String(u._id));
    } catch (err) {
      failed += 1;
      console.error('profile FAILED', String(u._id), err.message);
    }
  }

  console.log(`Done. migrated=${ok} failed=${failed}`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})();
