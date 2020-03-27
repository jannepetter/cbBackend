export { };
import mongoose = require('mongoose');

const schema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    minlength: 2
  },
  description: {
    type: String
  },
  imageUrl: {
    type: String
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ingredients: [{ type: String }],
  tags: [{ type: String }],
  instructions: {
    type: String
  }
});

module.exports = mongoose.model('Recipe', schema);
