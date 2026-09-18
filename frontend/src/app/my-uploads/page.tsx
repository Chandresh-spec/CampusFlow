'use client';
import { useState, useRef } from 'react';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Sidebar from '../../components/Sidebar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Edit2, Trash2, Plus, X, ExternalLink, FileText, Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { formatFileSize, timeAgo } from '../../lib/utils';

export default function MyUploads() {
  const { isAuthorized, isLoading } = useRoleGuard(['faculty', 'admin']);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    subject_id: '',
    file_type: 'PDF'
  });
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

  const { data: semesters } = useQuery({
    queryKey: ['semesters'],
    queryFn: async () => {
      const res = await api.get('/academic/api/semesters/');
      return res.data;
    },
    enabled: Boolean(isAuthorized && isModalOpen)
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await api.get('/academic/api/subjects/');
      return res.data;
    },
    enabled: Boolean(isAuthorized && isModalOpen)
  });

  const filteredSubjects = subjects?.filter((s: any) => {
    if (!selectedSemester) return true;
    const semNum = Number(selectedSemester);
    return s.sem?.sem_nmbr === semNum || s.sem_id === semNum;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    if (selected) {
      const ext = selected.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        setUploadData(prev => ({ ...prev, file_type: 'PDF' }));
      } else if (ext === 'ppt' || ext === 'pptx') {
        setUploadData(prev => ({ ...prev, file_type: 'PPT' }));
      } else if (ext === 'doc' || ext === 'docx') {
        setUploadData(prev => ({ ...prev, file_type: 'DOC' }));
      } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) {
        setUploadData(prev => ({ ...prev, file_type: 'IMG' }));
      }
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => api.delete(`/resource/api/resources/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myResources'] });
      queryClient.invalidateQueries({ queryKey: ['facultyDashboard'] });
      toast.success('Resource deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete resource');
    }
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }
    if (!uploadData.subject_id) {
      toast.error('Please select a subject');
      return;
    }

    setUploading(true);
    try {
      // 1. Request presigned upload URL from backend
      const presignRes = await api.post('/resource/api/s3/presign-upload', {
        filename: file.name,
        content_type: file.type || 'application/octet-stream'
      });
      const { upload_url, s3_key } = presignRes.data;

      // 2. Direct upload to AWS S3 via PUT request
      const uploadResp = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        }
      });

      if (!uploadResp.ok) {
        throw new Error(`S3 upload returned status ${uploadResp.status}`);
      }

      // 3. Register resource record in backend
      await api.post('/resource/api/resources/', {
        title: uploadData.title,
        description: uploadData.description,
        subject_id: Number(uploadData.subject_id),
        file_type: uploadData.file_type || 'PDF',
        file_size: file.size,
        s3_key: s3_key
      });

      toast.success('Media uploaded successfully!');
      setIsModalOpen(false);
      setUploadData({ title: '', description: '', subject_id: '', file_type: 'PDF' });
      setSelectedSemester('');
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['myResources'] });
      queryClient.invalidateQueries({ queryKey: ['facultyDashboard'] });
    } catch (err: any) {
      console.error('Upload failed:', err);
      const errMsg = err?.response?.data?.detail || err?.message || 'Upload failed';
      toast.error(errMsg);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !isAuthorized) return null;

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar />
      <Toaster position="top-right" />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Uploads</h1>
            <p className="text-sm text-slate-400 mt-1">Manage and share course materials with students</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition shadow-lg shadow-purple-500/20">
            <Plus size={20} /> Upload New Media
          </button>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-800/80 border-b border-slate-700">
                <tr>
                  <th className="p-4 font-medium text-slate-300">Title</th>
                  <th className="p-4 font-medium text-slate-300">Subject</th>
                  <th className="p-4 font-medium text-slate-300">Semester</th>
                  <th className="p-4 font-medium text-slate-300">Format</th>
                  <th className="p-4 font-medium text-slate-300">Status</th>
                  <th className="p-4 font-medium text-slate-300">Views</th>
                  <th className="p-4 font-medium text-slate-300">Date</th>
                  <th className="p-4 font-medium text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {resourcesLoading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">Loading resources...</td></tr>
                ) : (!resources || resources.length === 0) ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">No uploads found. Click &quot;Upload New Media&quot; to add course materials.</td></tr>
                ) : (
                  resources.map((res: any) => {
                    const statusStr = (res.status || 'PENDING').toUpperCase();
                    const semNmbr = res.subject?.sem?.sem_nmbr || res.subject?.sem_id || '-';
                    return (
                      <tr key={res.id} className="hover:bg-white/5 transition">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400">
                              <FileText size={18} />
                            </div>
                            <div>
                              <p className="font-medium text-white">{res.title}</p>
                              {res.file_size ? <p className="text-xs text-slate-400">{formatFileSize(res.file_size)}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-slate-300 font-medium">
                          {res.subject?.sub_name || res.subject_name || 'General'}
                          {res.subject?.sub_code ? <span className="text-xs text-slate-400 ml-1.5">({res.subject.sub_code})</span> : null}
                        </td>
                        <td className="p-4 text-slate-300">
                          <span className="px-2.5 py-1 rounded bg-slate-800 text-xs font-medium border border-slate-700">
                            Sem {semNmbr}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 uppercase">
                            {res.file_type || 'PDF'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            statusStr === 'APPROVED' 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                              : statusStr === 'REJECTED'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {statusStr === 'APPROVED' ? 'Approved' : statusStr === 'REJECTED' ? 'Rejected' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-300">{res.view_count ?? res.views ?? 0}</td>
                        <td className="p-4 text-slate-300 text-sm">{timeAgo(res.created_at)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {res.s3_url && (
                              <a 
                                href={res.s3_url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="p-2 hover:bg-slate-700 rounded-lg transition text-emerald-400 hover:text-emerald-300"
                                title="Open / Download"
                              >
                                <ExternalLink size={18} />
                              </a>
                            )}
                            <button 
                              onClick={() => { if (confirm('Are you sure you want to delete this resource?')) deleteMutation.mutate(res.id); }} 
                              className="p-2 hover:bg-slate-700 rounded-lg transition text-red-400 hover:text-red-300"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass w-full max-w-lg p-6 rounded-2xl relative border border-slate-700">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition">
                <X size={24} />
              </button>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FileText className="text-purple-400" /> Upload Resource
              </h2>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-200">Title *</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="e.g. Unit 1 Lecture Notes, Data Structures Question Bank"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none text-white"
                    value={uploadData.title} 
                    onChange={e => setUploadData({ ...uploadData, title: e.target.value })} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-200">Semester</label>
                    <select 
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none text-white"
                      value={selectedSemester} 
                      onChange={e => {
                        setSelectedSemester(e.target.value);
                        setUploadData({ ...uploadData, subject_id: '' });
                      }}
                    >
                      <option value="">All Semesters</option>
                      {(semesters && semesters.length > 0 ? semesters : [1,2,3,4,5,6,7,8].map(n => ({ id: n, sem_nmbr: n }))).map((sem: any) => (
                        <option key={sem.id || sem.sem_nmbr} value={sem.sem_nmbr}>
                          Semester {sem.sem_nmbr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-200">File Type *</label>
                    <select 
                      required 
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none text-white"
                      value={uploadData.file_type} 
                      onChange={e => setUploadData({ ...uploadData, file_type: e.target.value })}
                    >
                      <option value="PDF">PDF (Notes / Document)</option>
                      <option value="PPT">PPT (Presentation)</option>
                      <option value="DOC">DOC (Word Document)</option>
                      <option value="IMG">IMG (Diagram / Image)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-200">Subject *</label>
                  <select 
                    required 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none text-white"
                    value={uploadData.subject_id} 
                    onChange={e => setUploadData({ ...uploadData, subject_id: e.target.value })}
                  >
                    <option value="">Select a subject...</option>
                    {filteredSubjects && filteredSubjects.length > 0 ? (
                      filteredSubjects.map((s: any) => {
                        const semNum = s.sem?.sem_nmbr || s.sem_id;
                        const subName = s.sub_name || s.name;
                        const subCode = s.sub_code || s.code;
                        return (
                          <option key={s.id} value={s.id}>
                            [Sem {semNum}] {subName} {subCode ? `(${subCode})` : ''}
                          </option>
                        );
                      })
                    ) : (
                      <option value="" disabled>No subjects found for this semester</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-200">Description (optional)</label>
                  <textarea 
                    rows={2}
                    placeholder="Brief description or topics covered in this resource"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none text-white"
                    value={uploadData.description} 
                    onChange={e => setUploadData({ ...uploadData, description: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-200">Choose File *</label>
                  <input 
                    type="file" 
                    required 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    className="w-full text-sm text-slate-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer" 
                  />
                  {file && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-purple-300 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                      <span>Selected: <strong>{file.name}</strong> ({formatFileSize(file.size)})</span>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={uploading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg py-3 font-bold hover:opacity-90 transition mt-6 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Uploading to S3...
                    </>
                  ) : (
                    'Upload & Publish'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
