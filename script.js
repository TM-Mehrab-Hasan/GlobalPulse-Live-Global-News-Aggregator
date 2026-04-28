// Database of real-time RSS Feeds mapped by country
const newsSources = {
    "Bangladesh": [
        { name: "The Daily Star", url: "https://www.thedailystar.net/frontpage/rss.xml" },
        { name: "Prothom Alo", url: "https://en.prothomalo.com/feed/" },
        { name: "Dhaka Tribune", url: "https://www.dhakatribune.com/feed" },
        { name: "The Business Standard", url: "https://www.tbsnews.net/rss.xml" }
    ],
    "United States": [
        { name: "New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
        { name: "Washington Post", url: "https://feeds.washingtonpost.com/rss/world" },
        { name: "CNN", url: "http://rss.cnn.com/rss/edition_world.rss" }
    ],
    "United Kingdom": [
        { name: "BBC News", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
        { name: "The Guardian", url: "https://www.theguardian.com/world/rss" },
        { name: "Sky News", url: "https://news.sky.com/feeds/rss/world.xml" }
    ],
    "India": [
        { name: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms" },
        { name: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss" },
        { name: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories" }
    ],
    "Canada": [
        { name: "CBC News", url: "https://www.cbc.ca/webfeed/rss/rss-world" },
        { name: "The Globe and Mail", url: "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/" }
    ],
    "Australia": [
        { name: "ABC News", url: "https://www.abc.net.au/news/feed/51120/rss.xml" },
        { name: "The Sydney Morning Herald", url: "https://www.smh.com.au/rss/world.xml" }
    ]
};

// DOM Elements
const listEl = document.getElementById('country-list');
const gridEl = document.getElementById('news-grid');
const feedContainer = document.getElementById('feed-container');
const readerView = document.getElementById('reader-view');
const titleEl = document.getElementById('feed-title');
const updatedEl = document.getElementById('last-updated');
const searchInput = document.getElementById('news-search');
const categoryFilter = document.getElementById('category-filter');
const bookmarksBtn = document.getElementById('show-bookmarks');

// Reader Elements
const readerSource = document.getElementById('reader-source');
const readerTitle = document.getElementById('reader-title');
const readerMeta = document.getElementById('reader-meta');
const readerImage = document.getElementById('reader-image');
const readerContent = document.getElementById('reader-content');
const sidebarGrid = document.getElementById('sidebar-news');
const backBtn = document.getElementById('back-to-feed');
const themeToggleBtn = document.getElementById('theme-toggle');
const shareBtn = document.getElementById('share-article');
const listenBtn = document.getElementById('listen-article');
const bookmarkBtn = document.getElementById('bookmark-article');
const readingProgress = document.getElementById('reading-progress');
const summarizeBtn = document.getElementById('summarize-article');
const summaryBox = document.getElementById('summary-box');
const summaryContent = document.getElementById('summary-content');

// Global State
let allArticles = [];
let displayedArticles = [];
let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
let currentUtterance = null;
let currentArticle = null;
let articlesPerPage = 12;
let currentIndex = 0;
let autoRefreshInterval = null;
let fetchController = null;

// Intersection Observer for Lazy Loading
const observerOptions = {
    root: null,
    rootMargin: '200px',
    threshold: 0.1
};

const lazyLoadObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            loadMoreArticles();
        }
    });
}, observerOptions);

function initApp() {
    renderCountryList();
    
    // Load Saved Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
    }

    // Load Saved Region or default to Bangladesh
    const savedRegion = localStorage.getItem('selectedRegion') || "Global View";
    fetchNews(savedRegion);

    // Setup Auto-Refresh (Every 5 minutes)
    setupAutoRefresh();

    // Search events
    searchInput.addEventListener('input', () => {
        currentIndex = 0;
        gridEl.innerHTML = '';
        filterAndRender();
    });

    // Filter events
    categoryFilter.addEventListener('change', () => {
        currentIndex = 0;
        gridEl.innerHTML = '';
        filterAndRender();
    });

    // Theme Toggle
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
        });
    }

    // Reader events
    backBtn.addEventListener('click', closeArticle);

    // Share Event
    shareBtn.addEventListener('click', () => {
        if (!currentArticle) return;
        const title = currentArticle.title;
        const text = `Check out this news: ${title}`;
        const url = currentArticle.link;

        if (navigator.share) {
            navigator.share({ title, text, url });
        } else {
            navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
        }
    });

    // Listen Event
    listenBtn.addEventListener('click', toggleListen);

    // Summarize Event
    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', generateSummary);
    }

    // Bookmark in Reader
    bookmarkBtn.addEventListener('click', () => {
        if (currentArticle) toggleBookmark(currentArticle);
    });

    // Bookmarks Toggle
    if (bookmarksBtn) {
        bookmarksBtn.addEventListener('click', () => {
            document.querySelectorAll('.country-list li').forEach(item => item.classList.remove('active'));
            titleEl.textContent = "Saved Articles";
            closeArticle();
            allArticles = bookmarks;
            currentIndex = 0;
            filterAndRender();
        });
    }

    // Reading Progress Event
    window.addEventListener('scroll', () => {
        if (readerView.style.display === 'block') {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
            readingProgress.style.width = scrolled + "%";
        } else {
            readingProgress.style.width = "0%";
        }
    });

    // Register Service Worker for Offline Support
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('SW Registered', reg))
                .catch(err => console.log('SW Registration Failed', err));
        });
    }

    // Add Load More trigger to HTML
    const loadMoreTrigger = document.createElement('div');
    loadMoreTrigger.id = 'load-more-trigger';
    loadMoreTrigger.style.height = '10px';
    feedContainer.appendChild(loadMoreTrigger);
    lazyLoadObserver.observe(loadMoreTrigger);
}

function setupAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        const currentRegion = localStorage.getItem('selectedRegion') || "Global View";
        fetchNews(currentRegion, true); 
    }, 5 * 60 * 1000); 
}

function renderCountryList() {
    listEl.innerHTML = '';
    const savedRegion = localStorage.getItem('selectedRegion') || "Global View";

    const countries = ["Global View", ...Object.keys(newsSources)];

    countries.forEach(country => {
        const li = document.createElement('li');
        li.textContent = country;
        
        if(country === savedRegion) li.classList.add('active');

        li.addEventListener('click', (e) => {
            document.querySelectorAll('.country-list li').forEach(item => item.classList.remove('active'));
            e.target.classList.add('active');
            closeArticle(); 
            fetchNews(country);
            setupAutoRefresh(); 
        });

        listEl.appendChild(li);
    });
}

async function fetchNews(country, silent = false) {
    if (fetchController) {
        fetchController.abort();
    }
    fetchController = new AbortController();
    const { signal } = fetchController;

    localStorage.setItem('selectedRegion', country);
    titleEl.textContent = country === "Global View" ? "Top Global Headlines" : `Latest from ${country}`;

    if (!silent) {
        gridEl.innerHTML = '';
        renderSkeletons();
        currentIndex = 0;
        allArticles = [];
    }
    
    let feeds = [];
    if (country === "Global View") {
        Object.keys(newsSources).forEach(key => {
            feeds = feeds.concat(newsSources[key].slice(0, 2));
        });
    } else {
        feeds = newsSources[country] || [];
    }

    try {
        const uniqueArticlesMap = new Map();
        let processedCount = 0;

        for (const feed of feeds) {
            try {
                const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
                const res = await fetch(apiUrl, { signal });
                
                if (res.status === 429) {
                    console.warn(`Rate limited for ${feed.name}`);
                } else {
                    const data = await res.json();
                    
                    if (data.status === 'ok') {
                        data.items.slice(0, 5).forEach(item => {
                            const normalizedTitle = (item.title || "").toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                            if (!uniqueArticlesMap.has(normalizedTitle)) {
                                uniqueArticlesMap.set(normalizedTitle, {
                                    ...item,
                                    sourceName: feed.name,
                                    country: country === "Global View" ? (Object.keys(newsSources).find(k => newsSources[k].some(s => s.name === feed.name)) || "Global") : country
                                });
                            }
                        });
                    }
                }
                
                processedCount++;
                
                // Update UI incrementally after every 2 sources or when finished
                if (processedCount % 2 === 0 || processedCount === feeds.length) {
                    allArticles = Array.from(uniqueArticlesMap.values())
                        .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
                    
                    if (allArticles.length > 0) {
                        currentIndex = 0;
                        filterAndRender();
                    }
                }
                
                if (feeds.indexOf(feed) < feeds.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn(`Fetch Failed for ${feed.name}:`, err);
                
                processedCount++;
                if (processedCount % 2 === 0 || processedCount === feeds.length) {
                    allArticles = Array.from(uniqueArticlesMap.values())
                        .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
                    if (allArticles.length > 0) {
                        currentIndex = 0;
                        filterAndRender();
                    }
                }
            }
        }

        if (allArticles.length === 0 && !silent) {
            gridEl.innerHTML = `<div class="status-message">No news found. You might be offline, or sources are temporarily unavailable.</div>`;
            return;
        }

        updatedEl.innerHTML = `<span class="live-pulse" title="Live"></span> Last updated: ${formatDate(new Date())}`;
    } catch (err) {
        if (err.name !== 'AbortError' && !silent) {
            gridEl.innerHTML = `<div class="status-message">Error connecting to news server. Check your connection.</div>`;
        }
    }
}

function renderSkeletons() {
    for(let i=0; i<6; i++) {
        const skeleton = document.createElement('div');
        skeleton.classList.add('skeleton-card');
        skeleton.innerHTML = `
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-meta"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-btn"></div>
        `;
        gridEl.appendChild(skeleton);
    }
}

function filterAndRender() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value.toLowerCase();

    displayedArticles = allArticles.filter(article => {
        const title = (article.title || "").toLowerCase();
        const description = (article.description || "").toLowerCase();
        
        const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
        
        let matchesCategory = true;
        if (selectedCategory !== 'all') {
            const keywords = {
                politics: ['politics', 'government', 'election', 'minister', 'parliament', 'policy', 'president', 'trump', 'biden', 'pm'],
                tech: ['tech', 'technology', 'digital', 'software', 'app', 'gadget', 'silicon', 'internet', 'ai', 'crypto', 'google', 'apple', 'meta'],
                sports: ['sports', 'cricket', 'football', 'fifa', 'match', 'game', 'player', 'league', 'olympics', 'cup'],
                business: ['business', 'economy', 'market', 'stock', 'finance', 'company', 'trade', 'bank', 'invest']
            };
            
            const categoryKeywords = keywords[selectedCategory] || [];
            matchesCategory = categoryKeywords.some(kw => 
                title.includes(kw) || description.includes(kw)
            );
        }

        return matchesSearch && matchesCategory;
    });

    if (currentIndex === 0) gridEl.innerHTML = '';
    loadMoreArticles();
}

