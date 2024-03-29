const config = require('../utils/config');
const Recipe = require('../models/recipe');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const middleware = require('../utils/middleware');
const { client, findredis, setredis, delredis } = require('../utils/redis');
const cloudinary = require('cloudinary');
cloudinary.config(config.CLOUDINARY);

const removerecipeRedisUpdate = async (recipeid: any, userid: any) => {
  //tällähetkellä redisissä 3 erityyppistä avain-arvoparia
  //yksittäiset, myrecipet ja allrecipet. Tee järkevämpi systeemi ku ehit
  await delredis(`recipe${recipeid}`)  //yksittäinen
  //myrecipes päivitys
  const userRecipesRedis = await findredis(`UserRecipes${userid}`);
  if (userRecipesRedis) {
    const newUserRecipes = userRecipesRedis.map((r: any) => new Recipe({ ...r }))
      .filter((r: any) => r.id !== recipeid)
    await setredis(`UserRecipes${userid}`, newUserRecipes);
  }
  //allrecipes päivitys
  const allrecipesRedis = await findredis('allrecipes');
  if (allrecipesRedis) {
    const newAllrecipes = allrecipesRedis.map((r: any) => new Recipe({ ...r }))
      .filter((r: any) => r.id !== recipeid)
    await setredis('allrecipes', newAllrecipes);
  }
}

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
    users: async (root: any, args: any, context: any) => {
      if (!context.req.body.role || context.req.body.role !== 'admin' || !context.req.body.userId) {
        return [];
      }
      const searchregex = new RegExp(args.name, 'i')
      const users = await User.find({ username: { '$in': searchregex } })
      return users
    },
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
        await setredis(`UserRecipes${context.req.body.userId}`, recipes, 3600);
        console.log('myrecipes haettu kannasta');
        return recipes;
      } catch (error) {
        console.log(error);
        return error;
      }
    },
    searchRecipes: async (root: any, args: any, context: any) => {
      const searchArr = args.name.split(' ')
        .slice(0, 3)
        .sort()
        .map((n: string) => new RegExp(n, 'i'))
      console.log('searchinggg tsitsingg', searchArr)

      //näyttäs toimivan alustavasti. tee loppuun niin että toimii title pilkottuna tageiksi

      const recipes = await Recipe.find({
        tags: { '$all': searchArr }
      }).limit(20);
      console.log(recipes, 'jeaahhu')
      return recipes
    },
    allRecipes: async (root: any, args: any, context: any) => {
      /*  await Recipe.deleteMany({})
       await User.deleteMany({}) */
      try {
        const found = await findredis('allrecipes');
        if (found !== null) {
          const foundrecipes = found.map((f: any) => new Recipe({ ...f }));
          console.log('allrecipes haettu cachesta');
          return foundrecipes;
        }

        const recipes = await Recipe.find({}).limit(20);
        await setredis('allrecipes', recipes);
        console.log('allrecipes haettu kannasta');
        return recipes;
      } catch (error) {
        console.log(error, 'allrecipes');
      }
    },
    findRecipe: async (root: any, args: { id: string }, context: any) => {
      try {
        const found = await findredis(`recipe${args.id}`)
        if (found) {
          const foundRecipe = new Recipe({ ...found })
          console.log('recipe cachesta')
          return foundRecipe
        }
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
          tokenTime,
          role: context.req.body.role || 'user'
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
        if (context.req.body.role === 'banned' || !context.req.body.userId) {
          console.log('error createrecipessä');
          return null;
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
        if (context.req.body.role === 'banned' || !context.req.body.userId) {
          console.log('error removerecipessä');
          return null;
        }
        const checkrecipe = await Recipe.findOne({ _id: args.id }).populate('creator')

        if (context.req.body.role === 'admin') {
          const user = await User.updateOne(
            { _id: checkrecipe.creator._id },
            { $pull: { userrecipes: args.id } }
          );
          const recipe = await Recipe.findOneAndDelete({ _id: args.id });
          cloudinary.v2.uploader.destroy(recipe.imageUrl);
          removerecipeRedisUpdate(args.id, checkrecipe.creator._id)
          return recipe;
        } else if (context.req.body.role === 'user') {
          const recipeOwner = checkrecipe.creator.userrecipes.includes(args.id)
          if (recipeOwner) {
            console.log('ownas')
            const user = await User.updateOne(
              { _id: context.req.body.userId },
              { $pull: { userrecipes: args.id } }
            );
            const recipe = await Recipe.findOneAndDelete({ _id: args.id });
            cloudinary.v2.uploader.destroy(recipe.imageUrl);
            removerecipeRedisUpdate(args.id, checkrecipe.creator._id)
            return recipe;
          }
        }
        return null
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
        email: args.email,
        role: 'user'
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
