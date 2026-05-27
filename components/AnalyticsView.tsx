import React from 'react';
import { TrendingUp, ArrowUpRight, Play, Download, Heart } from 'lucide-react';

const AnalyticsView: React.FC = () => {
  return (
    <div className="w-full min-h-screen p-6 md:p-8 bg-[#030712] text-white text-left pb-20">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Song Performance</h1>
          <p className="text-sm text-gray-400 mt-1">Monitor release metrics, social streams, and digital distribution downloads.</p>
        </div>

        {/* Triple Sparkline Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Plays Card */}
          <div className="p-6 bg-[#010208] border border-white/5 rounded-3xl flex flex-col justify-between gap-4 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">Plays</span>
                <h3 className="text-3xl font-extrabold mt-1">24.5K</h3>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                +18% <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            
            {/* Play Sparkline SVG */}
            <div className="w-full h-12 mt-2">
              <svg className="w-full h-full fill-none stroke-current text-[#db2777]" strokeWidth="3" viewBox="0 0 100 20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M 0,20 Q 15,10 30,12 T 60,18 T 90,2 T 100,2" />
              </svg>
            </div>
          </div>

          {/* Downloads Card */}
          <div className="p-6 bg-[#010208] border border-white/5 rounded-3xl flex flex-col justify-between gap-4 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">Downloads</span>
                <h3 className="text-3xl font-extrabold mt-1">1,428</h3>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                +12% <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            
            {/* Download Sparkline SVG */}
            <div className="w-full h-12 mt-2">
              <svg className="w-full h-full fill-none stroke-current text-[#db2777]" strokeWidth="3" viewBox="0 0 100 20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M 0,18 Q 20,4 40,15 T 70,8 T 100,1" />
              </svg>
            </div>
          </div>

          {/* Engagement Card */}
          <div className="p-6 bg-[#010208] border border-white/5 rounded-3xl flex flex-col justify-between gap-4 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">Engagement</span>
                <h3 className="text-3xl font-extrabold mt-1">8.7%</h3>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                +9% <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            
            {/* Engagement Sparkline SVG */}
            <div className="w-full h-12 mt-2">
              <svg className="w-full h-full fill-none stroke-current text-purple-500" strokeWidth="3" viewBox="0 0 100 20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M 0,20 Q 15,10 30,12 T 60,18 T 90,2 T 100,2" />
              </svg>
            </div>
          </div>

        </div>

        {/* Top Performing Songs */}
        <div className="p-6 bg-[#010208] border border-white/5 rounded-3xl shadow-xl flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold tracking-tight">Top Songs</h3>
            <span className="text-xs text-gray-400 font-semibold uppercase">Lifetime Streams</span>
          </div>

          <div className="flex flex-col gap-4">
            {[
              { rank: 1, title: 'Neon Dreams', plays: '12.4K', color: 'from-pink-500 to-purple-500' },
              { rank: 2, title: 'Late Night Thoughts', plays: '8.2K', color: 'from-[#db2777] to-pink-500' },
              { rank: 3, title: 'Ocean Drive', plays: '4.1K', color: 'from-purple-600 to-pink-600' }
            ].map((song) => (
              <div 
                key={song.rank} 
                className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/5 hover:border-pink-500/20 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-white/5 text-gray-400 flex items-center justify-center font-bold text-sm">
                    {song.rank}
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${song.color} flex items-center justify-center text-white shrink-0`}>
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{song.title}</h4>
                    <span className="text-xs text-gray-400">Published on streaming</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-pink-400">{song.plays}</span>
                  <span className="text-[10px] uppercase text-gray-500 block">Plays</span>
                </div>
              </div>
            ))}
          </div>

          {/* Full report button */}
          <button 
            onClick={() => alert('Detailed streaming insights will be unlocked upon linking your Spotify or Apple Music artist accounts.')}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-2xl font-semibold transition-all hover:scale-101 text-sm mt-2"
          >
            View Full Report
          </button>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsView;
