import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { contentRaw, coreRaw } from './test/fixtures';
import type { Loaders } from './lib/useCatalog';

const loaders = (over: Partial<Loaders> = {}): Loaders => ({
  core: () => Promise.resolve(structuredClone(coreRaw)),
  content: () => Promise.resolve(structuredClone(contentRaw)),
  ...over,
});

async function setup(l: Loaders = loaders()) {
  const user = userEvent.setup();
  const view = render(<App loaders={l} />);
  const box = await screen.findByRole('combobox', { name: /Search for a film/ });
  await waitFor(() => expect(box).toBeEnabled());
  return { user, box, ...view };
}

async function pick(user: ReturnType<typeof userEvent.setup>, box: HTMLElement, query: string) {
  await user.clear(box);
  await user.type(box, query);
  const options = await screen.findAllByRole('option', { name: new RegExp(`^${query}`, 'i') });
  await user.click(options[0] as HTMLElement);
}

describe('App', () => {
  it('shows the empty state and example picks before anything is chosen', async () => {
    await setup();
    expect(screen.getByTestId('empty-picks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Heat' })).toBeInTheDocument();
  });

  it('does not crash when typing before clicking anything (old bug)', async () => {
    const { user, box } = await setup();
    await user.type(box, 'zzzz');
    expect(screen.getByTestId('no-matches')).toBeInTheDocument();
    await user.keyboard('{Enter}{ArrowDown}{ArrowUp}{Escape}');
    expect(screen.getByTestId('empty-picks')).toBeInTheDocument();
  });

  it('treats regex characters as plain text (old bug)', async () => {
    const { user, box } = await setup();
    for (const q of ['(', '[', '.*', '\\']) {
      await user.clear(box);
      await user.click(box);
      await user.paste(q);
      expect(document.querySelectorAll('.suggestions .option')).toHaveLength(0);
    }
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('picks a film and explains why Toy Story 2 is recommended', async () => {
    const { user, box } = await setup();
    await pick(user, box, 'Toy Story');
    expect(screen.getByRole('list', { name: /Your picks/ })).toHaveTextContent('Toy Story (1995)');
    const card = (await screen.findByRole('heading', { name: /Toy Story 2/ })).closest('li');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText(/Because you liked Toy Story\./)).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText('Viewer ratings')).toBeInTheDocument();
  });

  it('combines several picks and marks content-based results as such', async () => {
    const { user, box } = await setup();
    await pick(user, box, 'Heat');
    await pick(user, box, 'Se7en');
    expect(screen.getByRole('heading', { name: /From viewer ratings/ })).toBeInTheDocument();
    const content = await screen.findByRole('heading', { name: /content-based/i, level: 3 });
    const section = content.closest('section') as HTMLElement;
    expect(within(section).getByRole('heading', { name: /Ronin/ })).toBeInTheDocument();
    expect(within(section).getAllByText('Content-based').length).toBeGreaterThan(0);
    expect(within(section).getByText(/not viewer ratings/)).toBeInTheDocument();
  });

  it('removing a pick updates the list; clear all empties it', async () => {
    const { user, box } = await setup();
    await pick(user, box, 'Heat');
    await pick(user, box, 'Se7en');
    await user.click(screen.getByRole('button', { name: 'Remove Heat' }));
    expect(screen.getByRole('list', { name: /Your picks/ })).not.toHaveTextContent('Heat');
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByTestId('empty-picks')).toBeInTheDocument();
  });

  it('genre chips filter results and report an empty result politely', async () => {
    const { user, box } = await setup();
    await pick(user, box, 'Toy Story');
    const horror = screen.getByRole('button', { name: 'Horror' });
    await user.click(horror);
    expect(horror).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('no-results')).toBeInTheDocument();
    await user.click(horror);
    expect(horror).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByRole('heading', { name: /Toy Story 2/ })).toBeInTheDocument();
  });

  it('decade filter lists decades from the catalogue, including the silent era', async () => {
    await setup();
    const options = within(screen.getByLabelText('Decade')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('1920s');
    expect(options).toContain('2020s');
  });

  it('keyboard: ArrowDown + Enter selects the highlighted suggestion', async () => {
    const { user, box } = await setup();
    await user.type(box, 'toy');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('list', { name: /Your picks/ })).toHaveTextContent('Toy Story 2');
  });

  it('IMDb links go out by id and attribution is in the footer', async () => {
    const { user, box } = await setup();
    await pick(user, box, 'Toy Story');
    const link = (await screen.findAllByRole('link', { name: /Toy Story 2 on IMDb/ }))[0] as HTMLAnchorElement;
    expect(link.href).toBe('https://www.imdb.com/title/tt0120363/');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('Information courtesy of');
    expect(footer).toHaveTextContent('Used with permission');
    expect(footer).toHaveTextContent('not endorsed by GroupLens');
    expect(footer).toHaveTextContent('Harper');
    expect(footer).toHaveTextContent('CC0');
  });

  it('shows a retryable error when the data is invalid or fails to load', async () => {
    const core = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(structuredClone(coreRaw));
    const user = userEvent.setup();
    render(<App loaders={loaders({ core })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Search for a film/ })).toBeEnabled());
  });

  it('rejects malformed data via validation', async () => {
    render(<App loaders={loaders({ core: () => Promise.resolve({ v: 1 }) })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid core data/);
  });

  it('still works with MovieLens films only when the content layer fails', async () => {
    const { user, box } = await setup(loaders({ content: () => Promise.reject(new Error('404')) }));
    await waitFor(() => expect(screen.getByText(/only the MovieLens films are available/)).toBeInTheDocument());
    await pick(user, box, 'Toy Story');
    expect(await screen.findByRole('heading', { name: /Toy Story 2/ })).toBeInTheDocument();
  });

  it('switches theme and persists it', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('radio', { name: 'High contrast' }));
    expect(document.documentElement.dataset.theme).toBe('contrast');
    expect(window.localStorage.getItem('movie-recommender-theme')).toBe('contrast');
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('accessibility (axe in jsdom; colour contrast is checked separately and in the browser run)', () => {
  async function violations(container: HTMLElement) {
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`);
  }

  it('has no violations on the initial page', async () => {
    const { container } = await setup();
    expect(await violations(container)).toEqual([]);
  });

  it('has no violations with picks, results and an open suggestion list', async () => {
    const { user, box, container } = await setup();
    await pick(user, box, 'Heat');
    await pick(user, box, 'Se7en');
    await user.click(screen.getByRole('button', { name: 'Thriller' }));
    await user.type(box, 'toy');
    expect(await violations(container)).toEqual([]);
  });
});
