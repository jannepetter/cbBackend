require('dotenv').config()
const cloudinary = require('cloudinary')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const DataLoader = require('dataloader')

/* const express = require('express'); */ //ei toimi autoimport ja intellisense näin
import express =require('express')   // näin toimii
import { Express, Request, Response, NextFunction } from 'express';   
const { ApolloServer, gql } = require('apollo-server-express');
import { createServer } from 'http';
import lodash = require('lodash');

const depthLimit =require('graphql-depth-limit')    //voi tarkasti määritellä mitä tyyppiä esim rajotetaan esim loginia
const slowDown = require("express-slow-down");      //yleisesti voidaan hidastaa tietyn rajan jälkeen esim 100 queryn jälkeen
import { createRateLimitDirective } from 'graphql-rate-limit';

const helmet = require('helmet');
const cors = require('cors')
const cookieParser = require('cookie-parser')

const mongoose = require('mongoose') 
const Recipe = require('./models/recipe')
const User = require('./models/user')

const { promisify } = require('util');
const redis = require('redis');
var client = redis.createClient(process.env.REDISPORT, process.env.REDISURL, { no_ready_check: true });
client.auth(process.env.REDISPASSWORD, function (err: any) {
    if (err) {
        throw new Error('rediserror')
    }
});
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client); 

client.on('error', function (err: any) {
    console.log('Error ' + err);
});
client.on('connect', function () {
    console.log('Connected to Redis');
});
client.flushall('ASYNC')        //poistaa kaikki redisistä kun servu käynnistyy (ei pakollinen)

const MONGODB_URI = process.env.MONGOURL
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('connected to MongoDB')
    }).catch((error: any) => {
        console.log('error connection to MongoDB:', error.message)
    })

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

//@cacheControl(maxAge: 240)
const typeDefs = gql`
directive @rateLimit(
    max: Int,
    window: String,
    message: String,
    identityArgs: [String],
    arrayLengthField: String
  ) on FIELD_DEFINITION

type User { 
    username:String!
    userrecipes:[Recipe]!
    tokenTime:Int
    id:ID!
}
type Token {
    value:String! 
    username:String!
    tokenTime:Int
}
    type Recipe {
        title:String
        imageUrl:String
        ingredients:[String]!
        creator:User
        id: ID! 
    }
    type Query{
        myRecipes:[Recipe] @rateLimit(window: "30s", max: 20, message: "Detected unusual behaviour, try again later")
        allRecipes:[Recipe]! 
        findRecipe(id:ID!):Recipe
        me:User 
    }
    type Mutation { 
        logout:Boolean
        createRecipe(
            title: String!
            imageUrl:String
            ingredients:[String]!
          ): Recipe
         removeRecipe(id: String!):Recipe
         createUser(
             username:String!
             password:String!
             email:String!
         ):User
         login(
             email:String! 
             password:String!
         ):Token @rateLimit(window: "60s", max: 2, message: "Trying to hack someone? Ill hack your head off!!")
    }
    `
const tokenTime = 60 * 15
const refTokentime = 60 * 60 

const findredis = async (key: any) => {
    client.unref();
    const found = await getAsync(key);
    console.log('etsii redis')
    if (found) {
        console.log('löyty redis')
        return JSON.parse(found)
    } else {
        console.log('ei löydy redis')
        return null
    }
}
const setredis = async (key: any, value: any) => {
    client.unref();
    await setAsync(key, JSON.stringify(value))
}


