export {};
const mongoose = require('mongoose')

const schema = new mongoose.Schema({
    username: {
      type: String,
      unique: true,
      required: true,
      minlength: 2
    },
    email:{
      type: String,
      unique: true,
      required: true,
      minlength: 2
    },
    password:{
      type:String,
      required:true,
      minlength:2
    },
    userrecipes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe'
    }]
  })
  /* schema.set({
    transform: (document:any, returnedObject:any) => {
      returnedObject.id = returnedObject._id
      delete returnedObject._id
      delete returnedObject.__v
    }
  })
   */
  module.exports = mongoose.model('User', schema)