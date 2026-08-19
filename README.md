# JS Labels - Sales CRM & Reorder Intelligence Application

A web application built for **JS Labels** to manage sales pipelines, customer accounts, orders, automated reorder reminders, and executive analytics.

---

## 🌟 Key Features

1. **Lead Management & Kanban Board**:
   - Interactive drag-and-drop pipeline across stages (*New*, *Contacted*, *Follow-up*, *Order Received*, *Cancelled*).
   - Real-time search, priority filtering, quick activity note loggers, and executive reassignments.

2. **Customer 360° Directory**:
   - Customer profile management with historical purchase tracking and reorder probability calculations.

3. **Orders Management**:
   - Complete order lifecycle tracking (*Pending*, *Confirmed*, *In Production*, *Quality Check*, *Dispatched*, *Delivered*, *Cancelled*).

4. **Smart Reorder Forecasts & Reminders**:
   - AI-based reorder prediction timing, probability metrics, and automated escalation stages (*Warning*, *Escalation*, *MD Review*).

5. **Executive Reports & Analytics**:
   - Live revenue growth trends, product sales distribution donut charts, tele-caller win rate leaderboards, and CSV exports.

6. **Soft Delete & System Trash Recovery**:
   - Application-wide soft deletion (`isDeleted`, `deletedAt`, `deletedBy`) with Super Admin recovery control in System Trash.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React Icons, Recharts, Hello Pangea DnD.
- **Backend**: Node.js, Express, MongoDB, Mongoose ODM, JWT Authentication.

---

## 🚀 Quick Setup & Installation

### Prerequisites
- Node.js (v18+)
- MongoDB database instance (Local or MongoDB Atlas)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/JS-Labels-WA.git
cd JS-Labels-WA
```

### 2. Backend Setup (`server`)
```bash
cd server
npm install
```
Create a `.env` file in the `server` directory using the provided `.env.example` template:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/js-labels-wa
JWT_SECRET=your_jwt_secret_key_here
```

Start backend development server:
```bash
npm run dev
```

### 3. Frontend Setup (`client`)
Open a new terminal window:
```bash
cd client
npm install
```
Create a `.env` file in the `client` directory using `.env.example`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start frontend development server:
```bash
npm run dev
```

---

## 🔒 Security & Environment Notes
- **Secrets & Credentials**: All sensitive files (`.env`), database passwords, JWT secrets, and uploaded files are excluded from Git via `.gitignore`.
- **Environment Templates**: Refer to `.env.example` files in `client/` and `server/` when deploying to production.
