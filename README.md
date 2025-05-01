# RAG_Chatbot

In this project:
1) A full-stack chatbot powered by Groq + Langchain for RAG (Retrieval Augmented Generation).
2) Upload PDFs and ask questions from the content.
3) Authentication handled via a separate Node.js + MongoDB server.

---

## 🎥 Working Demo:
1)Landing Page and Auth Page:
![Image](https://github.com/user-attachments/assets/76d37ab9-50e6-41d7-9fe2-8d5a15c9bc4e)

---
2)Working:
![Image](https://github.com/user-attachments/assets/02d888f5-b0f0-488b-ba01-11542a026da5)


## 🚀 Guide to Start the Project:

### 1. Navigate to the frontend folder:
cd frontend
npm ci
npm run dev

---

### 2.Navigate to Backend Folder:
Run this command:
pip install flask python-dotenv PyPDF2 langchain faiss-cpu sentence-transformers langchain-groq werkzeug

Create .env file:
GROQ_API_KEY=your_key_here

Run this command:
python app.py

---

### 3.Navigate to Terror Folder:
Run this command:
npm ci

Create .env file:
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=3000

Run this command:
npm start

### You are ready to GO !
