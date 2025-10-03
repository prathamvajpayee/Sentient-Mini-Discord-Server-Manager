import mongoose from 'mongoose';

const userStatsSchema = new mongoose.Schema({
  guildId: String,
  userId: String,
  messages: { type: Number, default: 0 },
  warnings: { type: Number, default: 0 },
  roles: [String],
  lastActive: { type: Date, default: Date.now }
});

const UserStats = mongoose.model('UserStats', userStatsSchema);

export default UserStats;
