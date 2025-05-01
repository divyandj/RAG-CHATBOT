const User = require("../models/User");
const { v4: uuidv4 } = require("uuid");

// Get All Chats Controller
exports.getAllChats = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("chats");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Chats retrieved successfully",
      chats: user.chats.map(chat => ({
        chatId: chat.chatId,
        chatName: chat.chatName,
        createdAt: chat.createdAt
      }))
    });
  } catch (error) {
    console.error("Get chats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Single Chat Controller
exports.getChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const chat = user.chats.find(c => c.chatId === chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.status(200).json({
      message: "Chat retrieved successfully",
      chat: {
        chatId: chat.chatId,
        chatName: chat.chatName,
        history: chat.history,
        createdAt: chat.createdAt
      }
    });
  } catch (error) {
    console.error("Get chat error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Save Chat Controller
exports.saveChat = async (req, res) => {
  try {
    const { userId, chatId, chatName, history } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.chats.push({
      chatId,
      chatName,
      history,
      createdAt: new Date()
    });

    await user.save();

    res.status(200).json({ message: "Chat saved successfully" });
  } catch (error) {
    console.error("Save chat error:", error);
    res.status(500).json({ message: "Server error" });
  }
};