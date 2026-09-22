'use client';
import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Sidebar from '../../components/Sidebar';
import AiSymbol from '../../components/AiSymbol';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Edit2, Trash2, Plus, X, ExternalLink, FileText, Loader2, Bell, ChevronDown, User, LogOut, UploadCloud, CheckCircle2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { formatFileSize, timeAgo } from '../../lib/utils';
import Link from 'next/link';

export default function MyUploads() {
  const { isAuthorized, isLoading } = useRoleGuard(['faculty', 'admin']);
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ['teacherStudentDashboard'] });
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
    let uploadedSuccessfully = false;

    // 1. Attempt client-side direct S3 PUT upload if configured
    try {
      const presignRes = await api.post('/resource/api/s3/presign-upload/', {
        filename: file.name,
        content_type: file.type || 'application/octet-stream'
      });
      const { upload_url, s3_key } = presignRes.data || {};

      if (upload_url) {
        const uploadResp = await fetch(upload_url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream'
          }
        });

        if (uploadResp.ok) {
          await api.post('/resource/api/resources/', {
            title: uploadData.title,
            description: uploadData.description || '',
            subject_id: Number(uploadData.subject_id),
            file_type: uploadData.file_type || 'PDF',
            file_size: file.size,
            s3_key: s3_key
          });
          uploadedSuccessfully = true;
        }
      }
    } catch (s3Err) {
      console.warn("Direct S3 PUT upload not available, falling back to direct server upload...", s3Err);
    }

    // 2. Direct multipart form-data upload fallback
    if (!uploadedSuccessfully) {
      try {
        const formData = new FormData();
        formData.append('title', uploadData.title);
        formData.append('description', uploadData.description || '');
        formData.append('subject_id', uploadData.subject_id);
        formData.append('subject', uploadData.subject_id);
        formData.append('file_type', uploadData.file_type || 'PDF');
        formData.append('file', file);

        await api.post('/resource/api/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedSuccessfully = true;
      } catch (backendErr: any) {
        console.error("Backend upload error:", backendErr);
        toast.error(backendErr.response?.data?.detail || 'Upload failed. Please check backend.');
      }
    }

    setUploading(false);
    if (uploadedSuccessfully) {
      toast.success('Resource uploaded successfully!');
      setIsModalOpen(false);
      setFile(null);
      setUploadData({ title: '', description: '', subject_id: '', file_type: 'PDF' });
      queryClient.invalidateQueries({ queryKey: ['myResources'] });
    }
  };

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const username = user?.username || 'Faculty';
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row relative font-sans antialiased">
      <Toaster position="top-right" />

      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <Sidebar />

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="px-6 md:px-10 py-4 flex items-center justify-end border-b border-slate-200/60 bg-white/60 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Ask AI quick pill */}
            <Link
              href="/ai-assistant"
              title="Open NexusAI Assistant"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ecfdf5] hover:bg-[#dcfce7] text-[#047857] border border-emerald-200 text-xs font-bold transition shadow-xs"
            >
              <AiSymbol size={15} className="text-blue-600 animate-pulse" />
              <span>Ask AI</span>
            </Link>

            {/* Notification Bell */}
            <Link
              href="/notices"
              title="Notices"
              className="p-2 text-slate-500 hover:text-slate-800 transition relative rounded-full hover:bg-slate-100"
            >
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </Link>

            {/* User Dropdown Pill */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-[#0f766e] text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {initial}
                </div>
                <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
                  {username}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-40 text-sm">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-800">{username}</p>
                    <p className="text-xs text-slate-400 capitalize">{user?.role || 'Faculty'}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                  >
                    <User size={16} /> Profile
                  </Link>
                  <button
                    onClick={() => { setProfileDropdownOpen(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 text-left transition"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Uploads Body */}
        <div className="p-6 md:p-10 space-y-6 max-w-6xl w-full mx-auto">
          {/* Header Action Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3">
                <span>Course Materials & Uploads</span>
                <span className="bg-emerald-100 text-[#047857] text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {resources?.length || 0} files
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">Manage notes, documents, and syllabus resources you have published</p>
            </div>

            <button 
              onClick={() => setIsModalOpen(true)} 
              className="flex items-center gap-2 bg-[#059669] hover:bg-[#047857] text-white px-4 py-2 rounded-xl font-semibold text-xs transition shadow-sm"
            >
              <Plus size={16} /> Upload New Material
            </button>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="p-4">Title & Details</th>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Semester</th>
                    <th className="p-4">Format</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Views</th>
                    <th className="p-4">Uploaded</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resourcesLoading ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading course materials...
                      </td>
                    </tr>
                  ) : (!resources || resources.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No uploads yet</p>
                        <p className="text-[11px] text-slate-400 mt-1">Click &quot;Upload New Material&quot; to publish your first study note.</p>
                      </td>
                    </tr>
                  ) : (
                    resources.map((res: any) => {
                      const statusStr = (res.status || 'APPROVED').toUpperCase();
                      const semNmbr = res.subject?.sem?.sem_nmbr || res.subject?.sem_id || '-';
                      return (
                        <tr key={res.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                                <FileText size={18} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-xs">{res.title}</p>
                                {res.file_size ? <p className="text-[11px] text-slate-400">{formatFileSize(res.file_size)}</p> : null}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-semibold text-slate-800">
                            {res.subject?.sub_name || res.subject_name || 'General'}
                            {res.subject?.sub_code ? <span className="text-[10px] text-slate-400 font-mono ml-1.5">({res.subject.sub_code})</span> : null}
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                              Sem {semNmbr}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                              {res.file_type || 'PDF'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              statusStr === 'APPROVED' 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                : statusStr === 'REJECTED'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {statusStr === 'APPROVED' ? 'Approved' : statusStr === 'REJECTED' ? 'Rejected' : 'Pending'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600 font-semibold">{res.view_count ?? res.views ?? 0}</td>
                          <td className="p-4 text-slate-400">{timeAgo(res.created_at)}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {res.s3_url && (
                                <a 
                                  href={res.s3_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="p-1.5 hover:bg-slate-100 rounded-lg transition text-[#059669]"
                                  title="View / Download"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              )}
                              <button 
                                onClick={() => { if (confirm('Are you sure you want to delete this resource?')) deleteMutation.mutate(res.id); }} 
                                className="p-1.5 hover:bg-red-50 rounded-lg transition text-red-500 hover:text-red-700"
                                title="Delete"
                              >
                                <Trash2 size={16} />
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
        </div>
      </main>

      {/* ── Upload Modal ────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg p-6 md:p-8 rounded-3xl relative shadow-2xl">
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-extrabold text-slate-900 mb-5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                <UploadCloud size={18} />
              </div>
              <span>Upload Study Material</span>
            </h2>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Material Title *</label>
                <input 
                  required 
                  type="text" 
                  value={uploadData.title}
                  onChange={e => setUploadData({ ...uploadData, title: e.target.value })}
                  placeholder="e.g. Unit 2 Data Structures Lecture Notes" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Semester</label>
                  <select 
                    value={selectedSemester}
                    onChange={e => {
                      setSelectedSemester(e.target.value);
                      setUploadData({ ...uploadData, subject_id: '' });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                  >
                    <option value="">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={String(s)}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Format</label>
                  <select 
                    value={uploadData.file_type}
                    onChange={e => setUploadData({ ...uploadData, file_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="PPT">Presentation (PPT)</option>
                    <option value="DOC">Word Document</option>
                    <option value="IMG">Diagram / Image</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Subject *</label>
                <select 
                  required
                  value={uploadData.subject_id}
                  onChange={e => setUploadData({ ...uploadData, subject_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                >
                  <option value="">Select subject...</option>
                  {filteredSubjects?.map((sub: any) => (
                    <option key={sub.id} value={String(sub.id)}>
                      [{sub.sub_code}] {sub.sub_name} (Sem {sub.sem?.sem_nmbr || sub.sem_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Select File *</label>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-[#047857] hover:file:bg-emerald-100 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={uploading}
                  className="px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Upload Resource</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
