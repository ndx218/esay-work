# 📘 Assignment Terminator API Documentation

This document outlines the purpose and usage of each API endpoint under `/pages/api/`.

---

## 📑 `/api/outline.ts`
**Purpose**: Generate a paragraph outline in Markdown format.  
**Input**: `title`, `wordCount`, `language`, `tone`, `detail`, `reference`, `rubric`, `paragraph`  
**Output**: Markdown-formatted outline.  
**Notes**: Prepares for future Gork API integration for reference-enhanced outlining.

---

## ✍️ `/api/draft.ts`
**Purpose**: Generate a full draft based on the generated outline and user input.  
**Input**: Same as `/outline.ts` + `outline`  
**Output**: A well-structured article draft.

---

## 🧑‍🏫 `/api/feedback.ts`
**Purpose**: Simulate a teacher's feedback in bullet-point format.  
**Input**: `text` (draft to review)  
**Output**: Bullet-point list of issues and improvement suggestions.  
**Notes**: Ready to support external tools like Gork.

---

## 🧑‍🏫 `/api/rewrite.ts`
**Purpose**: Rewrite and enhance the draft to improve clarity, flow, and structure.  
**Input**: `text`  
**Output**: Improved version of the original draft.

---

## 🤖 `/api/undetectable.ts`
**Purpose**: Humanize or rephrase the content using undetectable AI style.  
**Input**: `text`  
**Output**: Final version optimized for detection evasion or natural tone.

---

## ✅ Decommissioned:
**`/api/generate.ts` or `Step1 Step2 Final Api`**  
This was the monolithic handler for all writing steps.  
Now deprecated in favor of modular APIs listed above.

---

> This modular setup improves maintainability, scalability, and aligns with RESTful principles.
