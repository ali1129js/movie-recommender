import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  // The app mirrors picks and filters into the query string; start every test from a clean URL.
  window.history.replaceState(null, "", "/");
  window.localStorage.removeItem("movie-recommender.v1.picks");
  window.localStorage.removeItem("movie-recommender.v1.hidden");
  window.localStorage.removeItem("movie-recommender-theme");
  window.localStorage.removeItem("movie-recommender-motion");
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-motion");
});

// jsdom lacks a few browser APIs the app touches.
if (typeof window !== "undefined") {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView ??= () => undefined;
}
