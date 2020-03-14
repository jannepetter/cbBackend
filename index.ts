const config = require('./utils/config');
const DataLoader = require('dataloader');
const app = require('./app');
const resolvers = require('./schema/resolvers');
const typeDefs = require('./schema/typedefs');
const { batchRecipes, batchUsers } = require('./utils/dataloaderBatches');

const { ApolloServer, gql } = require('apollo-server-express');
import { createServer } from 'http';
import lodash = require('lodash');

const {
  ComplexityLimitRule,
  depthLimiter,
  rateLimitDirective
} = require('./utils/security');

const mongoose = require('mongoose');
const Recipe = require('./models/recipe');
const User = require('./models/user');

const MONGODB_URI = config.MONGOURL;
mongoose
  .connect(MONGODB_URI, config.MONGOCONFIG)
  .then(() => {
    console.log('connected to MongoDB');
  })
  .catch((error: any) => {
    console.log('error connection to MongoDB:', error.message);
  });

const server = new ApolloServer({
  schemaDirectives: {
    rateLimit: rateLimitDirective
  },
  typeDefs,
  resolvers,
  validationRules: [depthLimiter, ComplexityLimitRule],

  context: async ({ req, res }: any) => {
    console.log('kontekstissa            ', Date.now() / 1000);
    console.log(req.body.userId, 'kontekst req.userId');
    console.log(req.body.username, '                    kontekst req.username');
    const userLoader = new DataLoader((keys: any[]) => batchUsers(keys, User));
    const recipeLoader = new DataLoader((keys: any[]) =>
      batchRecipes(keys, Recipe)
    );
    return { req, res, userLoader, recipeLoader };
  },
  cors: false
});
server.applyMiddleware({ app, cors: false });
const httpServer = createServer(app);
server.installSubscriptionHandlers(httpServer);
const PORT = config.PORT;
httpServer.listen(PORT, () => {
  console.log(`Server ready at: ${PORT}${server.graphqlPath}`);
});
