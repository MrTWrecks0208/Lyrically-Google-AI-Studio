import React, { useState } from 'react';
import { Users, Plus, MessageSquare, Clock, UserCheck, AlertCircle, Share2 } from 'lucide-react';

interface Collaboration {
  id: string;
  projectName: string;
  collaborators: string[];
  lastUpdated: string;
  commentsCount: number;
}

const collaborationsInitial: Collaboration[] = [
  { id: '1', projectName: 'Neon Dreams', collaborators: ['You', 'Sam', 'Taylor'], lastUpdated: 'Updated 2m ago', commentsCount: 33 },
  { id: '2', projectName: 'Fading Echoes', collaborators: ['You', 'Jordan'], lastUpdated: 'Updated 1d ago', commentsCount: 22 },
  { id: '3', projectName: 'Ocean Drive', collaborators: ['You', 'Casey'], lastUpdated: 'Updated 2d ago', commentsCount: 12 }
];

const activityLogs = [
  { id: 'a1', user: 'Sam', action: 'added a comment', target: 'Verse 1 edit', time: '2m ago' },
  { id: 'a2', user: 'Taylor', action: 'updated the melody', target: 'Bridge Chorus section', time: '15m ago' },
  { id: 'a3', user: 'Jordan', action: 'added a track', target: 'Vocals stems upload', time: '1d ago' }
];

const CollaborationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'projects' | 'invites'>('projects');
  const [collaborations, setCollaborations] = useState<Collaboration[]>(collaborationsInitial);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteProject, setInviteProject] = useState('Neon Dreams');

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    // Add custom collaborator
    const updated = collaborations.map(col => {
      if (col.projectName === inviteProject) {
        return {
          ...col,
          collaborators: [...col.collaborators, inviteEmail.split('@')[0]]
        };
      }
      return col;
    });
    setCollaborations(updated);
    alert(`Collaboration invite sent to ${inviteEmail} for project ${inviteProject}!`);
    setInviteEmail('');
    setShowInviteModal(false);
  };

  return (
    <div className="w-full min-h-screen p-6 md:p-8 bg-[#030712] text-white text-left pb-20">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Collaboration</h1>
          <p className="text-sm text-gray-400 mt-1">Co-write in real-time, share session stems, and manage lyric version commentary.</p>
        </div>

        {/* Tab Selection */}
        <div className="border-b border-white/5 flex gap-8">
          <button
            onClick={() => setActiveTab('projects')}
            className={`pb-4 text-sm font-bold relative transition-all ${
              activeTab === 'projects' ? 'text-pink-500 font-extrabold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Projects
            {activeTab === 'projects' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`pb-4 text-sm font-bold relative transition-all flex items-center gap-2 ${
              activeTab === 'invites' ? 'text-pink-500 font-extrabold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Invites
            <span className="px-1.5 py-0.5 bg-pink-500 text-white text-[9px] rounded-full font-sans font-bold">1</span>
            {activeTab === 'invites' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-full" />
            )}
          </button>
        </div>

        {activeTab === 'projects' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Active Projects List */}
            <div className="md:col-span-2 flex flex-col gap-4">
              <h3 className="text-lg font-bold tracking-tight">Active Collaborations</h3>
              
              <div className="flex flex-col gap-4">
                {collaborations.map((col) => (
                  <div
                    key={col.id}
                    className="p-5 bg-[#010208] border border-white/5 rounded-2xl flex items-center justify-between shadow-xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base">{col.projectName}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {col.collaborators.map((person, idx) => (
                            <span 
                              key={idx} 
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                person === 'You' ? 'bg-[#db2777]/20 text-pink-400' : 'bg-white/5 text-gray-300'
                              }`}
                            >
                              {person}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-gray-500 block mb-1">{col.lastUpdated}</span>
                      <span className="text-xs font-bold text-pink-400 bg-pink-500/10 px-2 py-1 rounded-lg flex items-center gap-1.5 justify-end">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {col.commentsCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Feed Column */}
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-bold tracking-tight">Activity Feed</h3>
              
              <div className="p-5 bg-[#010208] border border-white/5 rounded-2xl shadow-xl flex flex-col gap-5">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 text-sm items-start">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {log.user[0]}
                    </div>
                    <div>
                      <p className="text-gray-300">
                        <span className="font-bold text-white">{log.user}</span> {log.action}{' '}
                        <span className="font-semibold text-pink-400">"{log.target}"</span>
                      </p>
                      <span className="text-[10px] text-gray-500 block mt-1">{log.time}</span>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setShowInviteModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#db2777] hover:bg-pink-600 text-white font-bold rounded-xl transition-all shadow-lg text-sm mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Invite Collaborator
                </button>
              </div>
            </div>

          </div>
        ) : (
          /* Invites Tab */
          <div className="p-8 bg-[#010208] border border-white/5 rounded-3xl flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 shrink-0">
                <UserCheck className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Casey invited you</h4>
                <p className="text-xs text-gray-400 mt-1">To collaborate on the track: <span className="text-pink-400 font-semibold">Ocean Drive</span></p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => alert('Invite Accepted! Option to edit is unlocked in projects.')}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs transition-transform"
              >
                Accept
              </button>
              <button
                onClick={() => alert('Invite Declined.')}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-xs transition-transform"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Invite Modals */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#010208] border border-white/10 rounded-2xl max-w-md w-full p-6 text-left shadow-2xl relative animate-in zoom-in-95 duration-150">
              <button
                onClick={() => setShowInviteModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
              >
                &times;
              </button>

              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-pink-500" />
                Invite co-writer
              </h3>

              <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-400">Co-writer Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="artist@example.com"
                    className="w-full mt-1.5 px-4 py-2.5 bg-[#030712] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-pink-500 transition-colors text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-gray-400">Attach under project</label>
                  <select
                    value={inviteProject}
                    onChange={(e) => setInviteProject(e.target.value)}
                    className="w-full mt-1.5 px-4 py-2.5 bg-[#030712] border border-[#030712] rounded-xl text-sm text-white focus:outline-none focus:border-pink-550 transition-colors"
                  >
                    <option value="Neon Dreams">Neon Dreams</option>
                    <option value="Fading Echoes">Fading Echoes</option>
                    <option value="Ocean Drive">Ocean Drive</option>
                  </select>
                </div>

                <div className="flex gap-3 justify-end mt-2 animate-in fade-in">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#db2777] hover:bg-[#db2777]/90 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-pink-500/20"
                  >
                    Send Invite
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CollaborationView;
