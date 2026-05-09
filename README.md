# 💊 MedFinder

MedFinder is a modern, full-stack web application designed to help users search for medicines, check availability, compare prices, and locate nearby pharmacies on an interactive map.

## 🚀 Tech Stack

**Frontend:**
- HTML5, CSS3, Vanilla JavaScript
- Leaflet.js (for OpenStreetMap integration)

**Backend:**
- Node.js & Express.js (REST API)
- MongoDB & Mongoose (Database)

## 📁 Project Structure

```
medfinder/
├── client/                 # Frontend static files
│   ├── css/style.css       # Global styles
│   ├── js/                 # Client scripts (app, api, map, admin, search)
│   ├── pages/              # HTML pages (admin, details, login)
│   └── index.html          # Main landing/search page
├── server/                 # Node.js backend
│   ├── config/db.js        # MongoDB connection
│   ├── controllers/        # Route controllers
│   ├── models/             # Mongoose schemas (Pharmacy & Medicines)
│   ├── routes/             # Express API routes
│   └── server.js           # Express app entry point
├── .env                    # Environment variables
└── package.json            # Node dependencies and scripts
```

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js (v14 or higher)
- MongoDB (running locally on port 27017 or a MongoDB Atlas URI)

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Environment Variables
Ensure your `.env` file is set up in the root directory:
```env
MONGODB_URI=mongodb://localhost:27017/medfinder
PORT=5000
NODE_ENV=development
```

### 4. Running the App
Start the development server:
```bash
npm run dev
```
The application will be running at `http://localhost:5000`.

### 5. Seeding Sample Data
To populate the database with sample pharmacies and medicines for the first time, visit:
`http://localhost:5000/api/pharmacies/seed`

## 🔐 Admin Access
- **URL:** `http://localhost:5000/pages/login`
- **Email:** `admin@medfinder.com`
- **Password:** `admin123`

*(Note: Admin login is currently simulated on the frontend for demonstration purposes).*
