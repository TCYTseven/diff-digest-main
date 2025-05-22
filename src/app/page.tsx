"use client"; // Mark as a Client Component

import { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';

// Define the expected structure of a diff object
interface DiffItem {
  id: string;
  description: string;
  diff: string;
  url: string; // Added URL field
}

// Define the expected structure of the API response
interface ApiResponse {
  diffs: DiffItem[];
  nextPage: number | null;
  currentPage: number;
  perPage: number;
}

// State persistence keys
const STORAGE_KEYS = {
  DIFFS: 'diff-digest-diffs',
  GENERATED_NOTES: 'diff-digest-notes',
  EXPANDED_PRS: 'diff-digest-expanded',
  PAGINATION: 'diff-digest-pagination',
  INTERRUPTED_STREAMS: 'diff-digest-interrupted-streams'
} as const;

// Helper functions for localStorage with error handling
const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }
};

const loadFromStorage = <T extends any>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      return JSON.parse(item) as T;
    }
  } catch (err) {
    console.warn('Failed to load from localStorage:', err);
  }
  return defaultValue;
};

export default function Home() {
  const [diffs, setDiffs] = useState<DiffItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [initialFetchDone, setInitialFetchDone] = useState<boolean>(false);
  const [loadingPR, setLoadingPR] = useState<string | null>(null);
  const [generatedNotes, setGeneratedNotes] = useState<Record<string, string>>({});
  const [expandedPRs, setExpandedPRs] = useState<Record<string, boolean>>({});
  const [interruptedStreams, setInterruptedStreams] = useState<Record<string, string>>({});
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Hydrate state from localStorage on mount
  useEffect(() => {
    // First set hydrated to true to match server/client initial state
    setIsHydrated(true);
    
    // Then load from localStorage in the next tick to avoid hydration mismatch
    const loadStoredData = () => {
      if (typeof window !== 'undefined') {
        const storedDiffs = loadFromStorage(STORAGE_KEYS.DIFFS, []);
        const storedNotes = loadFromStorage(STORAGE_KEYS.GENERATED_NOTES, {});
        const storedExpanded = loadFromStorage(STORAGE_KEYS.EXPANDED_PRS, {});
        const storedInterrupted = loadFromStorage(STORAGE_KEYS.INTERRUPTED_STREAMS, {});
        const pagination = loadFromStorage(STORAGE_KEYS.PAGINATION, { currentPage: 1, nextPage: null, initialFetchDone: false });
        
        // Only update if we actually have stored data to prevent unnecessary re-renders
        if (storedDiffs.length > 0) setDiffs(storedDiffs);
        if (Object.keys(storedNotes).length > 0) setGeneratedNotes(storedNotes);
        if (Object.keys(storedExpanded).length > 0) setExpandedPRs(storedExpanded);
        if (Object.keys(storedInterrupted).length > 0) setInterruptedStreams(storedInterrupted);
        
        if (pagination.currentPage !== 1 || pagination.nextPage !== null || pagination.initialFetchDone) {
          setCurrentPage(pagination.currentPage);
          setNextPage(pagination.nextPage);
          setInitialFetchDone(pagination.initialFetchDone);
        }
      }
    };
    
    // Use setTimeout to ensure this runs after hydration
    const timeoutId = setTimeout(loadStoredData, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (isHydrated) {
      saveToStorage(STORAGE_KEYS.DIFFS, diffs);
    }
  }, [isHydrated, diffs]);

  useEffect(() => {
    if (isHydrated) {
      saveToStorage(STORAGE_KEYS.GENERATED_NOTES, generatedNotes);
    }
  }, [isHydrated, generatedNotes]);

  useEffect(() => {
    if (isHydrated) {
      saveToStorage(STORAGE_KEYS.EXPANDED_PRS, expandedPRs);
    }
  }, [isHydrated, expandedPRs]);

  useEffect(() => {
    if (isHydrated) {
      saveToStorage(STORAGE_KEYS.PAGINATION, {
        currentPage,
        nextPage,
        initialFetchDone
      });
    }
  }, [isHydrated, currentPage, nextPage, initialFetchDone]);

  useEffect(() => {
    if (isHydrated) {
      saveToStorage(STORAGE_KEYS.INTERRUPTED_STREAMS, interruptedStreams);
    }
  }, [isHydrated, interruptedStreams]);

  const fetchDiffs = async (page: number) => {
    setIsLoading(true);
    setError(null);
    
    // Add timeout for network requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    try {
      const response = await fetch(
        `/api/sample-diffs?page=${page}&per_page=10`,
        { 
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        
        // Handle specific HTTP status codes
        if (response.status === 429) {
          errorMsg = "Too many requests. Please wait a moment and try again.";
        } else if (response.status >= 500) {
          errorMsg = "Server error. Please try again later.";
        } else if (response.status === 404) {
          errorMsg = "API endpoint not found.";
        }
        
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.details || errorMsg;
        } catch {
          // Ignore if response body is not JSON
          console.warn("Failed to parse error response as JSON");
        }
        throw new Error(errorMsg);
      }
      
      // Validate response content type
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Invalid response format. Expected JSON.');
      }
      
      const data: ApiResponse = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response data structure.');
      }
      
      if (!Array.isArray(data.diffs)) {
        throw new Error('Invalid diffs data. Expected an array.');
      }
      
      // Validate individual diff items
      const validDiffs = data.diffs.filter((diff: any) => 
        diff && 
        typeof diff.id === 'string' && 
        typeof diff.description === 'string' && 
        typeof diff.diff === 'string' && 
        typeof diff.url === 'string'
      );
      
      if (validDiffs.length !== data.diffs.length) {
        console.warn(`Filtered out ${data.diffs.length - validDiffs.length} invalid diff items`);
      }

      setDiffs((prevDiffs) =>
        page === 1 ? validDiffs : [...prevDiffs, ...validDiffs]
      );
      setCurrentPage(data.currentPage || page);
      setNextPage(data.nextPage || null);
      if (!initialFetchDone) setInitialFetchDone(true);
      
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError("Request timed out. Please check your connection and try again.");
        } else if (err.message.includes('Failed to fetch')) {
          setError("Network error. Please check your internet connection.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      
      console.error('Fetch diffs error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNotes = async (pr: DiffItem, isResume: boolean = false) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for AI generation
    
    try {
      setLoadingPR(pr.id);
      
      // If resuming, keep existing content; otherwise start fresh
      if (!isResume) {
        setGeneratedNotes(prev => ({ ...prev, [pr.id]: "" }));
      }
      setExpandedPRs(prev => ({ ...prev, [pr.id]: true }));
      
      // Clear any interrupted stream markers
      setInterruptedStreams(prev => {
        const newState = { ...prev };
        delete newState[pr.id];
        return newState;
      });

      // Validate input data
      if (!pr.description?.trim() || !pr.diff?.trim()) {
        throw new Error("Invalid PR data: missing description or diff content");
      }

      const res = await fetch("/api/generate-notes", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: pr.description.trim(), 
          diff: pr.diff.trim() 
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorMsg = `HTTP error! status: ${res.status}`;
        
        // Handle specific HTTP status codes
        if (res.status === 429) {
          errorMsg = "Too many requests. Please wait before generating more notes.";
        } else if (res.status >= 500) {
          errorMsg = "Server error while generating notes. Please try again.";
        } else if (res.status === 413) {
          errorMsg = "Diff content too large. Please try with a smaller diff.";
        }
        
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch {
          // Response body might not be JSON for streaming endpoints
        }
        
        throw new Error(errorMsg);
      }

      // Validate response has a body for streaming
      if (!res.body) {
        throw new Error("No response stream received from server");
      }

      // Check if the response is actually a stream
      const contentType = res.headers.get('content-type');
      if (!contentType?.includes('text/plain') && !contentType?.includes('application/octet-stream')) {
        console.warn('Unexpected content type for streaming response:', contentType);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedContent = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;
          
          setGeneratedNotes(prev => ({
            ...prev,
            [pr.id]: prev[pr.id] + chunk
          }));
        }
      } catch (streamErr) {
        console.error("Stream reading error:", streamErr);
        throw new Error("Failed to read response stream");
      } finally {
        reader.releaseLock();
      }

      // Validate we received some content
      if (!accumulatedContent.trim()) {
        throw new Error("Received empty response from AI service");
      }

      setLoadingPR(null);
      
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Failed to generate notes", err);
      
      let errorMessage = "⚠️ Failed to generate notes. Please try again.";
      let isInterrupted = false;
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = "⏱️ Request timed out. The diff might be too large or the server is busy.";
          isInterrupted = true;
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = "🌐 Network error. Please check your connection and try again.";
          isInterrupted = true;
        } else if (err.message.includes('Invalid PR data')) {
          errorMessage = "⚠️ Invalid data. This PR might be missing content.";
        } else if (err.message.length > 0) {
          errorMessage = `⚠️ ${err.message}`;
        }
      }
      
      // If this was an interruption and we have partial content, mark it as resumable
      const currentContent = generatedNotes[pr.id] || "";
      if (isInterrupted && currentContent.trim()) {
        setInterruptedStreams(prev => ({
          ...prev,
          [pr.id]: "Stream was interrupted. You can resume generation."
        }));
        // Don't overwrite existing content, just stop loading
      } else {
        setGeneratedNotes(prev => ({
          ...prev,
          [pr.id]: errorMessage
        }));
      }
      
      setLoadingPR(null);
    }
  };

  const toggleNotes = (prId: string) => {
    setExpandedPRs(prev => ({
      ...prev,
      [prId]: !prev[prId]
    }));
  };

  const handleFetchClick = () => {
    setDiffs([]); // Clear existing diffs when fetching the first page again
    fetchDiffs(1);
  };

  const handleLoadMoreClick = () => {
    if (nextPage) {
      fetchDiffs(nextPage);
    }
  };

  const clearStoredData = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn('Failed to clear localStorage item:', key, err);
      }
    });
    
    // Reset state
    setDiffs([]);
    setGeneratedNotes({});
    setExpandedPRs({});
    setInterruptedStreams({});
    setCurrentPage(1);
    setNextPage(null);
    setInitialFetchDone(false);
  };

  const resumeGeneration = (pr: DiffItem) => {
    generateNotes(pr, true);
  };

  return (
    <>
      {/* Starfield Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-800 to-black"></div>
        {/* Animated starfield */}
        <div className="absolute inset-0 opacity-60">
          {isHydrated && [...Array(150)].map((_, i) => {
            // Use index-based seeded randomization to ensure consistent positioning
            const seed = i * 12345;
            const random1 = ((seed * 9301 + 49297) % 233280) / 233280;
            const random2 = (((seed + 1) * 9301 + 49297) % 233280) / 233280;
            const random3 = (((seed + 2) * 9301 + 49297) % 233280) / 233280;
            const random4 = (((seed + 3) * 9301 + 49297) % 233280) / 233280;
            const random5 = (((seed + 4) * 9301 + 49297) % 233280) / 233280;
            
            return (
              <div
                key={i}
                className="absolute bg-white rounded-full animate-pulse"
                style={{
                  left: `${random1 * 100}%`,
                  top: `${random2 * 100}%`,
                  width: `${random3 * 3 + 1}px`,
                  height: `${random3 * 3 + 1}px`,
                  animationDelay: `${random4 * 3}s`,
                  animationDuration: `${random5 * 3 + 2}s`,
                }}
              />
            );
          })}
        </div>
        {/* Subtle cosmic glow */}
        <div className="absolute inset-0 bg-gradient-radial from-blue-900/20 via-transparent to-transparent"></div>
      </div>

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        {/* Enhanced Header */}
        <div className="text-center mb-16">
          <h1 className="text-7xl md:text-8xl font-black mb-4 tracking-tight">
            <span className="bg-gradient-to-b from-white via-blue-100 to-blue-300 bg-clip-text text-transparent drop-shadow-2xl">
              Tejas Chakrapani 
            </span>
          </h1>
          <div className="text-4xl md:text-5xl mb-6">
            <span className="text-blue-300/80 font-light">✨</span>
          </div>
          <p className="text-xl md:text-2xl text-blue-100/80 font-light max-w-2xl mx-auto leading-relaxed">
            a very cool a0.dev submission for an internship
          </p>
        </div>

        <div className="w-full max-w-5xl mx-auto">
          {/* Enhanced Controls */}
          <div className="mb-12 flex justify-center gap-4">
            <button
              className="group relative px-10 py-4 bg-white text-black rounded-full shadow-2xl hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 text-lg font-bold tracking-wide overflow-hidden focus:outline-none focus:ring-4 focus:ring-blue-400/50"
              onClick={handleFetchClick}
              disabled={isLoading}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative">
                {isLoading && currentPage === 1 ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⭐</span>
                    Fetching...
                  </>
                ) : (
                  "✨ Fetch Latest Diffs"
                )}
              </span>
            </button>
            
            {isHydrated && (diffs.length > 0 || Object.keys(generatedNotes).length > 0) && (
              <button
                className="group relative px-6 py-4 bg-transparent border border-red-400/40 text-red-200 rounded-full hover:bg-red-500/20 hover:border-red-400/60 transition-all duration-300 font-medium shadow-lg backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-red-400/50"
                onClick={clearStoredData}
                title="Clear all stored data and start fresh"
              >
                <span className="flex items-center gap-2">
                  🗑️ Clear All Data
                </span>
              </button>
            )}
          </div>

          {/* Enhanced Results Container */}
          <div className="border border-blue-400/20 rounded-3xl p-8 min-h-[400px] bg-white/5 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            {/* Subtle inner glow */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10 pointer-events-none"></div>
            
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-8 text-center">
                <span className="bg-gradient-to-r from-blue-200 via-blue-100 to-white bg-clip-text text-transparent">
                  Merged Pull Requests
                </span>
              </h2>

              {error && (
                <div className="text-red-300 bg-red-900/40 backdrop-blur-sm border border-red-500/30 p-4 rounded-2xl mb-6 text-center font-medium shadow-lg">
                  <span className="text-red-400 text-xl mr-2">⚠️</span>
                  Error: {error}
                </div>
              )}

              {!initialFetchDone && !isLoading && (
                <div className="text-center py-16">
                  <div className="text-6xl mb-6 opacity-60">🚀</div>
                  <p className="text-blue-100/80 text-xl font-light leading-relaxed max-w-md mx-auto">
                    Ready to explore? Click the button above to fetch the latest merged pull requests
                  </p>
                </div>
              )}

              {initialFetchDone && diffs.length === 0 && !isLoading && !error && (
                <div className="text-center py-16">
                  <div className="text-6xl mb-6 opacity-60">🔍</div>
                  <p className="text-blue-100/80 text-xl font-light">
                    No merged pull requests found
                  </p>
                </div>
              )}

              {diffs.length > 0 && (
                <div className="space-y-8">
                  {diffs.map((pr, index) => (
                    <div key={pr.id} className="group relative">
                      {/* Card glow effect */}
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      
                      <div className="relative border border-blue-400/20 rounded-3xl p-8 bg-white/10 backdrop-blur-md shadow-xl hover:bg-white/15 transition-all duration-300">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <a
                                href={pr.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors font-bold text-xl group/link"
                              >
                                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                  PR #{pr.id}
                                </span>
                                <span className="text-blue-400 group-hover/link:translate-x-1 transition-transform">→</span>
                              </a>
                            </div>
                            <p className="text-white text-lg font-medium leading-relaxed">
                              {pr.description}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {generatedNotes[pr.id] && (
                              <button
                                onClick={() => toggleNotes(pr.id)}
                                className="px-6 py-3 bg-transparent border border-blue-400/40 text-blue-200 rounded-full hover:bg-blue-500/20 hover:border-blue-400/60 transition-all duration-300 font-medium shadow-lg backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                              >
                                {expandedPRs[pr.id] ? "Hide Notes 📖" : "Show Notes 📖"}
                              </button>
                            )}
                            
                            {interruptedStreams[pr.id] && (
                              <button 
                                onClick={() => resumeGeneration(pr)}
                                className="group/btn relative px-6 py-3 bg-orange-500/80 text-white rounded-full shadow-xl hover:bg-orange-500 transition-all duration-300 disabled:opacity-50 font-bold overflow-hidden focus:outline-none focus:ring-2 focus:ring-orange-400/50"
                                disabled={loadingPR === pr.id}
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                                <span className="relative">
                                  🔄 Resume
                                </span>
                              </button>
                            )}
                            
                            <button 
                              onClick={() => generateNotes(pr)}
                              className="group/btn relative px-8 py-3 bg-white text-black rounded-full shadow-xl hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 font-bold overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                              disabled={loadingPR === pr.id}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-white opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                              <span className="relative">
                                {loadingPR === pr.id ? (
                                  <>
                                    <span className="inline-block animate-spin mr-2">🤖</span>
                                    Generating...
                                  </>
                                ) : (
                                  interruptedStreams[pr.id] ? "🔄 Restart" : "🤖 Generate Notes"
                                )}
                              </span>
                            </button>
                          </div>
                        </div>

                        {(loadingPR === pr.id || (generatedNotes[pr.id] && expandedPRs[pr.id]) || interruptedStreams[pr.id]) && (
                          <div className="mt-8 p-8 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-blue-500/20 shadow-inner">
                            {interruptedStreams[pr.id] && (
                              <div className="mb-4 p-4 bg-orange-900/40 border border-orange-500/30 rounded-xl">
                                <div className="flex items-center gap-2 text-orange-300">
                                  <span className="text-xl">⚠️</span>
                                  <span className="font-medium">{interruptedStreams[pr.id]}</span>
                                </div>
                              </div>
                            )}
                            <div className="prose dark:prose-invert max-w-none prose-headings:text-blue-200 prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-blue-100/90 prose-p:leading-relaxed prose-ul:pl-6 prose-li:text-blue-100/90 prose-strong:text-white prose-code:text-blue-300 prose-code:bg-blue-900/30 prose-code:px-2 prose-code:py-1 prose-code:rounded">
                              <ReactMarkdown
                                components={{
                                  h1: ({ node, ...props }) => (
                                    <h1 className="text-2xl font-bold mt-8 mb-4 text-blue-200 border-b border-blue-500/30 pb-2" {...props} />
                                  ),
                                  h2: ({ node, ...props }) => (
                                    <h2 className="text-xl font-bold mt-6 mb-3 text-blue-200" {...props} />
                                  ),
                                  h3: ({ node, ...props }) => (
                                    <h3 className="text-lg font-semibold mt-4 mb-2 text-blue-300" {...props} />
                                  ),
                                  ul: ({ node, ...props }) => (
                                    <ul className="list-disc pl-6 space-y-2 my-4" {...props} />
                                  ),
                                  li: ({ node, ...props }) => (
                                    <li className="text-blue-100/90 leading-relaxed" {...props} />
                                  ),
                                  p: ({ node, ...props }) => (
                                    <p className="text-blue-100/90 leading-relaxed mb-4" {...props} />
                                  ),
                                  code: ({ node, className, children, ...props }: any) => {
                                    const isInline = !className?.includes('language-');
                                    return isInline ? (
                                      <code className="text-blue-300 bg-blue-900/30 px-2 py-1 rounded text-sm" {...props}>
                                        {children}
                                      </code>
                                    ) : (
                                      <code className="block text-blue-300 bg-blue-900/30 p-4 rounded-lg text-sm overflow-x-auto" {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                }}
                              >
                                {generatedNotes[pr.id] || ""}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isLoading && currentPage > 1 && (
                <div className="text-center mt-8">
                  <p className="text-blue-100/80 text-lg font-light">
                    <span className="inline-block animate-spin mr-2">⭐</span>
                    Loading more incredible diffs...
                  </p>
                </div>
              )}

              {nextPage && !isLoading && (
                <div className="mt-12 flex justify-center">
                  <button
                    className="group relative px-10 py-4 bg-transparent border border-blue-400/40 text-blue-200 rounded-full hover:bg-blue-500/20 hover:border-blue-400/60 transition-all duration-300 disabled:opacity-50 font-bold shadow-xl backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                    onClick={handleLoadMoreClick}
                    disabled={isLoading}
                  >
                    <span className="flex items-center gap-2">
                      Load More Magic ✨
                      <span className="text-blue-400/60 font-normal">(Page {nextPage})</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subtle footer */}
        <div className="mt-16 text-center">
          <p className="text-blue-300/40 text-sm font-light">
            made with ⭐ by tejas
          </p>
        </div>
      </main>
    </>
  );
}