function loadMoreArticles() {
    const nextBatch = displayedArticles.slice(currentIndex, currentIndex + articlesPerPage);
    if (nextBatch.length === 0 && currentIndex === 0) {
        gridEl.innerHTML = `<div class="status-message">No articles matched your filters.</div>`;
        return;
    }

    renderArticles(nextBatch);
    currentIndex += articlesPerPage;
}

function highlightText(text, term) {
    if (!term) return text;
    // Escape regex characters
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function renderArticles(articles) {
    const searchTerm = searchInput.value.trim();

    articles.forEach(article => {
        const isBookmarked = bookmarks.some(b => b.link === article.link);
        const card = document.createElement('article');
        card.classList.add('news-card');

        const words = (article.content || article.description || "").split(' ').length;
        const readTime = Math.ceil(words / 200);

        const pubDate = new Date(article.pubDate);
        const isNew = (Date.now() - pubDate.getTime()) < 60 * 60 * 1000; // < 1 hour old
        const newBadge = isNew ? '<span class="new-badge">NEW</span>' : '';

        const displayTitle = highlightText(article.title, searchTerm);
        const displaySnippet = highlightText(cleanSnippet(article.description), searchTerm);
        const countryTag = article.country ? ` | ${article.country}` : '';

        card.innerHTML = `
            <div class="bookmark-toggle" title="Save for later">${isBookmarked ? '🔖' : '📑'}</div>
            <div class="news-source">[ ${article.sourceName}${countryTag} ]</div>
            <h3 class="news-title">
                <a href="javascript:void(0)" class="title-link">${displayTitle} ${newBadge}</a>
            </h3>
            <div class="news-meta">
                <span>🕒 ${formatDate(pubDate)}</span>
                <span class="read-time">• ${readTime} min read</span>
            </div>
            <p class="news-snippet">${displaySnippet}</p>
            <button class="read-more">Read Full Story</button>
        `;
        
        const titleLink = card.querySelector('.title-link');
        const readBtn = card.querySelector('.read-more');
        const bookmarkBtn = card.querySelector('.bookmark-toggle');

        titleLink.addEventListener('click', () => openArticle(article));
        readBtn.addEventListener('click', () => openArticle(article));
        bookmarkBtn.addEventListener('click', (e) => toggleBookmark(article, e));

        gridEl.appendChild(card);
    });
}

function openArticle(article) {
    currentArticle = article;
    feedContainer.style.display = 'none';
    readerView.style.display = 'block';
    window.scrollTo(0, 0);
    readingProgress.style.width = "0%";
    if(summaryBox) summaryBox.style.display = 'none';

    readerSource.textContent = article.sourceName;
    readerTitle.innerHTML = article.title;
    
    const isBookmarked = bookmarks.some(b => b.link === article.link);
    bookmarkBtn.textContent = isBookmarked ? '🔖' : '📑';
    
    const words = (article.content || article.description || "").split(' ').length;
    const readTime = Math.ceil(words / 200);
    readerMeta.innerHTML = `🕒 ${formatDate(article.pubDate)} <span class="read-time">• ${readTime} min read</span>`;
    
    let imgUrl = article.thumbnail || (article.enclosure ? article.enclosure.link : '');
    if (!imgUrl) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = article.content || article.description;
        const firstImg = tempDiv.querySelector('img');
        if (firstImg) imgUrl = firstImg.src;
    }

    readerImage.src = imgUrl || generatePlaceholder(article.sourceName);
    readerImage.style.display = 'block';

    let contentHtml = article.content || article.description || "Content could not be loaded.";
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentHtml;
    ['script', 'iframe', 'style', 'input', 'button', 'form'].forEach(tag => {
        tempDiv.querySelectorAll(tag).forEach(el => el.remove());
    });
    readerContent.innerHTML = tempDiv.innerHTML;

    renderSidebar();
}

