"use client";
interface FilterBarProps { activeFilter: 'All' | 'Safira' | 'Destan'; setFilter: (filter: 'All' | 'Safira' | 'Destan') => void; }
export default function FilterBar({ activeFilter, setFilter }: FilterBarProps) {
  const filters = [{ id: 'All', label: 'Genel Bakış' }, { id: 'Safira', label: 'Safira' }, { id: 'Destan', label: 'Destan' }] as const;
  return <div className="grid grid-cols-3 gap-2 mb-5 bg-gray-800/40 p-1.5 rounded-2xl border border-white/5">
    {filters.map(f => <button key={f.id} onClick={() => setFilter(f.id)} className={`p-3 rounded-xl text-[11px] md:text-sm font-bold transition-all ${activeFilter === f.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5'}`}>{f.label}</button>)}
  </div>;
}
