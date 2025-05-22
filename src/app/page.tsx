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
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <h1 className="text-5xl font-extrabold mb-10 text-center drop-shadow-lg bg-gradient-to-r from-blue-400 via-blue-200 to-white bg-clip-text text-transparent">
        Diff Digest <span className="font-semibold text-white/80">✍️</span>
      </h1>

      {/* Example Input Box (for future search/filter) */}
      <div className="w-full max-w-xl mb-10 flex flex-col items-center">
        <input
          type="text"
          placeholder="Search or filter pull requests..."
          className="w-full px-6 py-4 rounded-full bg-[#181e36]/80 text-white placeholder:text-blue-100/70 text-lg font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#0a1023] transition-all border border-blue-400/20 mb-2"
          disabled
        />
        <span className="text-blue-100 text-sm">(Example input styling — not functional)</span>
      </div>

      <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
        {/* Controls Section */}
        <div className="mb-8 flex space-x-4 justify-center">
          <button
            className="px-8 py-3 bg-white text-black rounded-full shadow-xl hover:bg-blue-50 transition-colors disabled:opacity-50 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#0a1023]"
            onClick={handleFetchClick}
            disabled={isLoading}
          >
            {isLoading && currentPage === 1
              ? "Fetching..."
              : "Fetch Latest Diffs"}
          </button>
        </div>

        {/* Results Section */}
        <div className="w-full border border-blue-500/30 rounded-3xl p-8 min-h-[300px] bg-white/10 shadow-2xl backdrop-blur-md">
          <h2 className="text-2xl font-bold mb-6 text-center text-blue-200 tracking-wide">Merged Pull Requests</h2>

          {error && (
            <div className="text-red-400 bg-red-900/30 p-3 rounded-xl mb-4 text-center font-medium">
              Error: {error}
            </div>
          )}

          {!initialFetchDone && !isLoading && (
            <p className="text-blue-100 text-center">
              Click the button above to fetch the latest merged pull requests from the repository.
            </p>
          )}

          {initialFetchDone && diffs.length === 0 && !isLoading && !error && (
            <p className="text-blue-100 text-center">
              No merged pull requests found or fetched.
            </p>
          )}

          {diffs.length > 0 && (
            <div className="space-y-6">
              {diffs.map((pr) => (
                <div key={pr.id} className="border border-blue-400/20 rounded-2xl p-6 bg-white/20 shadow-lg backdrop-blur-md">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-300 hover:underline font-bold text-lg"
                      >
                        PR #{pr.id}
                      </a>
                      <p className="mt-1 text-white/90 text-base font-medium">{pr.description}</p>
                    </div>
                    <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                      {generatedNotes[pr.id] && (
                        <button
                          onClick={() => toggleNotes(pr.id)}
                          className="px-4 py-2 text-base bg-transparent border border-blue-400/40 text-blue-200 rounded-full hover:bg-blue-900/30 transition-colors shadow focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#0a1023]"
                        >
                          {expandedPRs[pr.id] ? "Hide Notes" : "Show Notes"}
                        </button>
                      )}
                      <button 
                        onClick={() => generateNotes(pr)}
                        className="px-6 py-2 bg-white text-black rounded-full shadow-lg hover:bg-blue-50 transition-colors disabled:opacity-50 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#0a1023]"
                        disabled={loadingPR === pr.id}
                      >
                        {loadingPR === pr.id ? "Generating..." : "Generate Notes"}
                      </button>
                    </div>
                  </div>

                  {(loadingPR === pr.id || (generatedNotes[pr.id] && expandedPRs[pr.id])) && (
                    <div className="mt-6 p-6 bg-blue-950/60 rounded-xl shadow-inner overflow-x-auto">
                      <div className="prose dark:prose-invert max-w-none prose-h2:text-blue-300 prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-3 prose-ul:pl-6 prose-li:text-blue-100">
                        <ReactMarkdown
                          components={{
                            h2: ({ node, ...props }) => (
                              <h2 className="text-xl font-bold mt-6 mb-3 text-blue-300" {...props} />
                            ),
                            ul: ({ node, ...props }) => (
                              <ul className="list-disc pl-6 space-y-1 my-3" {...props} />
                            ),
                            li: ({ node, ...props }) => (
                              <li className="text-blue-100" {...props} />
                            ),
                          }}
                        >
                          {generatedNotes[pr.id] || ""}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isLoading && currentPage > 1 && (
            <p className="text-blue-100 mt-4 text-center">
              Loading more...
            </p>
          )}

          {nextPage && !isLoading && (
            <div className="mt-8 flex justify-center">
              <button
                className="px-8 py-2 bg-white text-black rounded-full shadow-lg hover:bg-blue-50 transition-colors disabled:opacity-50 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#0a1023]"
                onClick={handleLoadMoreClick}
                disabled={isLoading}
              >
                Load More (Page {nextPage})
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
