// Plain-language policies shown in the app (Profile → Account) and linked from
// sign-in. Have someone qualified review these before a public launch.

// TODO before launch: a real inbox you check.
export const CONTACT_EMAIL = 'hello@proval.app';
export const LAST_UPDATED = 'October 8, 2026';

export type LegalDoc = { title: string; sections: { heading: string; body: string }[] };

export const PRIVACY: LegalDoc = {
  title: 'Privacy policy',
  sections: [
    {
      heading: 'The short version',
      body: 'Proval exists so people get a say before photos of them are posted. We collect only what that takes, we never sell your data, and you can delete everything at any time.',
    },
    {
      heading: 'What we collect',
      body: [
        '• Your email address, to sign you in with a one-time code.',
        '• Your name, username, and avatar color.',
        '• Photos you send for approval, their captions, and who you tagged.',
        '• Your answers to photos you’re tagged in, including reactions and notes.',
        '• Friend requests, friendships, people you block, and reports you file.',
        '• A push notification token for your device, if you allow notifications.',
      ].join('\n'),
    },
    {
      heading: 'Who can see what',
      body: 'A photo is visible only to the person who sent it and the friends tagged in it. Your answer to a photo is visible only to you and the sender. Your name and username can be found by other Proval users so they can add you as a friend.',
    },
    {
      heading: 'Who processes it',
      body: 'Data is stored with Supabase (database, file storage, and sign-in). Push notifications are delivered through Expo and Apple or Google. Sign-in codes are sent by our email provider. These services handle data only to run Proval.',
    },
    {
      heading: 'How long we keep it',
      body: 'Photos stay until the sender withdraws them or deletes their account. Everything tied to your account is deleted when you delete it from Profile → Delete account. Reports may be kept for a limited time to deal with abuse.',
    },
    {
      heading: 'Age',
      body: 'Proval is not for children under 13, and we don’t knowingly collect their data.',
    },
    {
      heading: 'Your choices',
      body: `You can withdraw photos, unfriend or block people, turn off notifications in your device settings, and delete your account in the app. For anything else, email ${CONTACT_EMAIL}.`,
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of use',
  sections: [
    {
      heading: 'Using Proval',
      body: 'You need to be at least 13. Keep your sign-in email secure; you’re responsible for what happens on your account.',
    },
    {
      heading: 'Your photos',
      body: 'You own what you send. You give Proval permission to store it and show it to the people you tag, only to run the app. Only send photos you have the right to share.',
    },
    {
      heading: 'What’s not allowed',
      body: 'No nudity or sexual content, harassment, threats, hate, violence, spam, or anything illegal. Don’t send photos of people who haven’t been tagged, and don’t use Proval to pressure anyone.',
    },
    {
      heading: 'Approvals are a courtesy',
      body: 'An approval in Proval means your friends said yes in the app. It isn’t a legal release, and Proval can’t stop anyone from posting a photo elsewhere.',
    },
    {
      heading: 'Reports and removal',
      body: 'Anyone can report a photo or block a person. We review reports and may remove content or accounts that break these rules, usually within 24 hours.',
    },
    {
      heading: 'No warranty',
      body: 'Proval is provided as is. To the extent the law allows, we aren’t liable for indirect losses or for what other people post.',
    },
    {
      heading: 'Changes and contact',
      body: `We’ll update these terms in the app if they change. Questions: ${CONTACT_EMAIL}.`,
    },
  ],
};
