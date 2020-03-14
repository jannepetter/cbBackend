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
        myRecipes:[Recipe] @rateLimit(window: "30s", max: 5, message: "Detected unusual behaviour, try again later")
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
         ):Token @rateLimit(window: "600s", max: 3, message: "Try again later")
    }
    `
module.exports = typeDefs