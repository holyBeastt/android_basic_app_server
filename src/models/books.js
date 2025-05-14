import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: "string",
      require: true,
    },
    caption: {
      type: "string",
      required: true,
    },
    image: {
      type: "string",
      required: true,
    },
    rate: {
      type: "number",
      require: true,
      min: 1,
      max: 5,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Book = mongoose.model("Book", bookSchema);

export default Book;
