const { createComplexityLimitRule } = require('graphql-validation-complexity')
const slowDown = require("express-slow-down");      
const depthLimit =require('graphql-depth-limit') 
import { createRateLimitDirective } from 'graphql-rate-limit';

//directly set ratelimits for specific queries in typedefs e.g. login
export const rateLimitDirective = 
createRateLimitDirective({ identifyContext: (ctx) => ctx.id });

//general depthlimit for maxquery depth
export const depthLimiter=depthLimit(3)

//barrier for complex queries wich are still under the allowed depthlimit
export const ComplexityLimitRule = createComplexityLimitRule(1000, {
    scalarCost: 1,
    objectCost: 1, // Default is 0.
    listFactor: 10, // Default is 10.
    onCost: (cost: any) => {
        console.log('query cost:', cost);
    },
    formatErrorMessage: (cost: any) => (
        `query with cost ${cost} exceeds complexity limit`
    ),
})

//general limiter after certain number of requests
export const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 100, // allow 100 requests per 15 minutes, then...
    delayMs: 500 // begin adding 500ms of delay per request above 100:
    // request # 101 is delayed by  500ms
    // request # 102 is delayed by 1000ms
    // request # 103 is delayed by 1500ms
    // etc.
})
