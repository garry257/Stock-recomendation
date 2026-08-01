const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        mongoose.set('bufferCommands', false);
        const conn = await mongoose.connect(process.env.MONGO_URL, {
            serverSelectionTimeoutMS: 5000
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error("MongoDB Connection Error:", error.message);
        // Do not exit process to avoid Render crash loops if DB is temporarily down,
        // but typically you would process.exit(1) here.
    }
};

module.exports = connectDB;
