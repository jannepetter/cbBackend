require('dotenv').config();

const tokenTime = 60 * 15;
const refTokentime = 60 * 60;

let MONGOURL = process.env.MONGOURL;
const MONGOCONFIG = {
  useNewUrlParser: true,
  useFindAndModify: false,
  useCreateIndex: true,
  useUnifiedTopology: true
};

let PORT = process.env.PORT;

const CLOUDINARY = {
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
};

const JWTVERISEKRET = process.env.JWTVERISEKRET;

const REDISPORT = process.env.REDISPORT;
const REDISURL = process.env.REDISURL;
const REDISPASSWORD = process.env.REDISPASSWORD;

if (process.env.NODE_ENV === 'test') {
  console.log('env', process.env.NODE_ENV);
  MONGOURL = process.env.TEST_MONGOURL;
}

module.exports = {
  tokenTime,
  refTokentime,
  MONGOURL,
  MONGOCONFIG,
  PORT,
  CLOUDINARY,
  JWTVERISEKRET,
  REDISPORT,
  REDISURL,
  REDISPASSWORD
};
