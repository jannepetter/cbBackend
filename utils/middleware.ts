const config = require('./config')
const jwt = require('jsonwebtoken')
import { Express, Request, Response, NextFunction } from 'express';
const User = require('../models/user')


const tokenTime = config.tokenTime
const refTokentime = config.refTokentime

const setTokens = (user: any) => {
    const reftokenduration = refTokentime;
    const accesstokenduration = tokenTime;

    const accessUser = {
        id: user.id,
        username: user.username,
        role: user.role
    };
    const accessToken = jwt.sign(
        accessUser, process.env.JWTVERISEKRET, { expiresIn: accesstokenduration })


    const refreshUser = {
        id: user.id,
        role: user.role
    };

    const refreshToken = jwt.sign(
        refreshUser, process.env.JWTVERISEKRET, { expiresIn: reftokenduration })

    return { accessToken, refreshToken, accesstokenduration };
}

const validateToken = (token: any) => {
    try {
        return jwt.verify(token, process.env.JWTVERISEKRET);
    } catch {
        return null;
    }
}
function tokenCookies({ accessToken, refreshToken }: any) {
    const cookieOptionsAccess = {
        httpOnly: true,
        maxAge: 1000 * tokenTime,               //1000 on millisekuntia
        // secure: true, //for HTTPS only
        /* domain: "http://localhost:3000", */
        sameSite: 'strict'
    };
    const cookieOptionsRefresh = {
        httpOnly: true,
        maxAge: 1000 * refTokentime,
        //secure: true, //for HTTPS only
        // domain: "your-website.com"
        sameSite: 'strict'
    };
    return {
        access: ["access", accessToken, cookieOptionsAccess],
        refresh: ["refresh", refreshToken, cookieOptionsRefresh]
    };
}

const validateTokensMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const refreshToken = req.cookies["refresh"];
    const accessToken = req.cookies["access"];
    console.log('tokenmiddleware step0 - astuttu middlewaree ja haettu tokenit cookiesta')
    if (!accessToken && !refreshToken) {
        console.log('ei tokeneita->next')
        return next();
    }

    const decodedAccessToken = validateToken(accessToken);
    if (decodedAccessToken && decodedAccessToken.id) {
        if (decodedAccessToken.role === 'admin') {
            console.log('user claims to be admin, checking')
            const user = await User.findById(decodedAccessToken.id)
            if (user.role !== 'admin') {
                res.clearCookie("access");
                res.clearCookie("refresh");
                //ehkä vois rakentaa auto bannauksen tai muun hacker leiman tähän
                return next();
            }
        }
        req.body.userId = decodedAccessToken.id;
        req.body.username = decodedAccessToken.username
        req.body.role = decodedAccessToken.role
        console.log('tokenmiddleware step1 - accesstokeni dekoodattu req.userId & name laitettu ->next')

        return next();
    }

    const decodedRefreshToken = validateToken(refreshToken);
    if (decodedRefreshToken === null) {
        res.clearCookie("access");
        res.clearCookie("refresh");
        return next()
    }
    console.log(decodedRefreshToken, 'refreshtokenin tsektsek!')
    if (decodedRefreshToken && decodedRefreshToken.id) {    //tässä vois roolin tsekkaus, tai se countti
        console.log('tokenmiddleware step2 -accestokenia ei oo tai se vanha.. refreshtoken dekoodattu')
        const user = await User.findById(decodedRefreshToken.id)
        if (!user /* || user.data.tokenCount !== decodedRefreshToken.user.count */) {
            // remove cookies if token not valid
            res.clearCookie("access");
            res.clearCookie("refresh");
            console.log('tokenmiddleware step3 - user ei löytynyt(tai bännätty) dekoodatun refreshtokenin perusteela, cookiet poistetaa')
            return next();
        }
        const userTokens = setTokens(user);
        req.params.userId = decodedRefreshToken.id;
        req.params.username = decodedRefreshToken.username
        const cookies = tokenCookies(userTokens);

        res.cookie(cookies.access[0], cookies.access[1], cookies.access[2])
        res.cookie(cookies.refresh[0], cookies.refresh[1], cookies.refresh[2],)

        console.log('tokenmiddleware step4, cookiet päivitetty')
        return next();
    }
    console.log('skipped all')
    next();
}

module.exports = {
    validateTokensMiddleware,
    setTokens,
    tokenCookies
}