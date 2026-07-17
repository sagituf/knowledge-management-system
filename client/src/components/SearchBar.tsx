export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="search-bar"
      type="search"
      placeholder="Search knowledge… (e.g. black hair, document)"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
