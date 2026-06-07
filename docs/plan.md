# Stydusphere Project Plan

## Goal
Build an intelligent MCA study assistant that combines AI, RAG, NLP, vector search, and web development to help students find answers from uploaded study material and create personalized study workflows.

## Scope
- File ingestion: PDF, DOCX, TXT
- Semantic search over uploaded notes
- RAG-powered chat answers with citations
- Semester-wise knowledge organization
- Previous paper analytics and question generation
- Revision planner, quiz generator, summarizer, voice-enabled query support

## Architecture

1. File Upload
   - Accept user files
   - Extract text from PDF/DOCX/TXT
   - Chunk and embed text
   - Store vectors in a vector DB (Chroma/FAISS)

2. Retrieval
   - User query arrives
   - Retrieve relevant text chunks
   - Use generative AI to produce an answer
   - Attach source references

3. AI Layer
   - Local model / API model wrapper
   - Prompt design for trustworthy, citation-aware responses
   - Support GPT-style and multi-model fallback

4. Frontend
   - Next.js + Tailwind UI
   - Dashboard for file upload, chat, analytics, planners
   - Student experience for interactive study work

5. Backend
   - FastAPI endpoints
   - Ingestion, retrieval, chat history, user management
   - Service layer for RAG and AI interactions

## Milestones

### Phase 1: Foundation
- Create backend API framework
- Build frontend shell and navigation
- Implement file upload endpoint
- Create text extraction placeholder
- Add simple chat route

### Phase 2: RAG Core
- Add document chunking and embedding service
- Integrate vector store placeholder
- Build retrieval endpoint
- Wire frontend chat to backend retrieval

### Phase 3: Knowledge Base
- Organize uploaded content by semester and subject
- Add metadata support for subject tags
- Build UI sections for semester knowledge base

### Phase 4: Advanced Study Tools
- Previous paper frequency analysis
- Question paper generation endpoint
- Exam revision planner endpoint
- Notes summarizer endpoint
- Quiz generator endpoint

### Phase 5: Polish
- Add source citations to answers
- Add chat history and file library UI
- Add voice query support
- Add authentication and user profiles

## Database Design

### Users
- id
- name
- email
- semester
- created_at

### UploadedFiles
- id
- user_id
- file_name
- file_type
- upload_date
- status
- metadata

### Documents
- id
- file_id
- chunk_text
- embedding_id
- page_number
- source_reference

### ChatHistory
- id
- user_id
- question
- answer
- sources
- timestamp

## Technology Stack

- Frontend: React, Next.js, Tailwind CSS
- Backend: Python, FastAPI
- AI layer: Gemini / OpenAI / Claude API wrapper
- RAG: LangChain / LlamaIndex
- Vector DB: ChromaDB / FAISS
- Storage: Firebase / Supabase

## Implementation Notes

- Start with a placeholder implementation for AI and vector store.
- Keep the code modular: `services/ai`, `services/loader`, `services/vector`.
- Use async operations in FastAPI for file processing.
- Provide clear interfaces and documentation for future expansion.
