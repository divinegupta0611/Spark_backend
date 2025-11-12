import express from "express";
import Company from "../models/Company.js";
import axios from "axios";
import { parseStringPromise } from "xml2js";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("Backend API is working!");
});

// Get random company
router.get("/random-nse", async (req, res) => {
  try {
    const count = await Company.countDocuments();
    const randomIndex = Math.floor(Math.random() * count);
    const randomCompany = await Company.findOne().skip(randomIndex);

    if (!randomCompany) {
      return res.status(404).json({ message: "No companies found" });
    }

    const symbol = randomCompany.SYMBOL;

    try {
      const response = await axios.get(`https://www.nseindia.com/api/quote-equity?symbol=${symbol}`, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br"
        }
      });

      res.json({
        symbol,
        nseData: response.data,
        likes: randomCompany.likes || 0,
        dislikes: randomCompany.dislikes || 0
      });
    } catch (nseError) {
      console.error("NSE API Error:", nseError.message);
      res.json({
        symbol,
        nseData: null,
        likes: randomCompany.likes || 0,
        dislikes: randomCompany.dislikes || 0,
        error: "NSE data temporarily unavailable"
      });
    }

  } catch (error) {
    console.error("Error fetching random company:", error.message);
    res.status(500).json({ error: "Failed to fetch company data" });
  }
});

// Search company by symbol
router.get("/search-nse", async (req, res) => {
  try {
    const { symbol } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol parameter is required" });
    }

    const symbolUpper = symbol.toUpperCase().trim();

    // Find or create company in database
    let company = await Company.findOne({ SYMBOL: symbolUpper });

    if (!company) {
      company = new Company({
        SYMBOL: symbolUpper,
        likes: 0,
        dislikes: 0
      });
      await company.save();
    }

    // Try to fetch NSE data
    try {
      const response = await axios.get(`https://www.nseindia.com/api/quote-equity?symbol=${symbolUpper}`, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br"
        }
      });

      res.json({
        symbol: symbolUpper,
        nseData: response.data,
        likes: company.likes || 0,
        dislikes: company.dislikes || 0
      });

    } catch (nseError) {
      console.error("NSE API Error for symbol:", symbolUpper, nseError.message);
      return res.status(404).json({ 
        error: "Company symbol not found on NSE or API unavailable" 
      });
    }

  } catch (error) {
    console.error("Error searching company:", error.message);
    res.status(500).json({ error: "Failed to search company" });
  }
});

// Like a company
router.post("/like-company", async (req, res) => {
  try {
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const symbolUpper = symbol.toUpperCase().trim();

    // Find or create company
    let company = await Company.findOne({ SYMBOL: symbolUpper });

    if (!company) {
      company = new Company({
        SYMBOL: symbolUpper,
        likes: 1,
        dislikes: 0
      });
    } else {
      company.likes = (company.likes || 0) + 1;
    }

    await company.save();

    console.log(`✅ Liked ${symbolUpper}: ${company.likes} likes, ${company.dislikes} dislikes`);

    res.json({
      success: true,
      symbol: symbolUpper,
      likes: company.likes,
      dislikes: company.dislikes
    });

  } catch (error) {
    console.error("Error liking company:", error.message);
    res.status(500).json({ error: "Failed to update like" });
  }
});

// Dislike a company
router.post("/dislike-company", async (req, res) => {
  try {
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const symbolUpper = symbol.toUpperCase().trim();

    // Find or create company
    let company = await Company.findOne({ SYMBOL: symbolUpper });

    if (!company) {
      company = new Company({
        SYMBOL: symbolUpper,
        likes: 0,
        dislikes: 1
      });
    } else {
      company.dislikes = (company.dislikes || 0) + 1;
    }

    await company.save();

    console.log(`❌ Disliked ${symbolUpper}: ${company.likes} likes, ${company.dislikes} dislikes`);

    res.json({
      success: true,
      symbol: symbolUpper,
      likes: company.likes,
      dislikes: company.dislikes
    });

  } catch (error) {
    console.error("Error disliking company:", error.message);
    res.status(500).json({ error: "Failed to update dislike" });
  }
});

router.get("/company-news/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    // Find company to get full name
    const company = await Company.findOne({ SYMBOL: symbol.toUpperCase() });
    
    // Create search query - use company name if available, otherwise use symbol
    const searchQuery = company && company.NAME 
      ? `${company.NAME} stock OR business`
      : `${symbol} stock OR business`;

    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}`;

    console.log(`📰 Fetching news for: ${searchQuery}`);

    // Fetch RSS feed
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 10000
    });

    // Parse XML to JSON
    const result = await parseStringPromise(response.data);
    
    if (!result.rss || !result.rss.channel || !result.rss.channel[0].item) {
      return res.json({ news: [] });
    }

    // Extract first 5 news items
    const items = result.rss.channel[0].item.slice(0, 5);
    
    const news = items.map(item => ({
      title: item.title?.[0] || "No title",
      link: item.link?.[0] || "#",
      pubDate: item.pubDate?.[0] || "",
      source: item.source?.[0]?._ || item.source?.[0] || "Unknown Source"
    }));

    console.log(`✅ Found ${news.length} news articles`);

    res.json({ 
      symbol: symbol.toUpperCase(),
      news 
    });

  } catch (error) {
    console.error("Error fetching news:", error.message);
    res.status(500).json({ 
      error: "Failed to fetch news",
      news: [] 
    });
  }
});

// Get top 10 most liked companies
router.get("/top-liked", async (req, res) => {
  try {
    // Find top 10 companies sorted by likes in descending order
    const topCompanies = await Company.find({ likes: { $gt: 0 } })
      .sort({ likes: -1 })
      .limit(10)
      .select('SYMBOL likes dislikes');

    console.log(`📊 Found ${topCompanies.length} top liked companies`);

    res.json({
      success: true,
      count: topCompanies.length,
      companies: topCompanies
    });

  } catch (error) {
    console.error("Error fetching top liked companies:", error.message);
    res.status(500).json({ error: "Failed to fetch top liked companies" });
  }
});

// Get top 10 most disliked companies
router.get("/top-disliked", async (req, res) => {
  try {
    // Find top 10 companies sorted by dislikes in descending order
    const topCompanies = await Company.find({ dislikes: { $gt: 0 } })
      .sort({ dislikes: -1 })
      .limit(10)
      .select('SYMBOL likes dislikes');

    console.log(`📊 Found ${topCompanies.length} top disliked companies`);

    res.json({
      success: true,
      count: topCompanies.length,
      companies: topCompanies
    });

  } catch (error) {
    console.error("Error fetching top disliked companies:", error.message);
    res.status(500).json({ error: "Failed to fetch top disliked companies" });
  }
});

export default router;