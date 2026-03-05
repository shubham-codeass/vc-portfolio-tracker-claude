# VC Intel India ⚡

Free, open-source VC fund portfolio intelligence platform for Indian VC ecosystem.

## Features

- 🔍 **Scrape any VC fund portfolio page** — paste URL, get portfolio companies
- 📊 **20 known Indian VC funds** pre-loaded (Blume, Accel, Sequoia India, etc.)
- 📰 **Public news enrichment** via Google News RSS (free, no API key)
- 🔗 **Direct links** to Crunchbase, LinkedIn, company websites
- 📤 **CSV Export** for deal flow tracking
- 🚀 **Multiple funds at once** — track and compare portfolios
- 💡 **Grid / List / Table views** for different workflows

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **No paid APIs** — uses public web scraping + Google News RSS
- **Vercel** deployment (free tier)

## Deploy to Vercel (Free)

### Option 1: GitHub + Vercel (Recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo
4. Click Deploy (no env vars needed!)

### Option 2: Vercel CLI

```bash
npm i -g vercel
vercel
```

### Option 3: Local Development

```bash
npm install
npm run dev
# Visit http://localhost:3000
```

## Usage

1. **Add fund URLs** in the sidebar (e.g., `blume.vc` or `https://blume.vc/portfolio`)
2. **Or browse** the 20 known Indian VC funds and click to add
3. **Click Scrape** — results appear in the Database tab
4. **Click "✨ Enrich"** on any company to fetch news from Google News
5. **Export CSV** for your deal flow spreadsheet

## Known Fund URLs Included

| Fund | Portfolio URL |
|------|--------------|
| Blume Ventures | https://blume.vc/portfolio/ |
| Accel India | https://www.accel.com/companies |
| Peak XV (Sequoia India) | https://www.peakxv.com/companies/ |
| Kalaari Capital | https://www.kalaari.com/portfolio/ |
| 3one4 Capital | https://3one4.com/portfolio |
| Fireside Ventures | https://firesideventures.com/portfolio/ |
| Omnivore Partners | https://omnivore.vc/portfolio/ |
| ... and 13 more | |

## License

MIT — free to use, modify, and deploy.
