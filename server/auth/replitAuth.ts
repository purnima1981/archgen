import session from "express-session";
import type { Express, RequestHandler } from "express";
import { authStorage } from "./storage";
import { randomUUID, createHash } from "crypto";
import connectPg from "connect-pg-simple";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: 7 * 24 * 60 * 60,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}

export async function setupAuth(app: Express) {
  app.use(getSession());

  // Set req.user from session
  app.use((req: any, _res: any, next: any) => {
    if (req.session && req.session.userId) {
      req.user = { claims: { sub: req.session.userId } };
    }
    next();
  });

  // Email/Password Registration
  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const existingUser = await authStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      const user = await authStorage.upsertUser({
        id: randomUUID(),
        email,
        passwordHash: hashPassword(password),
        firstName: firstName || null,
        lastName: lastName || null,
        profileImageUrl: null,
      });
      req.session.userId = user.id;
      res.status(201).json(user);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Email/Password Login
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (!verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.session.userId = user.id;
      res.json(user);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Google OAuth
  app.post("/api/auth/google", async (req: any, res) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ message: "Google credential is required" });
      }
      const payload = JSON.parse(
        Buffer.from(credential.split(".")[1], "base64").toString()
      );
      const { sub: googleId, email, given_name, family_name, picture } = payload;
      let user = await authStorage.getUserByGoogleId(googleId);
      if (!user) {
        user = await authStorage.getUserByEmail(email);
        if (user) {
          user = await authStorage.upsertUser({ ...user, googleId, profileImageUrl: picture || user.profileImageUrl });
        } else {
          user = await authStorage.upsertUser({
            id: randomUUID(), email, firstName: given_name || null,
            lastName: family_name || null, profileImageUrl: picture || null, googleId,
          });
        }
      }
      req.session.userId = user.id;
      res.json(user);
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(500).json({ message: "Google authentication failed" });
    }
  });

  app.get("/api/login", (_req, res) => res.redirect("/"));
  app.get("/api/callback", (_req, res) => res.redirect("/"));
  app.get("/api/logout", (req: any, res) => {
    req.session.destroy(() => res.redirect("/"));
  });
  app.post("/api/logout", (req: any, res) => {
    req.session.destroy(() => res.json({ message: "Logged out" }));
  });
}

export const isAuthenticated: RequestHandler = (req: any, res, next) => {
  if (req.user && req.user.claims && req.user.claims.sub) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
