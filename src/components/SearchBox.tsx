import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchMovies, type SearchIndex } from '../lib/search';
import type { Movie } from '../lib/types';

interface Props {
  index: SearchIndex;
  picked: ReadonlySet<number>;
  disabled?: boolean;
  onPick: (movie: Movie) => void;
}

/** ARIA 1.2 combobox with a listbox popup (editable, list autocomplete). */
export function SearchBox({ index, picked, disabled = false, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  const results = useMemo(() => searchMovies(index, query, { limit: 8, exclude: picked }), [index, query, picked]);
  const expanded = open && query.trim().length > 0;

  useEffect(() => setActive(0), [query]);

  const choose = (movie: Movie) => {
    onPick(movie);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (results.length === 0 ? 0 : (a + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (results.length === 0 ? 0 : (a - 1 + results.length) % results.length));
    } else if (e.key === 'Enter') {
      const choice = results[active];
      if (expanded && choice) {
        e.preventDefault();
        choose(choice);
      }
    } else if (e.key === 'Escape') {
      if (expanded) {
        e.preventDefault();
        setOpen(false);
      } else setQuery('');
    }
  };

  const activeId = expanded && results[active] ? `${baseId}-opt-${active}` : undefined;

  return (
    <div className="search">
      <label htmlFor={`${baseId}-input`} className="field-label">
        Search for a film you like
      </label>
      <input
        id={`${baseId}-input`}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        disabled={disabled}
        placeholder={disabled ? 'Loading catalogue…' : 'e.g. Heat, Parasite, Metropolis'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" aria-label="Matching films" hidden={!expanded} className="suggestions">
        {results.map((m, i) => (
          <li
            key={m.index}
            id={`${baseId}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            className={i === active ? 'option active' : 'option'}
            // mousedown fires before the input's blur closes the list.
            onMouseDown={(e) => {
              e.preventDefault();
              choose(m);
            }}
            onMouseEnter={() => setActive(i)}
          >
            <span className="option-title">{m.title}</span>
            <span className="option-year">{m.year}</span>
            {m.source === 'wikidata' && <span className="option-note">wider catalogue</span>}
          </li>
        ))}
      </ul>
      <p className="visually-hidden" role="status" aria-live="polite">
        {expanded ? (results.length === 0 ? 'No matching films' : `${results.length} suggestions available`) : ''}
      </p>
      {expanded && results.length === 0 && (
        <p className="hint" data-testid="no-matches">
          No films match “{query.trim()}”. Check the spelling, or try part of the title.
        </p>
      )}
    </div>
  );
}
