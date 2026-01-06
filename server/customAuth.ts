import { Router, Request, Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { nanoid } from "nanoid";

// In-memory OTP store (use Redis in production)
const otpStore = new Map<string, { otp: string; expiresAt: number; name?: string }>();

export function setupCustomAuth(app: any) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 7 days
  const PgStore = connectPg(session);

  // Session setup
  app.use(
    session({
      store: new PgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        ttl: sessionTtl,
        tableName: "sessions",
      }),
      secret: process.env.SESSION_SECRET || "fooddash-secret-key-change-in-prod",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: sessionTtl,
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Passport serialization
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth Strategy (only if credentials are configured)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: "/api/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const user = await storage.upsertUser({
              id: profile.id,
              email: profile.emails?.[0]?.value,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              profileImageUrl: profile.photos?.[0]?.value,
            });
            done(null, user);
          } catch (error) {
            done(error as Error, undefined);
          }
        }
      )
    );
  }

  const router = Router();

  // Get current user
  router.get("/me", (req: Request, res: Response) => {
    if (req.isAuthenticated() && req.user) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Google OAuth routes
  router.get(
    "/google",
    (req, res, next) => {
      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(501).json({ 
          message: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables." 
        });
      }
      next();
    },
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/sign-in?error=google_failed" }),
    (req: Request, res: Response) => {
      res.redirect("/home");
    }
  );

  // Phone OTP routes
  router.post("/phone/send-otp", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, name, isSignUp } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      // Store OTP
      otpStore.set(phoneNumber, { otp, expiresAt, name });

      // In production, send OTP via SMS (Twilio, etc.)
      // For development, log the OTP
      console.log(`[DEV] OTP for ${phoneNumber}: ${otp}`);

      res.json({ 
        message: "OTP sent successfully",
        // Remove this in production - only for testing
        ...(process.env.NODE_ENV !== "production" && { devOtp: otp })
      });
    } catch (error) {
      console.error("Send OTP error:", error);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  router.post("/phone/verify-otp", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, otp, name, isSignUp } = req.body;

      if (!phoneNumber || !otp) {
        return res.status(400).json({ message: "Phone number and OTP are required" });
      }

      const stored = otpStore.get(phoneNumber);

      if (!stored) {
        return res.status(400).json({ message: "OTP expired or not found. Please request a new one." });
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(phoneNumber);
        return res.status(400).json({ message: "OTP expired. Please request a new one." });
      }

      if (stored.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // OTP verified, clean up
      otpStore.delete(phoneNumber);

      // Create or get user
      const userId = `phone_${phoneNumber.replace(/\D/g, "")}`;
      const userName = name || stored.name || "User";
      
      const user = await storage.upsertUser({
        id: userId,
        firstName: userName.split(" ")[0],
        lastName: userName.split(" ").slice(1).join(" ") || undefined,
        // Store phone in a field (you may need to add phoneNumber to schema)
      });

      // Log the user in
      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Failed to sign in" });
        }
        res.json({ message: "Signed in successfully", user });
      });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  // Logout
  router.post("/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to sign out" });
      }
      req.session.destroy((err) => {
        res.json({ message: "Signed out successfully" });
      });
    });
  });

  return router;
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}

// Middleware to check user role
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const user = req.user as any;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}
