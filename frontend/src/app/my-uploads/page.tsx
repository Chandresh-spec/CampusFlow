'use client';
import { useState, useRef } from 'react';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Sidebar from '../../components/Sidebar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Edit2, Trash2, Plus, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { formatFileSize, timeAgo } from '../../lib/utils';

export default function MyUploads() {
  const { isAuthorized, isLoading } = useRoleGuard(['faculty', 'admin']);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadData, setUploadData] = useState({ title: '', description: '', subject_id: '', file_type: 'notes' });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: resources, isLoading: resourcesLoading } = useQuery({
    queryKey: ['myResources'],
    queryFn: async () => {
      const res = await api.get('/resource/api/resources/');
      return res.data;
    },
    enabled: Boolean(isAuthorized)
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await api.get('/academic/api/subjects/');
      return res.data;
    },
    enabled: Boolean(isAuthorized && isModalOpen)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/resource/api/resources/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myResources'] });
      toast.success('Resource deleted');
    }
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    
    try {
      const presignRes = await api.post('/resource/api/s3/presign-upload/', { file_name: file.name, file_type: file.type });
      const { url, fields, key } = presignRes.data;
      
      const formData = new FormData();
      Object.keys(fields).forEach(k => formData.append(k, fields[k]));
      formData.append('file', file);
      
      await fetch(url, { method: 'POST', body: formData });
      
      await api.post('/resource/api/resources/', {
        ...uploadData,
        s3_key: key,
        file_name: file.name,
        size: file.size,
        mime_type: file.type
      });
      
      toast.success('Upload successful');
      setIsModalOpen(false);
      setUploadData({ title: '', description: '', subject_id: '', file_type: 'notes' });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['myResources'] });
    } catch (err) {
      toast.error('Upload failed');
    }
  };

  if (isLoading || !isAuthorized) return null;

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar />
      <Toaster position="top-right" />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Uploads</h1>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 rounded-xl font-medium hover:opacity-90 transition">
            <Plus size={20} /> Upload New
          </button>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-800/80 border-b border-slate-700">
                <tr>
                  <th className="p-4 font-medium text-slate-300">Title</th>
                  <th className="p-4 font-medium text-slate-300">Subject</th>
                  <th className="p-4 font-medium text-slate-300">Status</th>
                  <th className="p-4 font-medium text-slate-300">Views</th>
                  <th className="p-4 font-medium text-slate-300">Date</th>
                  <th className="p-4 font-medium text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {resourcesLoading ? <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr> : 
                  resources?.map((res: any) => (
                    <tr key={res.id} className="hover:bg-white/5 transition">
                      <td className="p-4 font-medium">{res.title}</td>
                      <td className="p-4 text-slate-300">{res.subject_name}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${res.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {res.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">{res.views}</td>
                      <td className="p-4 text-slate-300">{timeAgo(res.created_at)}</td>
                      <td className="p-4 flex gap-2">
                        <button className="p-2 hover:bg-slate-700 rounded transition text-blue-400"><Edit2 size={18} /></button>
                        <button onClick={() => {if(confirm('Are you sure?')) deleteMutation.mutate(res.id)}} className="p-2 hover:bg-slate-700 rounded transition text-red-400"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass w-full max-w-lg p-6 rounded-2xl relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-2xl font-bold mb-6">Upload Resource</h2>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input required type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    value={uploadData.title} onChange={e => setUploadData({...uploadData, title: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subject</label>
                  <select required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 appearance-none"
                    value={uploadData.subject_id} onChange={e => setUploadData({...uploadData, subject_id: e.target.value})}>
                    <option value="">Select a subject...</option>
                    {subjects?.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 appearance-none"
                    value={uploadData.file_type} onChange={e => setUploadData({...uploadData, file_type: e.target.value})}>
                    <option value="notes">Notes</option>
                    <option value="assignment">Assignment</option>
                    <option value="pyq">PYQ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    value={uploadData.description} onChange={e => setUploadData({...uploadData, description: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">File</label>
                  <input type="file" required ref={fileInputRef} onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700" />
                  {file && <p className="text-xs text-slate-400 mt-2">Selected: {file.name} ({formatFileSize(file.size)})</p>}
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg py-3 font-bold hover:opacity-90 mt-4">Upload</button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
