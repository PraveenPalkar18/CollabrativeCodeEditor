// backend/auth/googleRoutes.js
import express from "express";
import passport from "passport";

const router = express.Router();

// start OAuth
router.get("/google", (req, res, next) => {
  if (!passport._strategy("google")) {
    return res.status(501).json({ ok: false, error: "google_not_configured" });
  }
  // request profile+email
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

// callback
router.get("/google/callback", (req, res, next) => {
  if (!passport._strategy("google")) {
    return res.status(501).send("Google not configured.");
  }
  passport.authenticate("google", (err, user, info) => {
    if (err) {
      console.error("google cb err", err);
      return res.status(500).send("auth error");
    }
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_ORIGIN || "http://localhost:3000"}/login?error=auth`);
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error("login err", err);
        return res.redirect(`${process.env.FRONTEND_ORIGIN || "http://localhost:3000"}/login?error=login`);
      }
      // success → redirect to frontend app (you may want to include some client route)
      return res.redirect(process.env.FRONTEND_ORIGIN || "http://localhost:3000");
    });
  })(req, res, next);
});

export default router;
