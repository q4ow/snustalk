import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import connectPgSimple from 'connect-pg-simple';
import { db } from '../utils/database.js';

const PgSession = connectPgSimple(session);

export function setupAuth(app) {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const requiredAuthVars = [
        'SESSION_SECRET',
        'DISCORD_CLIENT_ID',
        'DISCORD_CLIENT_SECRET',
        'DISCORD_CALLBACK_URL'
    ];

    for (const envVar of requiredAuthVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }

    app.use(session({
        store: new PgSession({
            conObject: {
                user: process.env.DB_USER,
                host: process.env.DB_HOST,
                database: process.env.DB_NAME,
                password: process.env.DB_PASSWORD,
                port: process.env.DB_PORT || 5432,
            },
            tableName: 'session'
        }),
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true
        },
        name: 'sid'
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    passport.use(new DiscordStrategy({
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL,
        scope: ['identify', 'email', 'guilds']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const user = await db.createUser({
                id: profile.id,
                username: profile.username,
                email: profile.email,
                avatar: profile.avatar,
                accessToken,
                refreshToken
            });
            return done(null, user);
        } catch (error) {
            console.error('OAuth error:', error);
            return done(error, null);
        }
    }));

    passport.serializeUser((user, done) => {
        done(null, user.discord_id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await db.getUserById(id);
            done(null, user);
        } catch (error) {
            console.error('Deserialize error:', error);
            done(error, null);
        }
    });

    app.get('/auth/discord', passport.authenticate('discord'));

    app.get('/auth/discord/callback',
        passport.authenticate('discord', {
            failureRedirect: '/login',
            failureFlash: true
        }),
        (req, res) => {
            res.redirect('/dashboard');
        }
    );

    app.get('/auth/logout', (req, res) => {
        req.logout((err) => {
            if (err) {
                console.error('Logout error:', err);
            }
            res.redirect('/');
        });
    });

    app.get('/login', (req, res) => {
        res.send('<a href="/auth/discord">Login with Discord</a>');
    });

    app.get('/dashboard', (req, res) => {
        if (!req.isAuthenticated()) {
            return res.redirect('/login');
        }
        res.send(`Welcome ${req.user.username}!`);
    });

    app.use((err, req, res, next) => {
        console.error('Auth error:', err);
        res.status(500).send('Something broke in the auth system!');
    });
}