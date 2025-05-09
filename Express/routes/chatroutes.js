const express = require("express");
const router = express.Router();
const chatController = require("../controller/chatcontroller");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware.verifyToken, chatController.getAllChats);
router.get("/:chatId", authMiddleware.verifyToken, chatController.getChat);
router.post("/save", authMiddleware.verifyToken, chatController.saveChat);

module.exports = router;