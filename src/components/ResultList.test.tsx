import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Recommendation } from "../lib/recommender";
import { fixture } from "../test/fixtures";
import { ResultList } from "./ResultList";

const catalog = fixture();
const toy2 = catalog.movies[1]!;

const rec: Recommendation = {
  movie: toy2,
  score: 0.8,
  reasons: [{ seed: 0, strength: 0.8 }],
  kind: "collaborative",
};

describe("ResultList add button", () => {
  it("keeps the Add accessible name, shows an Added state when picked, and toggles from the keyboard", async () => {
    const user = userEvent.setup();
    const onTogglePick = vi.fn();
    const { rerender } = render(
      <ResultList
        catalog={catalog}
        recs={[rec]}
        picked={new Set()}
        onTogglePick={onTogglePick}
        onHide={vi.fn()}
      />,
    );
    const add = screen.getByRole("button", {
      name: "Add Toy Story 2 to my picks",
    });
    expect(add).toHaveAttribute("aria-pressed", "false");
    expect(add).toHaveTextContent("Add Toy Story 2 to my picks");
    expect(add).toHaveClass("pick-add");
    add.focus();
    await user.keyboard("{Enter}");
    expect(onTogglePick).toHaveBeenCalledWith(toy2.index);

    rerender(
      <ResultList
        catalog={catalog}
        recs={[rec]}
        picked={new Set([toy2.index])}
        onTogglePick={onTogglePick}
        onHide={vi.fn()}
      />,
    );
    const added = screen.getByRole("button", {
      name: "Add Toy Story 2 to my picks",
    });
    expect(added).toHaveAttribute("aria-pressed", "true");
    expect(added).toHaveTextContent("Added");
    added.focus();
    await user.keyboard(" ");
    expect(onTogglePick).toHaveBeenCalledTimes(2);
    expect(onTogglePick).toHaveBeenLastCalledWith(toy2.index);
  });
});

describe("ResultList hide buttons", () => {
  it("can hide a title for this session or persistently", async () => {
    const user = userEvent.setup();
    const onHide = vi.fn();
    render(
      <ResultList
        catalog={catalog}
        recs={[rec]}
        picked={new Set()}
        onTogglePick={vi.fn()}
        onHide={onHide}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Hide Toy Story 2 this session" }),
    );
    expect(onHide).toHaveBeenCalledWith(toy2.index, false);
    await user.click(
      screen.getByRole("button", { name: "Don't show Toy Story 2 again" }),
    );
    expect(onHide).toHaveBeenCalledWith(toy2.index, true);
  });
});
