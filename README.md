# proval

**Ask before you post.** Your friends send you the photos they want to post that you're in. You swipe through them Tinder-style: right to approve, left to deny. You can add a note like *"last resort"*, *"crop me out"* or *"use the one where I'm smiling"*. The photo only gets the green light once everyone in it says yes.

## What's here

| Part | Where | What it does |
| --- | --- | --- |
| Mobile app | `App.tsx`, `src/` | Expo (React Native + TypeScript) for iOS and Android |
| API | `netlify/functions/` | Netlify Functions: submit photos, get your queue, send reviews |
| Storage | Netlify Blobs | Photos and review data. No separate database needed |

### Screens
- **Dashboard**: every photo you've asked about, as a grid or a list. Tap the Cleared / Waiting / Blocked counts to filter. Tap a photo to see each friend's answer and note.
- **Review**: the carousel. Swipe right to approve, left to deny, or use the buttons. Tap the eye on a card to preview the post as it would appear in a feed (photo, caption, who's tagged) and decide from there. A sheet then pops up with quick reactions (Obsessed, Last resort, Only if no better one, Edit me first, Crop me out, Delete this forever) and an optional comment. You can undo from there.
- **Ask**: pick a photo, tag the friends who are in it, add a caption, preview the post, and send for approval.
- **Profile** (tap your name): accept or decline friend requests, find people by name or @username, and see your friends.

### The rules
- You can only tag accepted friends. Friend requests need a yes from the other person.
- Everyone tagged must approve, and a single deny blocks the post.
- Requests auto-approve after 24 hours (`AUTO_APPROVE_HOURS` in `src/types.ts`). Anyone who stays silent counts as a yes, and late reviews are rejected.

## Run it

```bash
npm install
npx expo start        # scan the QR code with Expo Go on your phone
```

Out of the box the app runs on **demo data**, so you can try it right away. Tap your name in the top right to switch between the five placeholder friends (Ava, Marcus, Jordan, Priya, Leo) and see both sides of a review.

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
| GET | `/api/queue?user=ava` | Photos waiting on Ava that are still inside the 24h window, oldest first |
| GET | `/api/posts?user=ava` | Photos Ava submitted, with every review |
| GET | `/api/friends?user=ava` | `{ friends, incoming, outgoing }` |
| POST | `/api/friends` | `{ userId, otherId }`: send a request, or accept theirs |
| DELETE | `/api/friends?user=ava&other=leo` | Decline, cancel, or unfriend |
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
