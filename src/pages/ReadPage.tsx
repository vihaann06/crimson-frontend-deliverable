/**
 * Read Page - Infinite Article Reader
 * 
 * This is your main page for the infinite scroll article reader.
 * 
 * TODO: Implement:
 * - Refresh resilience (localStorage/sessionStorage)
 * - Prefetch next page
 * - Search bar with debouncing
 * - Loading, error, and empty states
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchArticles } from '../api/client';
import type { ArticleListItem } from '../types';
import './ReadPage.css';

export default function ReadPage() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(articleId ?? null);

  const CATEGORIES = [
    'Technology', 'Science', 'Business', 'Health',
    'Culture', 'Politics', 'Environment', 'Education',
  ];

  // TODO: Implement refresh resilience
  // TODO: Implement prefetch

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const articleRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    // Initial load
    loadArticles();
  }, []);

  // Debounce search input → searchQuery (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // When searchQuery or category changes, reset and reload from scratch
  useEffect(() => {
    setArticles([]);
    setNextCursor(null);
    setHasMore(true);
    loadArticles();
  }, [searchQuery, selectedCategory]);

  const loadArticles = useCallback(async (cursor: string | null = null) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchArticles({
        cursor,
        limit: 10,
        q: searchQuery || null,
        category: selectedCategory,
      });

      console.log("fetched 10 articles")

      setArticles(prev => cursor ? [...prev, ...response.items] : response.items);
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  // Infinite scroll: observe sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        loadArticles(nextCursor);
      }
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, nextCursor, loadArticles]);

  // Active article tracking: find the article closest to the viewport center
  useEffect(() => {
    let ticking = false;

    const updateActiveArticle = () => {
      const viewportCenter = window.innerHeight / 2;
      let closestId: string | null = null;
      let closestDistance = Infinity;

      articleRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect();
        const articleCenter = rect.top + rect.height / 2;
        const distance = Math.abs(articleCenter - viewportCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = id;
        }
      });

      if (closestId) {
        setActiveArticleId(closestId);
      }
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateActiveArticle();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    updateActiveArticle(); // set initial active article
    return () => window.removeEventListener('scroll', onScroll);
  }, [articles]);

  // Update URL when active article changes
  useEffect(() => {
    if (activeArticleId) {
      navigate(`/read/${activeArticleId}`, { replace: true });
    }
  }, [activeArticleId, navigate]);

  return (
    <div className="read-page">
      <header className="read-header">
        <h1>Article Reader</h1>
        <input
          type="text"
          className="search-bar"
          placeholder="Search articles..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <div className="category-filters">
          <button
            className={`category-btn${selectedCategory === null ? ' active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`category-btn${selectedCategory === cat ? ' active' : ''}`}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>
      
      <main className="read-content">
        {loading && articles.length === 0 && (
          <div className="loading-state">Loading articles...</div>
        )}
        
        {error && (
          <div className="error-state">
            <p>Error: {error}</p>
            <button onClick={() => loadArticles()}>Retry</button>
          </div>
        )}
        
        {articles.length === 0 && !loading && !error && (
          <div className="empty-state">
            <p>No articles found.</p>
          </div>
        )}
        
        <div className="articles-list">
          {articles.map((article) => (
            <article
              key={article.id}
              data-article-id={article.id}
              ref={(el) => {
                if (el) articleRefs.current.set(article.id, el);
                else articleRefs.current.delete(article.id);
              }}
              className={`article-card${activeArticleId === article.id ? ' active' : ''}`}
            >
              <h2>{article.title}</h2>
              <p className="article-dek">{article.dek}</p>
              <div className="article-meta">
                <span>By {article.author}</span>
                <span>•</span>
                <span>{article.readingTimeMins} min read</span>
                <span>•</span>
                <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
              </div>
              {/* TODO: Render full article content */}
            </article>
          ))}
        </div>
        
        <div ref={sentinelRef} style={{ height: 1 }} />
        {loading && articles.length > 0 && (
          <div className="loading-more">Loading more articles...</div>
        )}
        
        {!hasMore && articles.length > 0 && (
          <div className="end-state">You're all caught up!</div>
        )}
      </main>
    </div>
  );
}
