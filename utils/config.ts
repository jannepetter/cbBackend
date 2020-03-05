require('dotenv').config()

const tokenTime = 60 * 15
const refTokentime = 60 * 60 

let MONGOURL=process.env.MONGOURL
let PORT=process.env.PORT

const CLOUD_NAME=process.env.CLOUD_NAME
const CLOUD_API_KEY=process.env.CLOUD_API_KEY
const CLOUD_API_SECRET=process.env.CLOUD_API_SECRET

const JWTVERISEKRET=process.env.JWTVERISEKRET

const REDISPORT=process.env.REDISPORT
const REDISURL=process.env.REDISURL
const REDISPASSWORD=process.env.REDISPASSWORD


if(process.env.NODE_ENV==='test'){
    console.log('env',process.env.NODE_ENV)
  MONGOURL=process.env.TEST_MONGOURL
  }


module.exports={
    tokenTime,
    refTokentime,
    MONGOURL,
    PORT,
    CLOUD_NAME,
    CLOUD_API_KEY,
    CLOUD_API_SECRET,
    JWTVERISEKRET,
    REDISPORT,
    REDISURL,
    REDISPASSWORD
}