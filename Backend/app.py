import os
import logging
import shutil
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import pdfplumber
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain
from langchain_groq import ChatGroq

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

# Configuration
UPLOAD_FOLDER = 'uploads'
VECTORSTORE_PATH = 'vectorstore'
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VECTORSTORE_PATH, exist_ok=True)

# Global variables
conversation = None
chat_history = []

# Check allowed file extensions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Extract text from PDFs using pdfplumber
def get_pdf_text(pdf_paths):
    text = ""
    for pdf_path in pdf_paths:
        logging.info(f"Extracting text from {pdf_path}")
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text() or ""
                    text += page_text + "\n"
                    logging.info(f"Extracted {len(page_text)} characters from page {page_num} of {pdf_path}")
            logging.info(f"Successfully extracted {len(text)} characters from {pdf_path}")
        except Exception as e:
            logging.error(f"Error extracting text from {pdf_path}: {e}")
            raise
    if not text.strip():
        logging.warning("No text extracted from any PDFs. If PDFs are scanned, consider using an OCR tool like Tesseract.")
        raise ValueError("No text extracted from PDFs")
    return text

# Split text into chunks
def get_text_chunks(text):
    logging.info("Splitting text into chunks")
    try:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=100,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        chunks = text_splitter.split_text(text)
        logging.info(f"Created {len(chunks)} chunks")
        for i, chunk in enumerate(chunks[:5]):  # Log first 5 chunks for debugging
            logging.debug(f"Chunk {i+1}: {chunk[:200]}...")
        return chunks
    except Exception as e:
        logging.error(f"Error splitting text: {e}")
        raise

# Create or load FAISS vectorstore
def get_vectorstore(text_chunks):
    logging.info("Creating/loading FAISS vectorstore")
    try:
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'}
        )
        vectorstore_path = os.path.join(VECTORSTORE_PATH, "faiss_index")
        
        if os.path.exists(vectorstore_path):
            logging.info("Loading existing FAISS vectorstore")
            vectorstore = FAISS.load_local(vectorstore_path, embeddings, allow_dangerous_deserialization=True)
            # Clear existing vectors to avoid duplicate context
            vectorstore.delete([doc.metadata['id'] for doc in vectorstore.docstore._dict.values()])
            logging.info("Cleared existing vectors from vectorstore")
            # Add new texts
            vectorstore.add_texts(text_chunks)
            logging.info(f"Added {len(text_chunks)} new chunks to existing vectorstore")
        else:
            logging.info("Creating new FAISS vectorstore")
            vectorstore = FAISS.from_texts(texts=text_chunks, embedding=embeddings)
        
        # Save vectorstore to disk
        vectorstore.save_local(vectorstore_path)
        logging.info("Vectorstore saved to disk")
        return vectorstore
    except Exception as e:
        logging.error(f"Error creating vectorstore: {e}")
        raise

# Set up conversational retrieval chain
def get_conversation_chain(vectorstore):
    logging.info("Setting up conversation chain")
    try:
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY not found")
        llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.5, api_key=groq_api_key)
        memory = ConversationBufferMemory(memory_key='chat_history', return_messages=True)
        
        conversation_chain = ConversationalRetrievalChain.from_llm(
            llm=llm,
            retriever=vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 8}),  # Increased k for more context
            memory=memory
        )
        logging.info("Conversation chain created successfully")
        return conversation_chain
    except Exception as e:
        logging.error(f"Error creating conversation chain: {e}")
        return None

# Endpoint to upload and process PDFs
@app.route('/api/upload', methods=['POST'])
def upload_pdfs():
    global conversation, chat_history
    logging.info("Received upload request")
    chat_history = []
    
    if 'files' not in request.files:
        logging.error("No files provided")
        return jsonify({'error': 'No files provided'}), 400
    
    files = request.files.getlist('files')
    pdf_paths = []
    
    for file in files:
        if file and allowed_file(file.filename):
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            if file_size > MAX_FILE_SIZE:
                file.seek(0)
                logging.error(f"File {file.filename} exceeds 10MB limit")
                return jsonify({'error': f'File {file.filename} exceeds 10MB limit'}), 400
            file.seek(0)
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            pdf_paths.append(file_path)
        else:
            logging.error(f"Invalid file type: {file.filename}")
            return jsonify({'error': 'Invalid file type'}), 400
    
    try:
        raw_text = get_pdf_text(pdf_paths)
        text_chunks = get_text_chunks(raw_text)
        vectorstore = get_vectorstore(text_chunks)
        conversation = get_conversation_chain(vectorstore)
        
        if conversation is None:
            logging.error("Failed to create conversation chain")
            return jsonify({'error': 'Failed to create conversation chain'}), 500
        
        logging.info("PDFs processed successfully")
        return jsonify({'message': 'PDFs processed successfully'}), 200
    except Exception as e:
        logging.error(f"Error processing PDFs: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        for file_path in pdf_paths:
            try:
                os.remove(file_path)
                logging.info(f"Removed uploaded file: {file_path}")
            except Exception as e:
                logging.error(f"Error removing file {file_path}: {e}")

# Endpoint to handle user questions
@app.route('/api/ask', methods=['POST'])
def ask_question():
    global conversation, chat_history
    logging.info("Received question request")
    
    if conversation is None:
        logging.error("No documents processed yet")
        return jsonify({'error': 'No documents processed yet'}), 400
    
    data = request.get_json()
    if not data or 'question' not in data:
        logging.error("No question provided")
        return jsonify({'error': 'No question provided'}), 400
    
    user_question = data['question']
    
    try:
        # Log retrieved documents for debugging
        retrieved_docs = conversation.retriever.get_relevant_documents(user_question)
        logging.info(f"Retrieved {len(retrieved_docs)} documents for question: {user_question}")
        for i, doc in enumerate(retrieved_docs):
            logging.info(f"Document {i+1}: {doc.page_content[:200]}...")
        
        response = conversation({'question': user_question})
        chat_history = response['chat_history']
        
        formatted_history = []
        for i, message in enumerate(chat_history):
            role = 'user' if i % 2 == 0 else 'bot'
            formatted_history.append({'role': role, 'content': message.content})
        
        logging.info("Question processed successfully")
        return jsonify({'chat_history': formatted_history}), 200
    except Exception as e:
        logging.error(f"Error processing question: {e}")
        return jsonify({'error': str(e)}), 500

# Endpoint to reset vectorstore
@app.route('/api/reset', methods=['POST'])
def reset_vectorstore():
    global conversation, chat_history
    logging.info("Received vectorstore reset request")
    
    try:
        vectorstore_path = os.path.join(VECTORSTORE_PATH, "faiss_index")
        if os.path.exists(vectorstore_path):
            shutil.rmtree(vectorstore_path)
            logging.info("Vectorstore deleted")
        
        conversation = None
        chat_history = []
        os.makedirs(VECTORSTORE_PATH, exist_ok=True)
        
        logging.info("Vectorstore reset successfully")
        return jsonify({'message': 'Vectorstore reset successfully'}), 200
    except Exception as e:
        logging.error(f"Error resetting vectorstore: {e}")
        return jsonify({'error': str(e)}), 500

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health():
    logging.info("Health check requested")
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)