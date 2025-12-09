import React, { useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { FolderLock, Unlock, X } from 'lucide-react';
import { getSongFile } from '../services/fileSystemService';

export const PermissionRecoveryModal: React.FC = () => {
  const { permissionErrorSong, setPermissionErrorSong, setIsPlaying } = usePlayerStore();
  const [loading, setLoading] = useState(false);

  if (!permissionErrorSong) return null;

  const handleRestore = async () => {
      setLoading(true);
      try {
          // Triggering getSongFile on a user click event allows the browser 
          // to show the permission prompt if needed.
          await getSongFile(permissionErrorSong);
          
          // If successful, clear error and resume
          setPermissionErrorSong(null);
          setIsPlaying(true);
      } catch (e) {
          console.error("Failed to restore permission:", e);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
        <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-8 text-center relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-orange-500"></div>
            
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <FolderLock size={40} className="text-white/60" />
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">Access Lost</h3>
            
            <p className="text-white/60 text-sm leading-relaxed mb-8">
                The browser has revoked access to your music files for security reasons (this happens after page reloads).
                <br/><br/>
                Please grant permission again to continue playing 
                <span className="text-white font-bold block mt-1">"{permissionErrorSong.title}"</span>
            </p>

            <div className="flex flex-col gap-3">
                <button 
                    onClick={handleRestore}
                    disabled={loading}
                    className="w-full bg-white text-black hover:bg-neutral-200 font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg"
                >
                    {loading ? (
                        <span>Verifying...</span>
                    ) : (
                        <>
                            <Unlock size={20} /> Restore Access
                        </>
                    )}
                </button>
                <button 
                    onClick={() => setPermissionErrorSong(null)}
                    className="w-full text-white/40 hover:text-white text-sm font-medium py-2 transition"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
  );
};