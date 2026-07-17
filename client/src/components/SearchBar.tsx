export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="search-bar"
      type="search"
      placeholder="Search knowledge… (e.g. black hair, document)"
      aria-label="Search assets"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
