# Droid Proctoring - AI-Powered Secure Assessment System

Droid Proctoring is a premium, high-security assessment platform built with **Next.js**, **PostgreSQL**, and **OpenAI AI Analysis**. It features real-time proctoring, face detection, session recording, and an Evaluation Center for security audits.

---

## 🚀 Step-by-Step Installation Guide

Follow these steps to set up the project on your new system.

### 1. Prerequisites
Ensure you have the following installed:
- **Node.js** (v18.x or later)
- **PostgreSQL** (Running locally or on a cloud instance)
- **Git**

### 2. Clone the Repository
```bash
git clone https://github.com/vaishnavucv/droid-proctoring.git
cd droid-proctoring
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Environment Configuration
Create a `.env.local` file in the root directory and add the following variables:

```env
# Database Configuration
DATABASE_URL=postgres://your_user:your_password@localhost:5432/your_db_name

# OpenAI Configuration (For AI Proctoring Analysis)
OPENAI_API_KEY=your_openai_api_key_here

# App URL (Optional, defaults to localhost:3000)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Database Setup
The project includes a seeding script to create the necessary tables (`users`, `courses`, `user_assessments`) and populate them with initial data.

**Edit `scripts/seed.js`** to match your database connection string, then run:
```bash
node scripts/seed.js
```

### 6. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

---

## 🛠 Features Breakdown

- **AI Proctoring**: Automated detection of external IDEs, unauthorized tabs, and multiple faces.
- **Evaluation Center**: A dedicated dashboard for administrators to review session recordings and AI logs.
- **Session Continuity**: Multi-Attempt logic with "Retake" and "Reset" capabilities.
- **Lab Integration**: Secure iframe integration with cloud-based lab environments.
- **Zero-Storage Resilience**: Recording happens in 5-second chunks locally before being indexed for audit.

---

## 📂 Project Structure

- `/app`: Next.js App Router (Pages, APIs, and Layouts).
- `/components`: Reusable UI components (Shadcn UI).
- `/lib`: Database and utility shared logic.
- `/public`: Static assets and course configuration.
- `/scripts`: Database migration and seeding scripts.

---

## 📝 Credentials (Default)
If you used the seeding script, you can log in with:
- **Username**: `user1`
- **Password**: `password123`

---

## ⚖️ License
Internal Use Only - Nuvepro Cybersecurity Team.
