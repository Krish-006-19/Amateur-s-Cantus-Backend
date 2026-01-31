require('dotenv').config();
const { v2 } = require('cloudinary');
const fs = require('fs');

v2.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
})

/**
 * Upload a file from local path to Cloudinary.
 * @param {string} filePath - Local file path (e.g. from multer)
 * @param {{ resource_type?: 'auto'|'image'|'video'|'raw' }} options - Optional. Use resource_type: 'video' for audio (streaming), 'image' for images.
 * @returns {{ url: string, public_id: string }} or throws with a clear message.
 */
const uploadOnCloudinary = async (filePath, options = {}) => {
    if (!filePath) {
        throw new Error('No file path provided for upload');
    }

    if (!process.env.CLOUD_NAME || !process.env.API_KEY || !process.env.API_SECRET) {
        try { fs.unlinkSync(filePath); } catch (_) {}
        throw new Error('Cloudinary is not configured. Set CLOUD_NAME, API_KEY, and API_SECRET in .env');
    }

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
    }

    try {
        const result = await v2.uploader.upload(filePath, {
            resource_type: options.resource_type || "auto",
        });
        try { fs.unlinkSync(filePath); } catch (_) {}
        return {
            url: result.secure_url,
            public_id: result.public_id
        };
    } catch (error) {
        // Do not delete file on error so caller can retry (e.g. with different resource_type)
        const message = error?.message || String(error);
        throw new Error(message.includes('Cloudinary') ? message : `Cloudinary upload failed: ${message}`);
    }
}

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    if (!publicId) return null;
    try {
        return await v2.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
        return null;
    }
};

module.exports = { uploadOnCloudinary, deleteFromCloudinary };