const resolvers = {
    User: {
        /* id: async (root: any, context: any) => {
            console.log(root[0]._id,'hiphei id rootista')
            const user = await context.userLoader.load(root[0]._id)
            console.log(user, 'uujee loadilla')

            return user.id
        },
        username: async (root: any) => {
            return root.username
        }, */
        userrecipes: async (root: any,args: any, context: any) => {
            try {
                /* const recipes = await Recipe.find({ _id: { '$in': root[0].userrecipes } })
                console.log('recipethaettu') */
                const list=root.userrecipes
                console.log(list,'rootuserrecipess')
                const recipes=await context.recipeLoader.loadMany(list)
                return recipes
            } catch (error) {
                console.log(error, 'mitää')
            }
        },
    },
    Recipe: {
        /*  id:(root: any)=>{
             return root.id
         },
         title:(root: any)=>{
             console.log('men dont follow titles!!!! they follouwww körrriiiddss!!!')
             return root.title
         }, */
        creator: async (root: any, args: any, context: any) => {
            try {
                const user = await context.userLoader.load(root.creator)
                return user
            } catch (error) {
                console.log(error) 
            }

        }
    },

    Query: {
        myRecipes: async (root: any, args: any, context: any) => {
            try {
                if (!context.req.body.userId || !context.req.body.username) {
                    return []
                }
                const found = await findredis(`UserRecipes${context.req.body.userId}`)
                if (found !== null) {
                    const foundrecipes = found.map((f: any) => new Recipe({ ...f }))
                    console.log('myrecipes haettu cachesta')
                    /* return foundrecipes */
                }
                const user= await context.userLoader.load(context.req.body.userId)
                console.log(user,'user myrespassa tsek')
                /* const user = await User.findOne({ _id: context.req.body.userId }).populate('userrecipes') */
                const recipes= await context.recipeLoader.loadMany(user.userrecipes)
                /* const recipes = user.userrecipes */
                await setredis(`UserRecipes${context.req.body.userId}`, recipes)
                console.log('myrecipes haettu kannasta')
                return recipes
            } catch (error) {
                console.log(error)
               return error 
                
            }
        },
        allRecipes: async (root: any, args: any, context: any) => {
            //await Recipe.deleteMany({})
            try {
                const found = await findredis('allrecipes')
                if (found !== null) {
                    const foundrecipes = found.map((f: any) => new Recipe({ ...f }))
                    console.log('allrecipes haettu cachesta')
                    /* return foundrecipes */
                }

                const recipes = await Recipe.find({});
                await setredis('allrecipes', recipes)
                console.log('allrecipes haettu kannasta')
                return recipes
            } catch (error) {
                console.log(error, 'allrecipes')
            }
        },
        findRecipe: async (root: any, args: { id: string }, context: any) => {
            try {
                /*  const found = await findredis(`recipe${args.id}`)
                 if (found) {
                     const foundRecipe = new Recipe({ ...found })
                     console.log('recipe cachesta')
                     return foundRecipe
                 } */
                console.log('etsitää recipeeee')
                const recipe=await context.recipeLoader.load(args.id )
                /* const recipe = await Recipe.findOne({ _id: args.id }) */
                console.log('haettu recipe kannasta')
                await setredis(`recipe${args.id}`, recipe)

                return recipe
            } catch (error) {
                console.log(error.message);
            }
        },
        me: async (root: any, args: any, context: any,info:any) => {
            try {
                if (!context.req.body.userId || !context.req.body.username) {
                    return undefined
                }
                const user = {
                    username: context.req.body.username,
                    id:context.req.body.userId,
                    tokenTime
                }
                console.log('me tsekattu')
                return user
            } catch (error) {
                console.log(error, 'meerrorr')
            }

        }
    },
    Mutation: {
        logout: async (root: any, args: any, context: any) => {
            try {
                context.res.clearCookie("access");
                context.res.clearCookie("refresh");
                return true
            } catch (error) {
                return false
            }
        },
        createRecipe: async (root: any, args: any, context: any) => {
            try {
                if (!context.req.body.userId) {
                    console.log('error createrecipessä')
                    return null
                    /* throw new Error("not authenticated") */
                }
                const user = await context.userLoader.load(context.req.body.userId)
                const recipe = new Recipe({ ...args, creator: context.req.body.userId})
                const savedRecipe = await recipe.save()
                user.userrecipes.push(recipe)
                await user.save()
                return savedRecipe
            } catch (error) {
                console.log('error cr')
                return error
            }
        },

        removeRecipe: async (root: any, args: any, context: any) => {
            try {
                if (!context.req.body.userId) {
                    console.log('error removerecipessä')
                    return null
                    /* throw new Error("not authenticated") */
                }
                const user = await User.updateOne({ _id: context.req.body.userId },
                    { $pull: { userrecipes: args.id } })

                const recipe = await Recipe.findOneAndDelete({ _id: args.id })
                cloudinary.v2.uploader.destroy(recipe.imageUrl)
                return recipe
            } catch (error) {
                console.log(error);
                return error
            }
        },
        createUser: async (root: any, args: any) => {
            const saltrounds = 10
            const passwordHash = await bcrypt.hash(args.password, saltrounds)
            const newUser = {
                username: args.username,
                password: passwordHash,
                email: args.email
            }
            const user = new User({ ...newUser })
            await user.save()
            return user
        },
        login: async (root: any, args: any, context: any,info:any) => {
            try {
                const user = await User.findOne({ email: args.email })
                const passwordCorrect = user === null ? false :
                    await bcrypt.compare(args.password, user.password)
                if (!(user && passwordCorrect)) {
                    throw new Error('invalid username or password')
                }
                const tokens = setTokens(user)
                const cookies = tokenCookies(tokens)
                context.res.cookie(...cookies.access)
                context.res.cookie(...cookies.refresh)
                return { value: tokens.accessToken, username: user.username, tokenTime: tokens.accesstokenduration }
            } catch (error) {
                console.log(error, 'errorrrrr bäk login')
                return error
            }
        }
    }
}

