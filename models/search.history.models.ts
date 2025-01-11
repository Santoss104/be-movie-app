import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISearchHistory extends Document {
  userId: mongoose.Types.ObjectId;
  query: string;
  timestamp: Date;
}

const searchHistorySchema = new Schema<ISearchHistory>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    query: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

searchHistorySchema.index({ userId: 1, timestamp: -1 });

const SearchHistoryModel: Model<ISearchHistory> = mongoose.model(
  "SearchHistory",
  searchHistorySchema
);

export default SearchHistoryModel;