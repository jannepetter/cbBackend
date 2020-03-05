export{}
const {validateTokensMiddleware} = require('./utils/middleware')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet');
const cookieParser = require('cookie-parser')
const {speedLimiter}=require('./utils/security')

const corsConfig =
    process.env.NODE_ENV !== "production"
        ? {
            origin: "http://localhost:3000",
            credentials: true,
        }
        : {
            origin: "https://your-website.com",
            credentials: true
        };


const app = express();
app.use(helmet(
    { dnsPrefetchControl: { allow: true }}  //lataa esim kuvia jo ennen klikkiä, +5% suorituskykyä(helmetillä normisti off)
));
app.use(speedLimiter)                        //näyttäis jotenki toimivan, pitäs saada hienostuneemmin ilmoittaan että liikaa
app.use(express.json())                     //korvaa body-parserin, jota tarvitaan express req kirjoittamiseen (tässävaiheessa)
app.use(cookieParser())
app.use(cors(corsConfig));
app.use(validateTokensMiddleware);

module.exports=app