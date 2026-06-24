# Preelly

A modern marketplace platform with Instagram Reels-style video product listings.

## 🚀 Features

- **Reels-Style Feed**: Auto-playing product videos in vertical scroll
- **Category Browsing**: Category grid with subcategories
- **Product Details**: Comprehensive product pages with video, images, seller info, and map
- **Authentication**: JWT-based login/signup system
- **Post Ads**: Upload videos, images, and create listings
- **Infinite Scroll**: Smooth scrolling with lazy loading
- **Responsive Design**: Mobile-first approach
- **User Dashboard**: Professional `/dashboard` with sidebar, topbar, dark mode, listings, orders, wishlist, notifications, and settings

## 📦 Tech Stack

### Frontend
- React 18
- Redux Toolkit
- React Router v6
- Tailwind CSS
- React Player
- Axios

### Backend
- Node.js + Express
- MongoDB
- JWT Authentication

## 🛠️ Installation

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
```

## 🏃 Running the Project

```bash
# Start frontend (port 3000)
npm run dev

# Start backend (port 5000)
npm run server
```

## 📁 Project Structure

```
preelly/
├── api/                # Backend API, docs, and scripts
├── front/              # Customer app (+ shared UI in front/src/shared)
└── admin/              # Admin panel
```

## 📝 API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/categories` - Get all categories
- `GET /api/products` - Get products (reels feed)
- `GET /api/products/:id` - Get product details
- `GET /api/products/related/:id` - Get related products
- `POST /api/products` - Create new product
- `GET /api/user/dashboard` - User dashboard
- `GET /api/user/profile` - Current user profile (protected)
- `PUT /api/user/profile` - Update profile fields (protected)
- `POST /api/user/profile` - Profile setup (multipart: avatar + location) (protected)
- `GET /api/user/listings` - Seller listings (pagination/search/filter) (protected)
- `GET /api/user/orders` - Buyer orders (pagination) (protected)
- `GET /api/user/wishlist` - Wishlist (alias for saved products) (protected)
- `GET /api/user/notifications` - Recent notifications (protected)

## 📌 Example API Responses

### GET `/api/user/listings?page=1&limit=12&q=iphone&status=active`

```json
{
  "items": [
    {
      "_id": "69c68fdf7ae4d8973d84d369",
      "title": "iPhone 14 Pro",
      "price": 1200,
      "currency": "USD",
      "status": "active",
      "images": ["/uploads/images/iphone.jpg"],
      "location": "Dubai",
      "createdAt": "2026-03-30T10:50:55.000Z"
    }
  ],
  "page": 1,
  "limit": 12,
  "total": 37,
  "totalPages": 4
}
```

### GET `/api/user/orders?page=1&limit=10`

```json
{
  "items": [
    {
      "_id": "69d000000000000000000001",
      "orderStatus": "placed",
      "paymentStatus": "unpaid",
      "totals": { "subtotal": 100, "fees": 0, "shipping": 0, "total": 100 },
      "product": { "_id": "69c68fdf7ae4d8973d84d369", "title": "iPhone 14 Pro", "images": ["/uploads/images/iphone.jpg"] },
      "seller": { "_id": "69d000000000000000000010", "name": "Seller", "avatar": null }
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1,
  "totalPages": 1
}
```

## 🗂️ Added Schemas

- `server/models/Order.js`
- `server/models/Notification.js`

## 🎨 UI Components

- CategoryGrid - Category layout
- ReelsFeed - Instagram Reels-style product feed
- ProductCard - Video product card with auto-play
- ProductDetail - Product detail page
- PostAdForm - Product creation form

## 🔒 Environment Variables

Create `.env` in server directory (copy `server/.env.example`):
```
PORT=5002
MONGODB_URI=your-mongodb-uri
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret
```

## 📄 License

MIT

