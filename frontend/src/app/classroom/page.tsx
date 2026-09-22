'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { Send, Wand2, Video, Search } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function Classroom() {
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFaculty = Boolean(user?.role && user.role.toLowerCase() !== 'student');

  const { data: rooms } = useQuery({
    queryKey: ['anonRooms'],
    queryFn: async () => {
      const res = await api.get('/Genai/api/anon-rooms/');
      return res.data;
    },
    enabled: Boolean(isAuthorized)
  });

  useEffect(() => {
    if (rooms && rooms.length > 0 && !activeRoom) {
      setActiveRoom(rooms[0].id);
    }
  }, [rooms, activeRoom]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeRoom) {
      const fetchMessages = async () => {
        try {
          const res = await api.get(`/Genai/api/anon-rooms/${activeRoom}/messages/`);
          setMessages(res.data);
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        } catch (e) {}
      };
      fetchMessages();
      interval = setInterval(fetchMessages, 5000);
    }
    return () => clearInterval(interval);
  }, [activeRoom]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeRoom) return;
    try {
      await api.post(`/Genai/api/anon-rooms/${activeRoom}/messages/`, { content: message });
      setMessage('');
      const res = await api.get(`/Genai/api/anon-rooms/${activeRoom}/messages/`);
      setMessages(res.data);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  const handleImprove = async () => {
    if (!message.trim()) return;
    try {
      const res = await api.post('/Genai/api/genai/', { 
        prompt: `Make this message professional for a student classroom: "${message}"`,
        question: `Make this message professional for a student classroom: "${message}"`
      });
      const improved = res.data.response || res.data.answer;
      if (improved) setMessage(improved);
    } catch (err) {
      toast.error('AI improvement failed');
    }
  };

  const joinVideoCall = () => {
    if (!activeRoom) return;
    const room = rooms?.find((r: any) => r.id === activeRoom);
    if (room) {
      window.open(`https://meet.jit.si/EduHub-${room.subject_code}-${room.id}`, '_blank');
    }
  };

  if (isLoading || !isAuthorized) return null;

  return (
    <div className={`flex h-screen ${isFaculty ? 'bg-slate-900' : 'bg-slate-900'} relative`}>
      {isFaculty ? <Sidebar /> : <div className="absolute top-0 w-full z-10"><Navbar /></div>}
      <Toaster position="top-right" />
      
      <main className={`flex-1 flex overflow-hidden ${!isFaculty ? 'pt-16' : ''}`}>
        <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/50">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-xl font-bold mb-4">Classrooms</h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input type="text" placeholder="Search rooms..." className="w-full bg-slate-800 rounded-full pl-10 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rooms?.map((room: any) => (
              <button key={room.id} onClick={() => setActiveRoom(room.id)}
                className={`w-full text-left p-4 border-b border-slate-800/50 hover:bg-slate-800 transition ${activeRoom === room.id ? 'bg-slate-800 border-l-4 border-l-emerald-500' : ''}`}>
                <h3 className="font-bold truncate">{room.subject_name}</h3>
                <p className="text-xs text-slate-400 mt-1">{room.subject_code}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col relative bg-slate-900">
          {activeRoom ? (
            <>
              <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur">
                <div className="flex items-center gap-3">
                  <h2 className="font-bold">{rooms?.find((r: any) => r.id === activeRoom)?.subject_name}</h2>
                  <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-full border border-emerald-500/30">
                    {isFaculty ? 'Students are anonymous' : 'You are anonymous'}
                  </span>
                </div>
                <button onClick={joinVideoCall} className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-4 py-2 rounded-lg transition text-sm font-medium">
                  <Video size={18} /> Join Video
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg: any, i: number) => {
                  const isMe = msg.sender_id === user?.id;
                  const isTeacher = msg.sender_role !== 'student';
                  return (
                    <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-xs text-slate-500 mb-1 ml-1">{isMe ? 'You' : (isTeacher ? 'Faculty' : 'Anonymous Student')}</span>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? 'bg-emerald-600 rounded-tr-sm text-white' : (isTeacher ? 'bg-slate-700 rounded-tl-sm text-white border border-slate-600' : 'bg-slate-800 rounded-tl-sm text-slate-200')}`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 bg-slate-900 border-t border-slate-800">
                <form onSubmit={handleSend} className="flex items-end gap-2">
                  <div className="flex-1 bg-slate-800 rounded-2xl relative border border-slate-700 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition">
                    <textarea value={message} onChange={e => setMessage(e.target.value)}
                      placeholder="Type a message..." rows={1}
                      className="w-full bg-transparent resize-none py-3 pl-4 pr-12 focus:outline-none text-sm"
                      onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                    />
                    {isFaculty && (
                      <button type="button" onClick={handleImprove} title="Improve with AI"
                        className="absolute right-3 top-3 text-purple-400 hover:text-purple-300">
                        <Wand2 size={18} />
                      </button>
                    )}
                  </div>
                  <button type="submit" disabled={!message.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl transition disabled:opacity-50">
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Select a classroom to start chatting
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
