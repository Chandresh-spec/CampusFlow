# 🎓 Smart College System (EduHub)

A comprehensive college management and AI-assisted learning platform built with **FastAPI**, **Next.js 14**, **AWS S3**, **AWS SQS**, **AWS RDS**, and **Docker**.

---

## ✨ Key Features

### 1. 👥 Role-Based Portals (Student & Faculty)
- **Student Dashboard**: Semester-filtered lecture materials, debounced search, one-click direct S3 downloads, and activity tracking.
- **Faculty Dashboard**: Live analytics (total resources, views, pending approvals, student count), fast upload modal, and resource management.

### 2. ⚡ Direct-to-S3 File Uploads (Presigned URLs)
- Uploaded study materials and PDFs never pass through the server.
- The browser requests an **AWS S3 presigned PUT URL** and transfers files directly to S3 storage.

### 3. 🤖 Lumi AI Tutor (Document-Grounded RAG & GenAI)
- **Document-Grounded RAG Mode**: Indexes course PDFs into high-dimensional vector embeddings using Hugging Face sentence transformers, retrieving relevant chunks for context-aware Q&A.
- **General GenAI Mode**: Direct LLM conversational assistant powered by DeepSeek via Hugging Face.
- **Faculty AI Tone Enhancer**: Automatic polish for faculty announcements and doubts.

### 4. 📬 AWS SQS Asynchronous Processing
- PDF ingestion and vector indexing runs asynchronously via **Amazon SQS** background workers without blocking HTTP responses.

### 5. 💬 Anonymous Subject Chatrooms & Video Classroom
- Students ask doubts anonymously (`Student #1`, `Student #2`) to eliminate anxiety.
- Faculty reply with verified professor badges (`Prof. Sharma`).
- 1-click **Jitsi Meet** live video classroom integrated into each subject room.

### 6. 📢 University Notice Board
- Semester-targeted announcements with dismissal tracking for students and management controls for faculty.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend API** | Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2.0 (Async), Pydantic v2 |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, TanStack Query |
| **Database** | PostgreSQL (AWS RDS / AsyncPG) & SQLite (Local testing) |
| **Storage & Queues** | AWS S3 (Presigned URLs), AWS SQS (Async task queue) |
| **AI / Embeddings** | Hugging Face Inference API (`sentence-transformers/all-MiniLM-L6-v2`, DeepSeek) |
| **Infrastructure** | Docker, Docker Compose, Nginx Reverse Proxy, Ubuntu EC2 |

---

## 🚀 Quick Start (Local Development)

### 1. Start the FastAPI Backend
```bash
cd backend
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --port 8000
```
API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Start the Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```
Web Application: [http://localhost:3000](http://localhost:3000)

### 🔑 Test Accounts (Auto-seeded)
- **Faculty**: `prof_sharma` / `password123`
- **Student**: `rahul` / `password123` (Semester 5)

---

## ☁️ Deployment on AWS EC2

```bash
git clone https://github.com/Chandresh-spec/SmratCollegeSystem1.git
cd SmratCollegeSystem1
cp .env.example backend/.env
nano backend/.env    # Fill in your S3 bucket, SQS queue, and RDS endpoint
chmod +x deploy_ec2.sh
./deploy_ec2.sh
```

---

## 📄 License
MIT License.
