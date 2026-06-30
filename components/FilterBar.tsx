"use client";

interface FilterBarProps {
    activeFilter: 'All' | 'Safira' | 'Destan';
    setFilter: (filter: 'All' | 'Safira' | 'Destan') => void;
}

export default function FilterBar({ activeFilter, setFilter }: FilterBarProps) {
    const filters = [
        { id: 'All', label: 'TÜM BİRİMLER' },
        { id: 'Safira', label: 'SAFİRA' },
        { id: 'Destan', label: 'DESTAN' }
    ] as const;

    return (
        <div className="flex gap-2 mb-4 bg-gray-800/50 p-1 rounded-xl border border-white/5">
            {filters.map((f) => (
                <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`flex-1 p-2 rounded-lg text-[10px] font-bold transition-all uppercase tracking-widest ${
                        activeFilter === f.id
                            ? "bg-white/10 text-white"
                            : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
}