function generateSummary() {
    if (summaryBox.style.display === 'block') {
        summaryBox.style.display = 'none';
        return;
    }
    
    summaryContent.innerHTML = '';
    const paragraphs = readerContent.querySelectorAll('p');
    let summaries = [];
    
    paragraphs.forEach(p => {
        const text = p.textContent.trim();
        if (text.length > 50) {
            // Very basic heuristic: Take the first sentence of long paragraphs
            const firstSentenceMatch = text.match(/[^.!?]+[.!?]+/);
            if (firstSentenceMatch) {
                const sentence = firstSentenceMatch[0].trim();
                if (summaries.length < 4 && !summaries.includes(sentence)) {
                    summaries.push(sentence);
                }
            }
        }
    });

    if (summaries.length === 0) {
        summaries.push("Content is too short or unstructured to generate a summary.");
    }

    summaries.forEach(s => {
        const li = document.createElement('li');
        li.textContent = s;
        summaryContent.appendChild(li);
    });
    
    summaryBox.style.display = 'block';
    summaryBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderSidebar() {
    sidebarGrid.innerHTML = '';
    const otherNews = allArticles.filter(a => a.link !== currentArticle.link).slice(0, 6);
    
    otherNews.forEach(article => {
        const card = document.createElement('div');
        card.classList.add('mini-card');
        card.innerHTML = `
            <div class="news-source">${article.sourceName}</div>
            <div class="news-title">${article.title}</div>
            <div class="news-meta">🕒 ${formatDate(article.pubDate)}</div>
        `;
        card.addEventListener('click', () => openArticle(article));
        sidebarGrid.appendChild(card);
    });
}

function closeArticle() {
    window.speechSynthesis.cancel();
    listenBtn.textContent = '🔊';
    readerView.style.display = 'none';
    feedContainer.style.display = 'block';
    currentArticle = null;
    if(summaryBox) summaryBox.style.display = 'none';
    readingProgress.style.width = "0%";
}

function toggleListen() {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        listenBtn.textContent = '🔊';
        return;
    }

    const text = `${readerTitle.textContent}. ${readerContent.textContent}`;
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = 1.1;
    currentUtterance.onend = () => listenBtn.textContent = '🔊';
    
    window.speechSynthesis.speak(currentUtterance);
    listenBtn.textContent = '⏹️';
}

// Offline Mode 2.0: Saving everything directly to the bookmark object
function toggleBookmark(article, e) {
    if (e) e.stopPropagation();
    
    const index = bookmarks.findIndex(b => b.link === article.link);
    if (index > -1) {
        bookmarks.splice(index, 1);
    } else {
        bookmarks.push(article);
    }
    
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    
    if (currentArticle && currentArticle.link === article.link) {
        bookmarkBtn.textContent = index > -1 ? '📑' : '🔖';
    }
    
    // Also toggle the active badge in the feed view without full re-render
    const bookmarkToggles = document.querySelectorAll('.bookmark-toggle');
    bookmarkToggles.forEach(toggle => {
        // Find if this toggle belongs to the exact article link, though slightly tricky via DOM, 
        // filterAndRender() works perfectly fine since it maintains state.
    });

    filterAndRender();
}

function generatePlaceholder(sourceName) {
    const initials = sourceName.split(' ').map(n => n[0]).join('').substring(0, 3).toUpperCase();
    const colors = ['#006a4e', '#0056b3', '#8e44ad', '#d35400', '#2c3e50', '#c0392b'];
    const color = colors[Math.abs(sourceName.length % colors.length)];
    
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
            <rect width="100%" height="100%" fill="${color}"/>
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="80" fill="white" font-weight="bold">${initials}</text>
            <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="24" fill="rgba(255,255,255,0.8)">NEWS SOURCE</text>
        </svg>
    `;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function cleanSnippet(htmlStr) {
    const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
    let text = doc.body.textContent || "";
    text = text.trim().replace(/\s+/g, ' '); 
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
}

function formatDate(dateOrString) {
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateOrString).toLocaleDateString('en-US', options);
}

// Start application
initApp();