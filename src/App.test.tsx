import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { HIDDEN_KEY, readHiddenIds } from "./lib/hideStore";
import { PICKS_KEY, readStoredPicks, writeStoredPicks } from "./lib/pickStore";
import { contentRaw, coreRaw } from "./test/fixtures";
import type { Loaders } from "./lib/useCatalog";

const loaders = (over: Partial<Loaders> = {}): Loaders => ({
  core: () => Promise.resolve(structuredClone(coreRaw)),
  content: () => Promise.resolve(structuredClone(contentRaw)),
  ...over,
});

async function setup(l: Loaders = loaders()) {
  const user = userEvent.setup();
  const view = render(<App loaders={l} />);
  const box = await screen.findByRole("combobox", {
    name: /Search for a film/,
  });
  await waitFor(() => expect(box).toBeEnabled());
  return { user, box, ...view };
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  box: HTMLElement,
  query: string,
) {
  await user.clear(box);
  await user.type(box, query);
  const options = await screen.findAllByRole("option", {
    name: new RegExp(`^${query}`, "i"),
  });
  await user.click(options[0] as HTMLElement);
}

describe("App", () => {
  it("shows the empty state and example picks before anything is chosen", async () => {
    await setup();
    expect(screen.getByTestId("empty-picks")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heat" })).toBeInTheDocument();
  });

  it("does not crash when typing before clicking anything (old bug)", async () => {
    const { user, box } = await setup();
    await user.type(box, "zzzz");
    expect(screen.getByTestId("no-matches")).toBeInTheDocument();
    await user.keyboard("{Enter}{ArrowDown}{ArrowUp}{Escape}");
    expect(screen.getByTestId("empty-picks")).toBeInTheDocument();
  });

  it("treats regex characters as plain text (old bug)", async () => {
    const { user, box } = await setup();
    for (const q of ["(", "[", ".*", "\\"]) {
      await user.clear(box);
      await user.click(box);
      await user.paste(q);
      expect(document.querySelectorAll(".suggestions .option")).toHaveLength(0);
    }
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("picks a film and explains why Toy Story 2 is recommended", async () => {
    const { user, box } = await setup();
    await pick(user, box, "Toy Story");
    expect(screen.getByRole("list", { name: /Your picks/ })).toHaveTextContent(
      "Toy Story (1995)",
    );
    const card = (
      await screen.findByRole("heading", { name: /Toy Story 2/ })
    ).closest("li");
    expect(card).not.toBeNull();
    expect(
      within(card as HTMLElement).getByText(/Because you liked Toy Story\./),
    ).toBeInTheDocument();
    expect(
      within(card as HTMLElement).getByText("Viewer ratings"),
    ).toBeInTheDocument();
  });

  it("combines several picks and marks content-based results as such", async () => {
    const { user, box } = await setup();
    await pick(user, box, "Heat");
    await pick(user, box, "Se7en");
    expect(
      screen.getByRole("heading", { name: /From viewer ratings/ }),
    ).toBeInTheDocument();
    const content = await screen.findByRole("heading", {
      name: /content-based/i,
      level: 3,
    });
    const section = content.closest("section") as HTMLElement;
    expect(
      within(section).getByRole("heading", { name: /Ronin/ }),
    ).toBeInTheDocument();
    expect(
      within(section).getAllByText("Content-based").length,
    ).toBeGreaterThan(0);
    expect(within(section).getByText(/not viewer ratings/)).toBeInTheDocument();
    expect(section).toHaveAttribute("data-kind", "content");
    expect(
      document.querySelector(
        "section.results-section[data-kind='collaborative']",
      ),
    ).not.toBeNull();
    expect(
      document.querySelectorAll("li.card[data-kind='collaborative']").length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelectorAll("li.card[data-kind='content']").length,
    ).toBeGreaterThan(0);
    for (const card of document.querySelectorAll(
      "li.card[data-kind='collaborative']",
    )) {
      expect(card).toHaveTextContent("Viewer ratings");
    }
    for (const card of document.querySelectorAll(
      "li.card[data-kind='content']",
    )) {
      expect(card).toHaveTextContent("Content-based");
    }
  });

  it("adds a recommendation with a real button from the keyboard", async () => {
    const { user, box } = await setup();
    await pick(user, box, "Toy Story");
    const add = await screen.findByRole("button", {
      name: "Add Toy Story 2 to my picks",
    });
    expect(add).toHaveAttribute("aria-pressed", "false");
    expect(add).toHaveTextContent("Add Toy Story 2 to my picks");
    expect(add).toHaveClass("pick-add");
    expect(add).not.toHaveClass("link-button");
    add.focus();
    expect(add).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("list", { name: /Your picks/ })).toHaveTextContent(
      "Toy Story 2",
    );
    // Picks are excluded from the result lists, so the card (and its Added state) leaves the page.
    expect(
      screen.queryByRole("button", { name: "Add Toy Story 2 to my picks" }),
    ).not.toBeInTheDocument();
  });

  it("removing a pick updates the list; clear all empties it", async () => {
    const { user, box } = await setup();
    await pick(user, box, "Heat");
    await pick(user, box, "Se7en");
    await user.click(screen.getByRole("button", { name: "Remove Heat" }));
    expect(
      screen.getByRole("list", { name: /Your picks/ }),
    ).not.toHaveTextContent("Heat");
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByTestId("empty-picks")).toBeInTheDocument();
  });

  it("genre chips filter results and report an empty result politely", async () => {
    const { user, box } = await setup();
    await pick(user, box, "Toy Story");
    const horror = screen.getByRole("button", { name: "Horror" });
    await user.click(horror);
    expect(horror).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("no-results")).toBeInTheDocument();
    await user.click(horror);
    expect(horror).toHaveAttribute("aria-pressed", "false");
    expect(
      await screen.findByRole("heading", { name: /Toy Story 2/ }),
    ).toBeInTheDocument();
  });

  it("decade filter lists decades from the catalogue, including the silent era", async () => {
    await setup();
    const options = within(screen.getByLabelText("Decade"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toContain("1920s");
    expect(options).toContain("2020s");
  });

  it("keyboard: ArrowDown + Enter selects the highlighted suggestion", async () => {
    const { user, box } = await setup();
    await user.type(box, "toy");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByRole("list", { name: /Your picks/ })).toHaveTextContent(
      "Toy Story 2",
    );
  });

  it("IMDb links go out by id and attribution is in the footer", async () => {
    const { user, box } = await setup();
    await pick(user, box, "Toy Story");
    const link = (
      await screen.findAllByRole("link", { name: /Toy Story 2 on IMDb/ })
    )[0] as HTMLAnchorElement;
    expect(link.href).toBe("https://www.imdb.com/title/tt0120363/");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("Information courtesy of");
    expect(footer).toHaveTextContent("Used with permission");
    expect(footer).toHaveTextContent("not endorsed by GroupLens");
    expect(footer).toHaveTextContent("Harper");
    expect(footer).toHaveTextContent("CC0");
  });

  it("shows a retryable error when the data is invalid or fails to load", async () => {
    const core = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(structuredClone(coreRaw));
    const user = userEvent.setup();
    render(<App loaders={loaders({ core })} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: /Search for a film/ }),
      ).toBeEnabled(),
    );
  });

  it("rejects malformed data via validation", async () => {
    render(
      <App loaders={loaders({ core: () => Promise.resolve({ v: 1 }) })} />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Invalid core data/,
    );
  });

  it("still works with MovieLens films only when the content layer fails", async () => {
    const { user, box } = await setup(
      loaders({ content: () => Promise.reject(new Error("404")) }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/only the MovieLens films are available/),
      ).toBeInTheDocument(),
    );
    await pick(user, box, "Toy Story");
    expect(
      await screen.findByRole("heading", { name: /Toy Story 2/ }),
    ).toBeInTheDocument();
  });

  it("switches theme and persists it", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("radio", { name: "Midnight" }));
    expect(document.documentElement.dataset.theme).toBe("midnight");
    expect(window.localStorage.getItem("movie-recommender-theme")).toBe(
      "midnight",
    );
    await user.click(screen.getByRole("radio", { name: "Graphite" }));
    expect(document.documentElement.dataset.theme).toBe("graphite");
  });

  it("motion is static by default and can be turned on", async () => {
    const { user } = await setup();
    const toggle = screen.getByRole("button", { name: "Animated motion" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.motion).toBe("static");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.motion).toBe("animated");
    expect(window.localStorage.getItem("movie-recommender-motion")).toBe(
      "animated",
    );
  });
});

