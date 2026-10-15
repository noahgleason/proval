# proval

**Ask before you post.** When you want to post a photo with friends in it, you send it to them first. They swipe right to approve or left to deny, with a reaction like *Crop me out* or a note. The photo is cleared once everyone says yes. One no blocks it, and anyone who stays quiet for 24 hours counts as a yes.

## Screens

| Screen | What it does |
| --- | --- |
| **Welcome / Sign in** | Google, or an email one-time code. No passwords |
| **Onboarding** | Pick a name and @username |
| **Dashboard** | Every photo you've sent, as a grid or list. Filter by Cleared / Waiting / Blocked. Tap one for each friend's answer, or withdraw it |
| **Review** | The carousel. Swipe or tap. Preview the post as it would look in a feed. Report a photo or block the sender from the ••• menu |
| **Ask** | Pick a photo, tag friends, add a caption, preview, send |
| **Profile** | Friend requests, search, friends, blocked people, privacy policy, terms, sign out, delete account |

## Rules (enforced by the database, not just the app)

- You can only tag accepted friends. Friend requests need a yes from the other person.
- A photo, its tags, and its image are visible only to the sender and the people tagged. Each answer is visible only to the sender and the person who gave it.
- One answer per person, and only inside the 24-hour window (`AUTO_APPROVE_HOURS` in `src/types.ts` and `answer_window()` in SQL).
- Blocking removes the friendship and stops adds, tags, and photos in both directions.
- Deleting your account removes your profile, friendships, photos, images, and answers.

## Run it (demo mode)

```bash
npm install
npx expo start
```

With no Supabase keys, the app runs on built-in demo data. Tap your name, then use the account switcher at the bottom of Profile to see both sides of a request.

`expo-dev-client` is installed, so `expo start` targets a development build by default. Press `s` in the terminal to switch to Expo Go. Push notifications need a development build.

## Project layout

```
src/app/            Routes (Expo Router). (tabs)/ is Dashboard, Review, Ask
src/screens/        The big screens the routes render
src/components/     Icon set, swipe card, sheets, post preview
src/api/            One Api interface → mock.ts (demo) and supabase.ts (real)
src/session.tsx     Sign-in state, profile, sign out, delete account
src/notifications.ts Push registration and tap handling
src/legal.ts        Privacy policy and terms text
supabase/           Database migration and the push notification function
```

## Connect Supabase

1. **Create a project** at supabase.com (the free tier is fine).
2. **Create the database.** Open SQL Editor and run each file in `supabase/migrations/`, oldest first: `20261008000000_init.sql`, then `20261014000000_requests.sql` (story and post requests), then `20261014120000_share_links.sql` (group-chat links for people not on Proval yet), then `20261014180000_badges.sql` (the numbers on the tabs). With the Supabase CLI you can run `npx supabase link` and then `npx supabase db push` instead.
3. **Turn on email codes.** Go to Authentication → Sign In / Providers, make sure Email is enabled, and turn off "Confirm email". Then go to Authentication → Email Templates → **Magic Link** and replace the body with something like:
   ```html
   <h2>Your Proval code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```
   Without `{{ .Token }}` the email only has a link, and the app needs the code. Supabase only lets you edit templates after you set up custom SMTP (step 5), so do that first, or use Google sign-in until then.
4. **Add the keys** to `.env.local` (see `.env.example`), from Project Settings → API:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
   ```
   Restart `npx expo start`.
5. **Send email to real people.** Supabase's built-in email only reaches your own team members and sends 2 emails an hour. For anyone else, add custom SMTP under Authentication → Emails → SMTP Settings. Resend is easiest; it needs a domain you own.

### Sign in with Google

Google sign-in is on the welcome screen (email codes still work too). Providers are listed in `OAUTH_PROVIDERS` in `src/lib/auth.ts`. To add Apple later, enable it in Supabase and add `{ id: 'apple', label: 'Continue with Apple' }` there.

On web, the OAuth redirect goes back to the current origin, so localhost, Netlify deploy previews, and production all work as long as each one is allowed under Supabase → Authentication → URL Configuration. Native builds return to `proval://`, so add that too.

### Web (Netlify)

`netlify.toml` builds with `npx expo export --platform web` into `dist/`, with a `/* → /index.html` fallback. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Netlify's environment variables. Push notifications are native only.

### Push notifications

The `notify` function sends pushes for: new photo requests, answers, everyone approving, friend requests and accepts, a reminder 3 hours before auto-approve, and "cleared by silence".

1. Deploy it, then set a secret it checks:
   ```bash
   npx supabase functions deploy notify --no-verify-jwt
   npx supabase secrets set NOTIFY_SECRET=<a long random string>
   ```
2. In Database → Webhooks, create three webhooks pointing at the function (HTTP POST to `https://<ref>.supabase.co/functions/v1/notify`, with header `x-notify-secret: <NOTIFY_SECRET>`):
   - `photo_tags`: Insert
   - `reviews`: Insert
   - `friendships`: Insert and Update
3. For the hourly reminders, enable the `pg_cron` and `pg_net` extensions, then run:
   ```sql
   select cron.schedule('proval-notify-hourly', '0 * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/notify',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', '<NOTIFY_SECRET>'),
       body := '{"type":"cron"}'::jsonb
     );
   $$);
   ```
4. The app needs an EAS project id to get push tokens: run `npx eas-cli@latest init` once.

### Moderation

Reports land in the `reports` table. Check them in Table Editor, act on them (delete the photo, or delete the user under Authentication → Users), and set `status` to `actioned` or `dismissed`. App Store rules expect you to act on reports within about 24 hours.

## Build and ship (EAS)

```bash
npx eas-cli@latest login
npx eas-cli@latest init                                      # links the project, sets the push project id
npx eas-cli@latest build --profile development --platform ios   # dev build for your phone
npx eas-cli@latest build --profile production --platform ios    # store build
npx eas-cli@latest submit --platform ios                     # to App Store Connect / TestFlight
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as EAS environment variables (`eas env:create`) so cloud builds get them.

### Before submitting to the App Store

- [ ] Apple Developer account ($99/yr). Check that the name "Proval" and the bundle id `com.proval.app` are available
- [ ] Supabase set up as above, with custom SMTP so codes reach real users
- [ ] Replace `CONTACT_EMAIL` in `src/legal.ts` with an inbox you read, and have the privacy policy and terms reviewed
- [ ] Host the privacy policy at a public URL (App Store Connect requires one)
- [ ] A test account for Apple's reviewer (an email whose code you can read, or a reviewer bypass)
- [ ] Screenshots, description, age rating (12+ is typical for user-generated photos), privacy questionnaire
- [ ] A plan for checking reports daily
