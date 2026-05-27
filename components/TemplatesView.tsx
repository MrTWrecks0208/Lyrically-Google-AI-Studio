import React, { useState } from 'react';
import { Sparkles, Music, Star, Radio, Disc, Mic, Play } from 'lucide-react';

interface TemplateItem {
  id: string;
  title: string;
  genre: 'Pop' | 'Hip Hop' | 'R&B' | 'Rock' | 'EDM';
  description: string;
  bpm: number;
  initialLyrics: string;
  companionId?: string;
  rating: number;
}

const templatesData: TemplateItem[] = [
  {
    id: 'pop-anthem',
    title: 'Pop Anthem',
    genre: 'Pop',
    description: 'Upbeat tempo structure featuring builds, drop-chorus hooks, and verse-bridge frameworks.',
    bpm: 124,
    initialLyrics: `[Intro]\nElectro-pop synth swelling...\n\n[Verse 1]\nCity lights are reflecting in your eyes,\nWe build our castles in the cloudless skies...\n\n[Pre-Chorus]\nAnd we're running out of time tonight,\nWill we catch the morning light?\n\n[Chorus]\nOut in the neon night, we shine,\nThis moment's yours and mine!`,
    rating: 4.9
  },
  {
    id: 'hiphop-banger',
    title: 'Hip Hop Banger',
    genre: 'Hip Hop',
    description: 'Fast-paced rhythmic trap grid designed for hard-hitting rhymes, verse structures, and minimal melodic choruses.',
    bpm: 98,
    initialLyrics: `[Intro]\n808 sub bass drop...\n\n[Verse 1]\nRhymes kick in, heartbeat ticking,\nGot the crown, watch the room spinning...\n\n[Chorus]\nWe rise, we fall, we stay tall,\nNever giving up, breaking down the wall!`,
    rating: 4.8
  },
  {
    id: 'rnb-ballad',
    title: 'R&B Ballad',
    genre: 'R&B',
    description: 'Sensual, slow-tempo chord grids focusing on emotional melodies, adlibs, and deeply intimate pre-choruses.',
    bpm: 72,
    initialLyrics: `[Intro]\nWarm rhodes piano chords...\n\n[Verse 1]\nRaindrops falling outside my door,\nWhisper things I hadn't heard before...\n\n[Chorus]\nStay here with me under the stars,\nHealing all our battle scars.`,
    rating: 5.0
  },
  {
    id: 'edm-festival',
    title: 'EDM Festival',
    genre: 'EDM',
    description: 'Four-on-the-floor kick grids featuring energetic risers, suspense pre-choruses, and lyrical drops.',
    bpm: 128,
    initialLyrics: `[Intro]\nPlucky synth motif driving...\n\n[Build-Up]\nCan you feel the pulse begin to rise?\nCan you see the lasers in the skies?\n\n[Chorus-Drop]\n(Lyrical Hook Drop) Live in the sound!`,
    rating: 4.7
  }
];

interface TemplatesProps {
  onCreateProjectFromTemplate: (title: string, genre: string, lyrics: string) => void;
}

const TemplatesView: React.FC<TemplatesProps> = ({ onCreateProjectFromTemplate }) => {
  const [activeGenre, setActiveGenre] = useState<'All' | 'Pop' | 'Hip Hop' | 'R&B' | 'Rock' | 'EDM'>('All');

  const filteredTemplates = templatesData.filter(
    (tpl) => activeGenre === 'All' || tpl.genre === activeGenre
  );

  return (
    <div className="w-full min-h-screen p-6 md:p-8 bg-[#030712] text-white text-left pb-20">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Song Starters</h1>
          <p className="text-sm text-gray-400 mt-1">Start writing instantly with pre-designed architectural song structures.</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {(['All', 'Pop', 'Hip Hop', 'R&B', 'Rock', 'EDM'] as const).map((genre) => (
            <button
              key={genre}
              onClick={() => setActiveGenre(genre)}
              className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeGenre === genre
                  ? 'bg-gradient-to-r from-purple-600 to-[#db2777] text-white shadow-lg'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="group relative bg-[#010208] border border-white/5 hover:border-pink-500/20 rounded-3xl p-6 flex flex-col justify-between gap-6 overflow-hidden transition-all duration-300 shadow-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#db2777]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold tracking-wider text-pink-400 border border-white/5 uppercase">
                    {template.genre} • {template.bpm} BPM
                  </div>
                  <div className="flex items-center gap-1 text-xs text-yellow-400 font-bold">
                    <Star className="w-4 h-4 fill-current" />
                    {template.rating}
                  </div>
                </div>

                <h3 className="text-xl font-bold group-hover:text-pink-400 transition-colors duration-200">
                  {template.title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">
                  {template.description}
                </p>
              </div>

              <button
                onClick={() => onCreateProjectFromTemplate(template.title, template.genre, template.initialLyrics)}
                className="relative z-10 w-full flex items-center justify-center gap-2 py-3 bg-[#db2777] hover:bg-pink-600/90 text-white font-bold rounded-2xl transition-all duration-200 group-hover:scale-101 shadow-lg shadow-pink-500/15 text-sm"
              >
                <Sparkles className="w-4 h-4" />
                Initialize Template
              </button>
            </div>
          ))}
        </div>

        {/* Help disclaimer card */}
        <div className="p-6 rounded-3xl bg-[#010208] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Need a custom prompt co-writer?</h4>
              <p className="text-xs text-gray-400">Describe a mood or story to generate unique lyric skeletons starting from scratch.</p>
            </div>
          </div>
          <button 
            onClick={() => onCreateProjectFromTemplate('Custom Guided Project', 'Pop', '[Intro]\n\n[Verse 1]\n')}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/5 transition-all"
          >
            Guided Start
          </button>
        </div>

      </div>
    </div>
  );
};

export default TemplatesView;
