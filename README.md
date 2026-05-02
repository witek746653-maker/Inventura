# Inventura

A robust restaurant inventory management application with offline support and cloud synchronization.

## 📝 Overview
Inventura is a Progressive Web App (PWA) designed to streamline the inventory process in a restaurant environment. It allows staff to perform inventory sessions on mobile devices, even without an internet connection, and syncs data to a central database once online.

## 🚀 Features
- **Item Management**: Comprehensive database for tracking restaurant stock.
- **Inventory Sessions**: Structured workflow for conducting counts (Draft, In Progress, Completed).
- **Offline First**: Full functionality without internet via IndexedDB.
- **Cloud Sync**: Real-time synchronization with Supabase.
- **Advanced Import**: Excel/CSV import with support for floating images (Excel anchors).
- **History & Reporting**: Detailed logs of previous sessions and inventory differences.

## 🛠 Tech Stack
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript.
- **Storage**: IndexedDB (Local), Supabase/PostgreSQL (Remote).
- **Utilities**: XLSX.js for Excel processing.
- **PWA**: Service Workers for offline access.

## 📂 Project Structure
```text
Inventura/
├── assets/              # Icons and static images
├── config/              # Supabase configuration
├── js/                  # Modular logic (db.js, sync.js, inventory.js)
├── items.html           # Item management page
├── inventory-session.html # Active inventory interface
└── index.html           # Dashboard entry point
```

## 💻 Developer Instructions
### Setup
1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   npm install
   ```
2. **Supabase Config**:
   - Copy `config/supabase-config.example.js` to `config/supabase-config.js`.
   - Fill in your `Project URL` and `anon key`.
3. **Database Schema**:
   - Execute the SQL provided in the original Russian documentation (or check `supabase_schema_*.sql` files) in your Supabase SQL Editor.
4. **Run**:
   - Use a local server (e.g., `python -m http.server`) to avoid CORS issues with modules.

## 📄 License
Proprietary. Developed for internal restaurant use.

## Правила для автоматизированных агентов
См. папку [.agent](.agent/overview.md) — содержит подробные инструкции и правила (по темам: `api.md`, `data.md`, `devops.md`, `frontend.md`, `knowledge.md`, `testing.md`). Также сохранён краткий файл [AGENTS.md](AGENTS.md).
