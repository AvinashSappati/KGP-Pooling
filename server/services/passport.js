const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id || user._id);
});

passport.deserializeUser(async (id, done) => {
  // 1. test user
  if (typeof id === 'string' && id.startsWith('user_')) {
     return done(null, { _id: id, id, name: "Sandbox Tester", email: "test@kgp.ac.in", rollNo: 'ADMIN_TEST', mobile: 'Sandbox', gender: 'male' });
  }
  // 2. finding real Google user in the DB
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch(err) { done(err, null); }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Find or create the user in our Database
      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
        });
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
));