export { }
const { ApolloServer, gql } = require('apollo-server-express');

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
    role:String
    id:ID!
}
type Token {
    value:String! 
    username:String!
    tokenTime:Int
}
    type Recipe {
        title:String
        description:String
        imageUrl:String
        ingredients:[String]!
        instructions:String
        creator:User
        id: ID! 
    }
    type Query{
        myRecipes:[Recipe] @rateLimit(window: "30s", max: 5, message: "Detected unusual behaviour, try again later")
        allRecipes:[Recipe]! 
        searchRecipes(name:String!):[Recipe]!
        findRecipe(id:ID!):Recipe
        users(name:String):[User]!
        me:User 
    }
    type Mutation { 
        logout:Boolean
        createRecipe(
            title: String!
            description:String
            imageUrl:String
            ingredients:[String]!
            tags:[String]!
            instructions:String
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
         ):Token @rateLimit(window: "600s", max: 3, message: "Try again later")
    }
    `
module.exports = typeDefs