const batchUsers = async (keys: any[], User: any) => {
    /* console.log('userbätsi', keys) */
    const users = await User.find({ _id: { '$in': keys } })
    const userMap: { [key: string]:any} = {};
    users.forEach((u:any) => {
      userMap[u.id] = u;
    });
    return keys.map(k => userMap[k]);
}
const batchRecipes = async (keys: string[], Recipe: any) => {
   /*  console.log('recipebätsi', keys) */
    const recipes = await Recipe.find({ _id: { '$in': keys } })
    const recipeMap: { [key: string]:any} = {};
    recipes.forEach((r:any) => {
      recipeMap[r.id] = r;
    });
    return keys.map(k =>recipeMap[k]);
}
const rateLimitDirective = createRateLimitDirective({ identifyContext: (ctx) => ctx.id });
//rateLimitDirective kykettynä schemadirectiveen voit määrittää schemassa yksittäisille kyselyille rajat

const server = new ApolloServer({
    schemaDirectives: {
        rateLimit: rateLimitDirective,
      },
    typeDefs,
    resolvers,
    validationRules: [depthLimit(30) ],  //depthlimit miten syviä graphql kyselyita saa tehdä
    /* cacheControl: {
        defaultMaxAge: 5,
    }, */

    context: async ({ req, res }: any) => { 
        console.log('kontekstissa            ', Date.now() / 1000)
        console.log(req.body.userId, 'kontekst req.userId')
        console.log(req.body.username, '                    kontekst req.username')
        const userLoader = new DataLoader((keys: any[]) => batchUsers(keys, User))
        const recipeLoader = new DataLoader((keys: any[]) => batchRecipes(keys, Recipe)) 
        return { req, res, userLoader,recipeLoader }
    },
    cors: false
})
//config importattuu cors 
const corsConfig =
    process.env.NODE_ENV !== "production"
        ? {
            origin: "http://localhost:3000",
            credentials: true,
            /* additionalHeaders: ['Cache-Control'] */
        }
        : {
            origin: "https://your-website.com",
            credentials: true
        };

const setTokens = (user: any) => {
    const reftokenduration = refTokentime;
    const accesstokenduration = tokenTime;

    const accessUser = {
        id: user.id,
        username: user.username
    };
    const accessToken = jwt.sign(
        accessUser, process.env.JWTVERISEKRET, { expiresIn: accesstokenduration })


    const refreshUser = {
        id: user.id,
        /*  count: user.tokenCount */
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
        req.body.userId = decodedAccessToken.id;
        req.body.username = decodedAccessToken.username
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
        
        res.cookie(cookies.access[0],cookies.access[1],cookies.access[2])       
        res.cookie(cookies.refresh[0],cookies.refresh[1],cookies.refresh[2],)

        console.log('tokenmiddleware step4, cookiet päivitetty') 
        return next();
    }
    console.log('skipped all')
    next();
}
    //nyt käytössä speedlimit, depthlimit ja ratelimit (ei vielä optimoituna)
  const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 100, // allow 100 requests per 15 minutes, then...
    delayMs: 500 // begin adding 500ms of delay per request above 100:
    // request # 101 is delayed by  500ms
    // request # 102 is delayed by 1000ms
    // request # 103 is delayed by 1500ms
    // etc.
  })  

//tämä setup mahdollistaa subscriptionit ja cookiet
//apollo-server-express ja express piti asentaa
const app = express();
app.use(helmet(
    { dnsPrefetchControl: { allow: true }}  //lataa esim kuvia jo ennen klikkiä, +5% suorituskykyä(helmetillä normisti off)
));
app.use(speedLimiter)                        //näyttäis jotenki toimivan, pitäs saada hienostuneemmin ilmoittaan että liikaa
app.use(express.json())                     //korvaa body-parserin, jota tarvitaan express req kirjoittamiseen (tässävaiheessa)
app.use(cookieParser())
app.use(cors(corsConfig));
app.use(validateTokensMiddleware);
server.applyMiddleware({ app, cors: false });
const httpServer = createServer(app);
server.installSubscriptionHandlers(httpServer);
httpServer.listen(4000, () => {
    console.log("Server started on http://localhost:4000/graphql");
})


//jos et tartte subscriptioneita
//apollo-server-express ja express piti asentaa
/* const app = express();
server.applyMiddleware({ app });

app.listen({ port: 4000 }, () =>
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
); */


//apolloserver ilman expressiä                                         
/* server.listen({port:4000}).then(({ url }: any) => {
    console.log(`Server ready at ${url}`);
})
 */