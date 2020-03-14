const config = require('../utils/config');
const Recipe = require('../models/recipe');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const middleware = require('../utils/middleware');
const { client, findredis, setredis } = require('../utils/redis');
const cloudinary = require('cloudinary');
cloudinary.config(config.CLOUDINARY);

const resolvers = {
  User: {
    userrecipes: async (root: any, args: any, context: any) => {
      try {
        const list = root.userrecipes;
        console.log(list, 'rootuserrecipess');
        const recipes = await context.recipeLoader.loadMany(list);
        return recipes;
      } catch (error) {
        console.log(error, 'mitää');
      }
    }
  },
  Recipe: {
    creator: async (root: any, args: any, context: any) => {
      try {
        const user = await context.userLoader.load(root.creator);
        return user;
      } catch (error) {
        console.log(error);
      }
    }
  },

  Query: {
    myRecipes: async (root: any, args: any, context: any) => {
      try {
        if (!context.req.body.userId || !context.req.body.username) {
          return [];
        }
        const found = await findredis(`UserRecipes${context.req.body.userId}`);
        if (found !== null) {
          const foundrecipes = found.map((f: any) => new Recipe({ ...f }));
          console.log('myrecipes haettu cachesta');
          return foundrecipes;
        }
        const user = await context.userLoader.load(context.req.body.userId);
        const recipes = await context.recipeLoader.loadMany(user.userrecipes);
        await setredis(`UserRecipes${context.req.body.userId}`, recipes);
        console.log('myrecipes haettu kannasta');
        return recipes;
      } catch (error) {
        console.log(error);
        return error;
      }
    },
    allRecipes: async (root: any, args: any, context: any) => {
      //await Recipe.deleteMany({})
      try {
        const found = await findredis('allrecipes');
        if (found !== null) {
          const foundrecipes = found.map((f: any) => new Recipe({ ...f }));
          console.log('allrecipes haettu cachesta');
          return foundrecipes;
        }

        const recipes = await Recipe.find({});
        await setredis('allrecipes', recipes);
        console.log('allrecipes haettu kannasta');
        return recipes;
      } catch (error) {
        console.log(error, 'allrecipes');
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
        console.log('etsitää recipeeee');
        const recipe = await context.recipeLoader.load(args.id);
        console.log(recipe, 'haettu recipe kannasta');
        await setredis(`recipe${args.id}`, recipe);

        return recipe;
      } catch (error) {
        console.log(error.message);
      }
    },
    me: async (root: any, args: any, context: any, info: any) => {
      try {
        if (!context.req.body.userId || !context.req.body.username) {
          return undefined;
        }
        const tokenTime = config.tokenTime;
        const user = {
          username: context.req.body.username,
          id: context.req.body.userId,
          tokenTime
        };
        console.log('me tsekattu');
        return user;
      } catch (error) {
        console.log(error, 'meerrorr');
      }
    }
  },
  Mutation: {
    logout: async (root: any, args: any, context: any) => {
      try {
        context.res.clearCookie('access');
        context.res.clearCookie('refresh');
        return true;
      } catch (error) {
        return false;
      }
    },
    createRecipe: async (root: any, args: any, context: any) => {
      try {
        if (!context.req.body.userId) {
          console.log('error createrecipessä');
          return null;
          /* throw new Error("not authenticated") */
        }
        const user = await context.userLoader.load(context.req.body.userId);
        const recipe = new Recipe({
          ...args,
          creator: context.req.body.userId
        });
        const savedRecipe = await recipe.save();
        user.userrecipes.push(recipe);
        await user.save();
        return savedRecipe;
      } catch (error) {
        console.log('error cr');
        return error;
      }
    },

    removeRecipe: async (root: any, args: any, context: any) => {
      try {
        if (!context.req.body.userId) {
          console.log('error removerecipessä');
          return null;
          /* throw new Error("not authenticated") */
        }
        const user = await User.updateOne(
          { _id: context.req.body.userId },
          { $pull: { userrecipes: args.id } }
        );

        const recipe = await Recipe.findOneAndDelete({ _id: args.id });
        cloudinary.v2.uploader.destroy(recipe.imageUrl);

        return recipe;
      } catch (error) {
        console.log(error);
        return error;
      }
    },
    createUser: async (root: any, args: any) => {
      const saltrounds = 10;
      const passwordHash = await bcrypt.hash(args.password, saltrounds);
      const newUser = {
        username: args.username,
        password: passwordHash,
        email: args.email
      };
      const user = new User({ ...newUser });
      await user.save();
      return user;
    },
    login: async (root: any, args: any, context: any, info: any) => {
      try {
        const user = await User.findOne({ email: args.email });
        const passwordCorrect =
          user === null
            ? false
            : await bcrypt.compare(args.password, user.password);
        if (!(user && passwordCorrect)) {
          throw new Error('invalid username or password');
        }
        const tokens = middleware.setTokens(user);
        const cookies = middleware.tokenCookies(tokens);
        context.res.cookie(...cookies.access);
        context.res.cookie(...cookies.refresh);
        return {
          value: tokens.accessToken,
          username: user.username,
          tokenTime: tokens.accesstokenduration
        };
      } catch (error) {
        console.log(error, 'errorrrrr bäk login');
        return error;
      }
    }
  }
};
module.exports = resolvers;
