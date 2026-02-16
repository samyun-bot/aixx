# 🔍 Election Registry - TypeScript Version

Armenian Election Registry Search application built with **TypeScript, Node.js + Express** backend and **TypeScript** frontend.

## 🚀 Project Structure

```
election/
├── src/
│   ├── server.ts                 # Express server
│   └── client/
│       ├── app.ts                # Main app entry point
│       ├── search.ts             # Search functionality
│       ├── map.ts                # Yandex Maps integration (no API key)
│       └── types.ts              # TypeScript interfaces
├── public/
│   └── index.html               # Frontend template
├── dist/                         # Compiled JavaScript (generated)
├── package.json                  # Dependencies
├── tsconfig.json                # TypeScript configuration
├── webpack.config.js            # Webpack configuration
└── README.md                     # This file
```

## 📦 Installation

### Prerequisites
- Node.js 16+ and npm

### Setup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Build frontend with webpack
npm run client:build

# Start the server
npm start
```

Or for development with auto-reload:

```bash
# Terminal 1: Start TypeScript in watch mode
npm run watch

# Terminal 2: Start Express server
npm run dev

# Terminal 3 (optional): Watch and rebuild frontend
npm run client:dev
```

## 🎯 Features

- ✅ **Full TypeScript** - Type-safe frontend and backend
- ✅ **Express.js Server** - Fast, minimal Node.js HTTP server
- ✅ **Web Scraping** - Using Cheerio for HTML parsing
- ✅ **Cloudflare Bypass** - CloudScraper integration
- ✅ **Yandex Maps Integration** - Display addresses on map (no API key)
- ✅ **Telegram Notifications** - Log all searches to Telegram
- ✅ **Multi-language UI** - Armenian, Russian, English
- ✅ **Responsive Design** - Mobile-optimized interface

## 🔧 API Endpoints

### POST `/api/search`

Search for voters in the Armenian Election Registry.

**Request Body:**
```json
{
  "first_name": "Գրիգոր",
  "last_name": "Գրիգորյան",
  "middle_name": "Ավթանդիլի",
  "birth_date": "18/05/1981",
  "region": "ԱՐՄԱՎԻՐ",
  "community": "ՎԱՂԱՐՇԱՊԱՏ",
  "street": "ՄԱՆՈՒԿՅԱՆ",
  "building": "2",
  "apartment": "20",
  "district": "14"
}
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "results": [
    {
      "name": "Գեւորգյան Արմեն Ավթանդիլի",
      "birth_date": "18/05/1981",
      "region_community": "ԱՐՄԱՎԻՐ, ՎԱՂԱՐՇԱՊԱՏ",
      "address": "ՄԱՆՈՒԿՅԱՆ 2 ԹՂՄ. 20",
      "district": "14"
    }
  ]
}
```

## 🌐 Frontend

Built with vanilla TypeScript and Bootstrap 5:
- Type-safe form handling
- Real-time map integration
- Telegram data logging
- Responsive grid layout

## 🚀 Deployment

### With Render.com

1. Push code to GitHub
2. Connect repository to Render
3. Set environment variables if needed
4. Deploy!

Or run on your own server:

```bash
npm install
npm run build
npm run client:build
npm start
```

Server runs on `http://localhost:5000` by default.

## 📝 Environment Variables

Create `.env` file if needed:
```
PORT=5000
NODE_ENV=production
```

## 🔐 Security Notes

- CSRF token is fetched fresh from the target website
- CloudScraper handles Cloudflare protection
- All user data is properly escaped in HTML
- Telegram API key is embedded (consider moving to ENV for production)

## 📚 Tech Stack

- **Backend:** TypeScript, Node.js, Express, Cheerio, CloudScraper, Axios
- **Frontend:** TypeScript, Vanilla JS, Bootstrap 5, Yandex Maps API
- **Build:** Webpack, ts-loader, TypeScript Compiler
- **Scraping:** BeautifulSoup-like parsing with Cheerio

## 🐛 Troubleshooting

### Map not loading?
- Ensure Yandex Maps API script loads (https://api-maps.yandex.ru/2.1/?lang=ru_RU)
- Check browser console for errors
- Verify address format for search

### Search returns no results?
- Try with minimal fields (first/last name only)
- Ensure correct region/community selection
- Check date format (DD/MM/YYYY)

### Build errors?
```bash
# Clean and rebuild
rm -rf dist
npm run build
npm run client:build
```

## 📦 Migrated from Flask

This project was originally built with Flask + Python. Key changes:
- **Backend:** Flask → Express.js (Node.js)
- **Frontend:** Vanilla JS → TypeScript
- **Template Engine:** Jinja2 → Static HTML
- **Build Tool:** None → Webpack

All functionality preserved!

## 📄 License

Open source - Use freely

## 👨‍💻 Development

```bash
# Format code
npm run format

# Type check
npm run type-check

# Watch mode
npm run watch && npm run client:dev
```

## 🚀 Deployment on Render

The project is configured for easy deployment on [Render](https://render.com).

### Automatic Deployment

1. Push your code to GitHub/GitLab
2. Connect your repository to Render
3. Render will automatically:
   - Detect Node.js project
   - Run `npm install`
   - Execute `postinstall` hook to build TypeScript and compile Webpack bundles
   - Run `npm start` to start the server

### Manual Configuration (if needed)

**Build Command:** `npm install && npm run build`

**Start Command:** `npm start`

**Environment Variables:**
- `NODE_ENV=production` (already set in render.yaml)
- `PORT` (automatically set by Render)

### Deployment Steps

1. **Connect Repository:**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Select your GitHub/GitLab repository
   - Authorize Render access

2. **Configure Service:**
   - **Name:** `election-registry` (or your choice)
   - **Runtime:** Node
   - **Region:** Choose closest to your users
   - **Branch:** main (or your default branch)

3. **Deploy:**
   - Render will start building automatically
   - Check build logs for any issues
   - Once deployed, your app will be live at `https://your-service-name.onrender.com`

### Notes

- The `render.yaml` file contains explicit deployment configuration
- Environment variables remain in the code as requested
- The server binds to `0.0.0.0` for Render compatibility
- Build output (`dist/`) is generated during deployment

---

Made with ❤️ for Armenian Election Registry
# aix
# aix
# aixx
# aixx
