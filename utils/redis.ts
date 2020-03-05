export{}
const config =require('./config')
const { promisify } = require('util');
const redis = require('redis');


export const client = redis.createClient(config.REDISPORT, config.REDISURL, { no_ready_check: true });
client.auth(config.REDISPASSWORD, function (err: any) {
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
    client.flushall('ASYNC')        //poistaa kaikki redisistä kun servu käynnistyy (ei pakollinen)
});

export const findredis = async (key: any) => {
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
export const setredis = async (key: any, value: any) => {
    client.unref();
    await setAsync(key, JSON.stringify(value))
}