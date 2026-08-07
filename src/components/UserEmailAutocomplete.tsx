import { useEffect, useRef, useState } from "react";

export interface KnownUser {
  email: string;
  full_name: string | null;
}

export function UserEmailAutocomplete({
  value,
  onChange,
  users,
  placeholder = "user@company.com",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  users: KnownUser[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const filtered = (
    query
      ? users.filter(
          (u) =>
            u.email.toLowerCase().includes(query) ||
            (u.full_name || "").toLowerCase().includes(query),
        )
      : users
  ).slice(0, 8);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="email"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full min-w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {filtered.map((u) => (
            <button
              key={u.email}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(u.email);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-gray-50"
            >
              <span className="text-sm text-gray-900">{u.email}</span>
              {u.full_name && (
                <span className="text-xs text-gray-400">{u.full_name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
