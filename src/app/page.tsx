"use client"; // Mark as a Client Component

import { useState } from "react";
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

  const fetchDiffs = async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sample-diffs?page=${page}&per_page=10`
      );
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.details || errorMsg;
        } catch {
          // Ignore if response body is not JSON
          console.warn("Failed to parse error response as JSON");
        }
        throw new Error(errorMsg);
      }
      const data: ApiResponse = await response.json();

      setDiffs((prevDiffs) =>
        page === 1 ? data.diffs : [...prevDiffs, ...data.diffs]
      );
      setCurrentPage(data.currentPage);
      setNextPage(data.nextPage);
      if (!initialFetchDone) setInitialFetchDone(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const generateNotes = async (pr: DiffItem) => {
    try {
      setLoadingPR(pr.id);
      setGeneratedNotes(prev => ({ ...prev, [pr.id]: "" }));
      setExpandedPRs(prev => ({ ...prev, [pr.id]: true }));

      const res = await fetch("/api/generate-notes", {
        method: "POST",
        body: JSON.stringify({ title: pr.description, diff: pr.diff }),
      });

      if (!res.body) throw new Error("No stream received");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setGeneratedNotes(prev => ({
          ...prev,
          [pr.id]: prev[pr.id] + chunk
        }));
      }

      setLoadingPR(null);
    } catch (err) {
      console.error("Failed to generate notes", err);
      setGeneratedNotes(prev => ({
        ...prev,
        [pr.id]: "⚠️ Failed to generate notes. Please try again."
      }));
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

  return (
    <>
      {/* Starfield Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-800 to-black"></div>
        {/* Animated starfield */}
        <div className="absolute inset-0 opacity-60">
          {[...Array(150)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${Math.random() * 3 + 2}s`,
              }}
            />
          ))}
        </div>
        {/* Subtle cosmic glow */}
        <div className="absolute inset-0 bg-gradient-radial from-blue-900/20 via-transparent to-transparent"></div>
      </div>

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        {/* Enhanced Header */}
        <div className="text-center mb-16">
          <h1 className="text-7xl md:text-8xl font-black mb-4 tracking-tight">
            <span className="bg-gradient-to-b from-white via-blue-100 to-blue-300 bg-clip-text text-transparent drop-shadow-2xl">
              hire me plz
            </span>
          </h1>
          <div className="text-4xl md:text-5xl mb-6">
            <span className="text-blue-300/80 font-light">✨</span>
          </div>
          <p className="text-xl md:text-2xl text-blue-100/80 font-light max-w-2xl mx-auto leading-relaxed">
            Tejas Chakrapani's a0.dev submission
          </p>
        </div>

        <div className="w-full max-w-5xl mx-auto">
          {/* Enhanced Controls */}
          <div className="mb-12 flex justify-center">
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
                                  "🤖 Generate Notes"
                                )}
                              </span>
                            </button>
                          </div>
                        </div>

                        {(loadingPR === pr.id || (generatedNotes[pr.id] && expandedPRs[pr.id])) && (
                          <div className="mt-8 p-8 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-blue-500/20 shadow-inner">
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
