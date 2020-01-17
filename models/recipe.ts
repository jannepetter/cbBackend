export {};
import mongoose = require('mongoose')

/* export interface IRecipe extends mongoose.Document{
  title:string
  imageUrl:string
  creator:any
  ingredients:string[]
}
 */

const schema = new mongoose.Schema({
    title: {
      type: String,
      required: true,
      minlength: 2
    },
    imageUrl:{
      type:String
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    ingredients: [
      { type: String}
    ]
  })
  /* schema.set({
    transform: (document:any, returnedObject:any) => {
      returnedObject.id = returnedObject._id
      delete returnedObject._id
      delete returnedObject.__v
    }
  }) */
  
  module.exports = mongoose.model('Recipe', schema)