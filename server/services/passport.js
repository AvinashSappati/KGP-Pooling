const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id || user._id);
});

passport.deserializeUser(async (id, done) => {
  if (typeof id === 'string' && id.startsWith('user_')) {
     return done(null, { _id: id, id, name: id.replace('user_', ''), email: `${id.replace('user_', '')}@kgp.ac.in`, rollNo: 'ADMIN_TEST', mobile: 'Sandbox', gender: 'male' });
  }
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch(err) { done(err, null); }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `https://kgp-pooling.onrender.com/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      
      const DEV_WHITELIST = ['sappatiavinash@gmail.com']; 
      
      const isKgpian = email.endsWith('@kgpian.iitkgp.ac.in');
      const isDev = DEV_WHITELIST.includes(email);

      // Block them if they are neither a student nor you
      if (!isKgpian && !isDev) {
        return done(null, false, { message: 'Invalid Domain' });
      }
      
      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: email,
        });
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
));