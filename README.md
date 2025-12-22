# LoopLingo

**AI-Driven Language Practice with Workflow-Based Feedback**

---

## Overview

LoopLingo is an AI-powered language learning platform designed to solve a key limitation of existing apps like Duolingo: **limited practice depth and shallow feedback**.

Instead of daily caps and generic responses, LoopLingo provides **unlimited CEFR-aligned practice** and uses **Kestra workflows** to asynchronously analyze learner performance and deliver targeted feedback.  
The frontend is deployed on **Vercel** for fast, global access.

---

## Problem Statement

Most language learning platforms suffer from:

1. Limited daily practice sessions
2. No session-level mistake analysis
3. Synchronous, blocking feedback that hurts user experience

This makes them ineffective for:

- Serious learners
- CEFR / DELF preparation
- Entrance exams and grammar-heavy evaluations

---

## Solution

LoopLingo introduces a workflow-driven architecture:

- Unlimited AI-generated exercises aligned to CEFR units
- Real-time scoring and mistake tracking
- **Asynchronous feedback via Kestra workflows**
- Fast, production-grade frontend deployment using Vercel

Feedback generation is offloaded to Kestra, ensuring the learning flow is never blocked.

---

## Why Kestra (Sponsor Tool)

Kestra is a **core architectural component**, not a background utility.

### Kestra handles:

- Webhook-triggered workflows at the end of learning sessions
- Independent AI analysis of user mistakes
- Workflow-based feedback generation
- Callback delivery of results to the application

### Benefits:

- Non-blocking feedback
- Observable and retryable executions
- Easy extension to reports, emails, PDFs, or LMS systems

This aligns naturally with Kestra’s event-driven orchestration model.

---

## Why Vercel (Sponsor Tool)

Vercel is used for:

- Instant frontend deployment
- Automatic CI/CD from GitHub
- Global edge delivery for low latency

Judges can access the platform immediately without setup.

---

## Tech Stack

### Frontend

- React
- Axios
- Vercel

### Backend

- Node.js
- Express
- Groq API (LLMs)

### Workflow Orchestration

- Kestra (Webhook-triggered workflows)

### Deployment

- Frontend: Vercel
- Backend: Render
- Kestra: Local (demo), cloud-ready

---

## Architecture

User
↓
Vercel Frontend (React)
↓
Render Backend (Node.js / Express)
↓
Kestra Webhook Trigger
↓
Kestra Workflow
├─ AI Feedback (Groq)
└─ Callback to Backend
↓
Frontend Notifications

**Key idea:** AI feedback is fully decoupled from the user interaction flow.

---

## Kestra Workflow Design

Each learning session triggers a Kestra workflow that:

1. Receives session data via webhook
2. Generates concise, targeted feedback using an LLM
3. Sends results back to the application through a callback API

This ensures:

- Faster perceived performance
- Fault isolation
- Clear execution visibility

---

## Demo & Deployment Notes

- Frontend is fully deployed on Vercel
- Backend is deployed on Render
- Kestra runs locally during the demo

### Why Kestra is local in the demo:

- Ensures deterministic execution during judging
- Avoids free-tier cloud instability
- Workflow is production-ready and cloud-portable without code changes

This is an intentional engineering decision.

---

## CEFR Alignment

LoopLingo is structured strictly around:

- CEFR levels (A1, A2, B1, etc.)
- Unit-based grammar and vocabulary progression
- Difficulty scaling per unit

Currently, **French** is implemented end-to-end to demonstrate depth and correctness.  
The architecture supports adding additional languages without redesign.

---

## Scalability & Future Scope

- Multi-language expansion
- Exam-oriented practice modes (DELF, IELTS-style grammar)
- User accounts and progress analytics
- Cloud-hosted Kestra for large-scale orchestration
- Institutional usage (schools, coaching centers)
- Automated performance reports and revision plans

---

## Docker & Production Readiness

- Backend and workflows are container-ready
- Services are loosely coupled
- Architecture supports migration to cloud VMs or managed workflow services

---

## Conclusion

LoopLingo demonstrates how **Vercel** and **Kestra** can be combined to build a real-world, scalable learning platform — not just a demo application.

The focus is on:

- Real problems
- Correct architecture
- Sponsor-aligned tooling
- Production-ready design

---
