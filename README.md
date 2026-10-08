# proval

**Ask before you post.** Your friends send you the photos they want to post that you're in. You swipe through them Tinder-style: right to approve, left to deny. You can add a note like *"last resort"*, *"crop me out"* or *"use the one where I'm smiling"*. The photo only gets the green light once everyone in it says yes.

## What's here

| Part | Where | What it does |
| --- | --- | --- |
| Mobile app | `App.tsx`, `src/` | Expo (React Native + TypeScript) for iOS and Android |
| API | `netlify/functions/` | Netlify Functions: submit photos, get your queue, send reviews |
| Storage | Netlify Blobs | Photos and review data. No separate database needed |

### Screens
- **Review**: "You have 3 photos to review." Swipe the card or tap ✕ / ✓. A sheet then pops up with quick reactions (😍 Obsessed, 😬 Last resort, 🤔 Only if no better one, ✨ Edit me first, ✂️ Crop me out, 🗑️ Delete this forever) and an optional comment. You can undo from there.
- **Ask**: pick a photo, tag who's in it, add a caption, and send for approval.
- **My requests**: every photo you've asked about, with a status (Waiting… / Good to post ✅ / Don't post 🚫) and each friend's answer and note.

The rule is simple: everyone tagged must approve, and a single deny blocks the post.

## Run it

```bash
npm install
npx expo start        # scan the QR code with Expo Go on your phone
```

Out of the box the app runs on **demo data**, so you can try it right away. Tap your name in the top right to switch between the five placeholder friends and see both sides of a review.

### Use the real backend (Netlify)

1. Push this repo to GitHub, then on Netlify choose **Add new project → Import from Git** and pick it. `netlify.toml` already has the settings, and Blobs turns on automatically.
2. Create a `.env.local` file in the project root:
   ```
   EXPO_PUBLIC_API_URL=https://<your-site>.netlify.app
   ```
3. Restart `npx expo start`.

To run the API on your own computer instead, use `npm run api` (Netlify Dev on http://localhost:8888) and point `EXPO_PUBLIC_API_URL` at your computer's local IP, port 8888.

### API

| Method | Path | Body / query |
| --- | --- | --- |
| POST | `/api/photos` | `{ uploaderId, caption, taggedIds[], imageBase64, mimeType }` |
| GET | `/api/photos/:id/image` | Image bytes (Blobs has no public URLs, so images go through here) |
| GET | `/api/queue?user=ava` | Photos waiting on Ava, oldest first |
| GET | `/api/posts?user=ava` | Photos Ava submitted, with every review |
| POST | `/api/reviews` | `{ photoId, reviewerId, decision: "approve" \| "deny", reaction?, comment? }` |

## Checks

```bash
npm run typecheck     # app + functions
npx expo-doctor
```

## Next up

- **Real accounts.** Users are hard-coded placeholders in `src/users.ts`, and the API trusts whatever user id it receives. Before real people use this, add sign-in (e.g. Clerk, Supabase Auth or Firebase Auth) and verify the user on every request.
- **Friends list.** Add and invite friends instead of using the fixed five.
- **Push notifications** when someone asks you, and when everyone has answered.
- **Auto-approve timer**, e.g. "if no answer in 1 hour, it counts as yes" (optional per photo).
- **Pick the best from a set.** Upload several shots and let the group vote.
- **Review by link**, so friends without the app can still approve.
- **Expo Router.** Move the three tabs from `App.tsx` into `src/app/` routes as screens grow.
- **Bigger photos.** Uploads go through a function as base64, capped at about 4 MB, which is fine at the current compression. For full-res photos, upload in chunks or use storage with direct uploads.
