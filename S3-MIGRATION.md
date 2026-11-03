# Cloudinary -> S3

## 1. Bucket (S3 console, same region as AWS_REGION)
- Untick "Block public access ... new public bucket policies" and "... any public bucket policies" (leave the two ACL options ticked).
- Bucket policy (replace BUCKET):

```json
{"Version":"2012-10-17","Statement":[{"Sid":"PublicReadMedia","Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":["arn:aws:s3:::BUCKET/uploads/audio/*","arn:aws:s3:::BUCKET/uploads/image/*","arn:aws:s3:::BUCKET/uploads/profileImage/*"]}]}
```

- CORS (replace the origins):

```json
[{"AllowedOrigins":["https://YOUR-FRONTEND","http://localhost:5173"],"AllowedMethods":["PUT","GET","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag","Content-Range","Accept-Ranges"],"MaxAgeSeconds":3600}]
```

## 2. Permissions for the backend
EC2 / Lambda role (or your local AWS profile) needs `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::BUCKET/uploads/*`.

## 3. Environment
Remove `CLOUDINARY_*`. Set `AWS_REGION`, `S3_BUCKET`, `MEDIA_BASE_URL` (see `.env.example`).

## 4. New upload flow (frontend)
Multipart `POST /api/music` and multipart profile-image fields are gone. For each file:

1. `POST /upload/presign` with JSON `{ kind: "audio" | "image" | "profileImage", contentType, size }` and the auth token.
   `audio` and `image` need an artist account. Use the returned `contentType` unchanged.
2. `PUT` the raw file to the returned `uploadUrl` with header `Content-Type` = returned contentType.
   The body must be exactly `size` bytes (use `file.size`). Content-Type and length are signed, so S3 answers 403 if either differs.
3. Songs: `POST /upload/music/complete` with `{ audioKey, imageKey?, title, genre, description, isPolicyAccepted: true }`.
   `isPolicyAccepted` must now be sent explicitly.
   Profile picture: `PUT /api/auth/me/profile-image` with `{ key }`.

Register no longer accepts a profile image; set it after login with the profile-image flow.

## 5. Existing Cloudinary data
Old records keep working (their stored URLs still point at Cloudinary). To move them, with the env vars set:

```
node scripts/migrate-cloudinary.js
```

Keep the Cloudinary account until songs and pictures play from S3, then delete the old assets.
Deleting a song or account now removes S3 objects only; it no longer touches Cloudinary.
