import React, { useState } from 'react';
import { Search, ShoppingBag, Music, Disc, Guitar, Sparkles, MessageSquare } from 'lucide-react';

interface MarketplaceItem {
  id: string;
  title: string;
  category: 'Beats' | 'Vocals' | 'Chords' | 'Lyrics';
  price: string;
  creator: string;
  genre: string;
}

const marketplaceItems: MarketplaceItem[] = [
  { id: 'm1', title: 'Midnight Chill (Guitar Lick)', category: 'Beats', price: '$19.99', creator: 'BeatsByAlex', genre: 'Lo-Fi' },
  { id: 'm2', title: 'Soulful Pop Vocals Session', category: 'Vocals', price: '$49.00/hr', creator: 'Elena_V', genre: 'Pop/R&B' },
  { id: 'm3', title: 'Grammy Trap 808 Loop Kit', category: 'Beats', price: '$24.99', creator: 'WaveMaker', genre: 'Trap' },
  { id: 'm4', title: 'Jazz Progression MIDI Files', category: 'Chords', price: '$9.99', creator: 'ChordsDirect', genre: 'Jazz' }
];

const MarketplaceView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<'All' | 'Beats' | 'Vocals' | 'Chords' | 'Lyrics'>('All');

  const filtered = marketplaceItems.filter(item => {
    const s = search.toLowerCase();
    const matchSearch = item.title.toLowerCase().includes(s) || item.creator.toLowerCase().includes(s);
    const matchCat = activeCat === 'All' || item.category === activeCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="w-full min-h-screen p-6 md:p-8 bg-[#030712] text-white text-left pb-20">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Marketplace</h1>
          <p className="text-sm text-gray-400 mt-1">Acquire top-tier vocal stems, backing beats, MIDI chord files, and professional co-writer leases.</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search beats, vocals, keys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/5 rounded-2xl text-sm focus:outline-none focus:border-pink-500/50 transition-colors placeholder:text-gray-500"
          />
        </div>

        {/* Cats */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {(['All', 'Beats', 'Vocals', 'Chords', 'Lyrics'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`px-4.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeCat === cat
                  ? 'bg-[#db2777] text-white shadow-lg'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Marketplace Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-6 bg-[#010208] border border-white/5 rounded-2xl flex flex-col justify-between gap-6 shadow-xl hover:border-pink-500/20 transition-all duration-300"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase font-bold text-pink-400 px-2 py-0.5 bg-pink-500/10 rounded-full border border-pink-500/10">
                    {item.category}
                  </span>
                  <span className="font-extrabold text-white text-lg">{item.price}</span>
                </div>
                <h3 className="font-bold text-white text-lg mt-4">{item.title}</h3>
                <p className="text-xs text-gray-400 mt-1">Creator: {item.creator} • {item.genre}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => alert(`Purchasing stem/license for "${item.title}"... Transaction successfully processed.`)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#db2777] hover:bg-pink-600 text-white font-bold rounded-xl text-xs transition-colors shadow-lg"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Purchase License
                </button>
                <button
                  onClick={() => alert(`Opening collaboration chat with ${item.creator}...`)}
                  className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors border border-white/5"
                  title="Contact Creator"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default MarketplaceView;
