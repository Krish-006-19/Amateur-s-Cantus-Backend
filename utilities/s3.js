const { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const region = process.env.AWS_REGION;
const bucket = process.env.S3_BUCKET;

// WHEN_REQUIRED keeps the SDK from signing an empty-body checksum into presigned PUT URLs.
const s3 = new S3Client({ region, requestChecksumCalculation: 'WHEN_REQUIRED' });

function requireStorageConfig() {
  if (!region || !bucket || !process.env.MEDIA_BASE_URL) {
    throw new Error('Set AWS_REGION, S3_BUCKET, and MEDIA_BASE_URL');
  }
}

function extensionFor(mimeType) {
  return ({ 'audio/mpeg': 'mp3', 'image/jpeg': 'jpg', 'image/png': 'png' })[mimeType];
}

// Content-Type and ContentLength are both signed, so S3 rejects an upload whose type or
// size differs from what was requested (e.g. HTML sent as an "image").
async function createUploadUrl({ key, contentType, size }) {
  requireStorageConfig();
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 300, signableHeaders: new Set(['content-type']) }
  );
}

async function headObject(key) {
  requireStorageConfig();
  return s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

async function deleteObject(key) {
  if (!key) return;
  requireStorageConfig();
  return s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// Public URL for a stored object. MEDIA_BASE_URL is the bucket's S3 URL today, or a CloudFront domain later.
function cdnUrl(key) {
  requireStorageConfig();
  return `${process.env.MEDIA_BASE_URL.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

module.exports = { bucket, extensionFor, createUploadUrl, headObject, deleteObject, cdnUrl };
