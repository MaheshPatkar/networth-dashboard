# Net Worth Dashboard Frontend

A React + Vite frontend for displaying a personal net worth dashboard using Excel workbook data.

## Features

- React 19 with TypeScript
- Recharts for charts and visualization
- Loads data from `public/data/networth.xlsx`
- Displays historical snapshots, asset/liability breakdown, and projections

## Scripts

- `npm run dev` - start Vite development server
- `npm run build` - build production assets
- `npm run preview` - preview production build locally
- `npm start` - run `server.js` to serve built assets from `dist`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Open the app in the browser:
   ```
   http://localhost:5173
   ```

## Notes

- The app expects an Excel workbook at `/data/networth.xlsx`.
- The `server.js` file provides a simple production static server for the `dist` folder.




    