describe("shareable links (query string)", () => {
  const open = (search: string) =>
    window.history.replaceState(null, "", `/${search}`);
  const picksList = () => screen.getByRole("list", { name: /Your picks/ });

  it("writes picks and filters to the URL and a fresh load with that URL rebuilds the same recommendations", async () => {
    const { user, box, unmount } = await setup();
    await pick(user, box, "Heat");
    await pick(user, box, "Se7en");
    await user.click(screen.getByRole("button", { name: "Thriller" }));
    await user.click(screen.getByRole("radio", { name: /Hidden gems/ }));
    await user.selectOptions(screen.getByLabelText("Sort by"), "imdb");
    await waitFor(() =>
      expect(window.location.search).toBe(
        "?picks=tt0113277,tt0114369&genres=Thriller&mode=gems&sort=imdb",
      ),
    );
    const before = [...document.querySelectorAll("li.card h3")].map(
      (h) => h.textContent,
    );
    expect(before.length).toBeGreaterThan(0);
    const link = window.location.search;
    unmount();

    open(link);
    await setup();
    await waitFor(() => expect(picksList()).toHaveTextContent("Heat (1995)"));
    expect(picksList()).toHaveTextContent("Se7en (1995)");
    expect(screen.getByRole("button", { name: "Thriller" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("radio", { name: /Hidden gems/ })).toBeChecked();
    expect(screen.getByLabelText("Sort by")).toHaveValue("imdb");
    const after = [...document.querySelectorAll("li.card h3")].map(
      (h) => h.textContent,
    );
    expect(after).toEqual(before);
    expect(window.location.search).toBe(link);
  });

  it("restores a film that only exists in the lazy content layer once it has loaded", async () => {
    open("?picks=tt0122690");
    await setup();
    await waitFor(() => expect(picksList()).toHaveTextContent("Ronin (1998)"));
  });

  it("drops stale and malformed ids and bad filter values instead of crashing", async () => {
    open(
      "?picks=tt9999999,junk,tt0114709,tt0114709&genres=Nonsense,Comedy&decade=1890&mode=loud&sort=x&utm=keep",
    );
    await setup();
    await waitFor(() =>
      expect(picksList()).toHaveTextContent("Toy Story (1995)"),
    );
    expect(within(picksList()).getAllByRole("listitem")).toHaveLength(1);
    expect(
      await screen.findByRole("heading", { name: /Toy Story 2/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Decade")).toHaveValue("");
    await waitFor(() =>
      expect(window.location.search).toBe(
        "?utm=keep&picks=tt0114709&genres=Comedy",
      ),
    );
  });

  it("drops content-layer ids when the content layer fails, keeping the MovieLens ones", async () => {
    open("?picks=tt0122690,tt0113277");
    await setup(loaders({ content: () => Promise.reject(new Error("404")) }));
    await waitFor(() => expect(picksList()).toHaveTextContent("Heat (1995)"));
    expect(picksList()).not.toHaveTextContent("Ronin");
    await waitFor(() =>
      expect(window.location.search).toBe("?picks=tt0113277"),
    );
  });

  it("clearing everything leaves a clean URL", async () => {
    open("?picks=tt0113277");
    const { user } = await setup();
    await waitFor(() => expect(picksList()).toHaveTextContent("Heat"));
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(window.location.search).toBe(""));
  });
});

describe("remembered picks (localStorage)", () => {
  const open = (search: string) =>
    window.history.replaceState(null, "", `/${search}`);
  const picksList = () => screen.getByRole("list", { name: /Your picks/ });

  it("restores picks after a refresh, stays in sync with add and remove, and caps the stored list", async () => {
    const { user, box, unmount } = await setup();
    await pick(user, box, "Heat");
    await pick(user, box, "Se7en");
    await waitFor(() => expect(readStoredPicks()).toEqual([113277, 114369]));
    unmount();

    window.history.replaceState(null, "", "/");
    const again = await setup();
    await waitFor(() => expect(picksList()).toHaveTextContent("Heat (1995)"));
    expect(picksList()).toHaveTextContent("Se7en (1995)");

    await again.user.click(screen.getByRole("button", { name: "Remove Heat" }));
    await waitFor(() => expect(readStoredPicks()).toEqual([114369]));
    await again.user.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(readStoredPicks()).toEqual([]));
  });

  it("starts empty when the stored JSON is corrupt, without crashing", async () => {
    window.localStorage.setItem(PICKS_KEY, "{nope");
    await setup();
    expect(screen.getByTestId("empty-picks")).toBeInTheDocument();
    expect(readStoredPicks()).toEqual([]);
  });

  it("lets the URL win when both a shared link and a stored list are present", async () => {
    writeStoredPicks([114369]); // Se7en
    open("?picks=tt0113277"); // Heat
    await setup();
    await waitFor(() => expect(picksList()).toHaveTextContent("Heat (1995)"));
    expect(picksList()).not.toHaveTextContent("Se7en");
    await waitFor(() => expect(readStoredPicks()).toEqual([113277]));
    expect(window.location.search).toBe("?picks=tt0113277");
  });
});

describe("accessibility (axe in jsdom; colour contrast is checked separately and in the browser run)", () => {
  async function violations(container: HTMLElement) {
    const res = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    return res.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`,
    );
  }

  it("has no violations on the initial page", async () => {
    const { container } = await setup();
    expect(await violations(container)).toEqual([]);
  });

  it("has no violations with picks, results and an open suggestion list", async () => {
    const { user, box, container } = await setup();
    await pick(user, box, "Heat");
    await pick(user, box, "Se7en");
    await user.click(screen.getByRole("button", { name: "Thriller" }));
    await user.type(box, "toy");
    expect(await violations(container)).toEqual([]);
  });
});

describe("not interested hides", () => {
  it("hides a recommendation for this session, and persistently, and can clear them", async () => {
    const { user, box } = await setup();
    await pick(user, box, "Toy Story");
    const card = (
      await screen.findByRole("heading", { name: /Toy Story 2/ })
    ).closest("li") as HTMLElement;
    await user.click(
      within(card).getByRole("button", {
        name: "Hide Toy Story 2 this session",
      }),
    );
    expect(
      screen.queryByRole("heading", { name: /Toy Story 2/ }),
    ).not.toBeInTheDocument();
    expect(readHiddenIds()).toEqual([]);
    expect(
      screen.getByRole("heading", { name: /Hidden titles/ }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Show hidden titles again" }),
    );
    expect(
      screen.queryByRole("heading", { name: /Hidden titles/ }),
    ).not.toBeInTheDocument();
    const cardAgain = (
      await screen.findByRole("heading", { name: /Toy Story 2/ })
    ).closest("li") as HTMLElement;
    await user.click(
      within(cardAgain).getByRole("button", {
        name: "Don't show Toy Story 2 again",
      }),
    );
    expect(
      screen.queryByRole("heading", { name: /Toy Story 2/ }),
    ).not.toBeInTheDocument();
    expect(readHiddenIds()).toEqual([120363]);
  });

  it("does not let a seed hide itself, and survives an already-empty result set", async () => {
    window.localStorage.setItem(
      HIDDEN_KEY,
      JSON.stringify({
        // Hide every fixture film except Toy Story (114709)
        imdbIds: [
          120363, 113277, 114369, 133093, 999999, 17136, 122690, 1160419,
        ],
      }),
    );
    const { user, box } = await setup();
    await pick(user, box, "Toy Story");
    expect(screen.getByRole("list", { name: /Your picks/ })).toHaveTextContent(
      "Toy Story (1995)",
    );
    expect(screen.getByTestId("no-results")).toHaveTextContent(
      "Clear hidden titles or pick another film",
    );
    expect(
      screen.getByRole("button", { name: "Show hidden titles again" }),
    ).toBeInTheDocument();
  });
});
