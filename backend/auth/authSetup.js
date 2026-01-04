// backend/auth/authSetup.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import express from "express";

/**
 * setupAuth(app, opts)
 * - app: express app instance (must be created in server.js before calling)
 * - opts: { mongoUrl, sessionSecret, frontendOrigin, callbackUrl }
 */
export default function setupAuth(app, opts = {}) {
  if (!app) throw new Error("setupAuth requires express app instance");

  const {
    mongoUrl = process.env.MONGO,
    sessionSecret = process.env.SESSION_SECRET || "change-me",
    frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    callbackUrl = process.env.GOOGLE_CALLBACK || `${frontendOrigin}/auth/google/callback`,
  } = opts;

  // cookie parser (needed before session)
  app.use(cookieParser());

  // session middleware
  const sessionMiddleware = session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: frontendOrigin.includes("localhost") ? "lax" : "none",
      secure: frontendOrigin.startsWith("https"),
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
    store: MongoStore.create({ mongoUrl, ttl: 60 * 60 * 24 * 7 }),
  });

  app.use(sessionMiddleware);

  // passport
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn("[authSetup] GOOGLE_CLIENT_ID/SECRET not set — OAuth disabled.");
  } else {
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: callbackUrl,
        },
        async (accessToken, refreshToken, profile, done) => {
          const user = {
            id: profile.id,
            displayName: profile.displayName || profile.emails?.[0]?.value || "User",
            emails: profile.emails || [],
            provider: profile.provider,
          };
          return done(null, user);
        }
      )
    );
  }

  // build router and mount on /auth (server.js should call setupAuth before using /auth)
  const router = express.Router();
app.get("/auth/me", (req, res) => {
  if (!req.user) return res.json({ ok: false });
  return res.json({ ok: true, user: req.user });
});

  router.get(
    "/google",
    (req, res, next) => {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.status(500).send("Google OAuth not configured on server.");
      }
      next();
    },
    passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" })
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", {
      failureRedirect: `${frontendOrigin}/?auth=fail`,
      session: true,
    }),
    (req, res) => {
      // redirect user back to frontend after successful login
      res.redirect(`${frontendOrigin}?auth=success`);
    }
  );

  router.get("/logout", (req, res) => {
    req.logout?.(() => {});
    req.session?.destroy(() => {});
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });

  router.get("/session", (req, res) => {
    res.json({ user: req.user || null, session: !!req.session });
  });

  // mount router
  app.use("/auth", router);

  // optionally expose the session middleware (if server wants to reuse it)
  app.set("__session_middleware", sessionMiddleware);

  return { sessionMiddleware };
}
