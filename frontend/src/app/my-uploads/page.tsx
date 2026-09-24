'use client';
import { useState, useRef } from 'react';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Navbar from '../../components/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  FileUp, 
  Trash2, 
  Plus, 
  X, 
  ExternalLink, 
  FileText, 
  Loader2, 
  Layers, 
  Calendar, 
  Eye, 
  CheckCircle2, 
  Clock, 
  XCircle,
  FileCheck,
  BookOpen
} from 'lucide-react';
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
    let uploadedSuccessfully = false;

    // 1. Attempt client-side direct S3 PUT upload
    try {
      const presignRes = await api.post('/resource/api/s3/presign-upload', {
        filename: file.name,
        content_type: file.type || 'application/octet-stream'
      });
      const { upload_url, s3_key } = presignRes.data;

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
          description: uploadData.description,
          subject_id: Number(uploadData.subject_id),
          file_type: uploadData.file_type || 'PDF',
          file_size: file.size,
          s3_key: s3_key
        });
        uploadedSuccessfully = true;
      }
    } catch (s3Err) {
      console.warn("Direct S3 PUT upload blocked (likely S3 bucket CORS), using backend upload fallback...", s3Err);
    }

    // 2. Fallback: upload directly via backend API if S3 CORS blocked direct PUT
    if (!uploadedSuccessfully) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', uploadData.title);
        if (uploadData.description) formData.append('description', uploadData.description);
        formData.append('subject_id', String(uploadData.subject_id));
        formData.append('file_type', uploadData.file_type || 'PDF');

        await api.post('/resource/api/upload-direct/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedSuccessfully = true;
      } catch (backendErr: any) {
        console.error('Backend upload fallback failed:', backendErr);
        const errMsg = backendErr?.response?.data?.detail || backendErr?.message || 'Upload failed';
        toast.error(errMsg);
        setUploading(false);
        return;
      }
    }

    if (uploadedSuccessfully) {
      toast.success('Media uploaded successfully!');
      setIsModalOpen(false);
      setUploadData({ title: '', description: '', subject_id: '', file_type: 'PDF' });
      setSelectedSemester('');
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['myResources'] });
      queryClient.invalidateQueries({ queryKey: ['facultyDashboard'] });
    }
    setUploading(false);
  };

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-24 font-sans relative">
      <Navbar />
      <Toaster position="top-right" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Page Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#059669] via-emerald-500 to-teal-400" />
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-[#059669] text-xs font-bold uppercase tracking-wider mb-2">
              <BookOpen size={13} />
              Faculty Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              My Uploaded Materials
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage syllabus notes, lecture slides, and question banks stored securely on AWS S3.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2.5 bg-[#059669] hover:bg-[#047857] text-white px-5 py-3 rounded-2xl font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={19} />
            <span>Upload New Media</span>
          </button>
        </div>

        {/* ── Resources Table Card ─────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-4 sm:p-5">Resource Title</th>
                  <th className="p-4 sm:p-5">Subject</th>
                  <th className="p-4 sm:p-5">Semester</th>
                  <th className="p-4 sm:p-5">Format</th>
                  <th className="p-4 sm:p-5">Status</th>
                  <th className="p-4 sm:p-5">Views</th>
                  <th className="p-4 sm:p-5">Date</th>
                  <th className="p-4 sm:p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resourcesLoading ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium">Loading uploaded materials...</span>
                      </div>
                    </td>
                  </tr>
                ) : (!resources || resources.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-500">
                      <div className="max-w-sm mx-auto space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                          <FileUp size={28} />
                        </div>
                        <p className="text-base font-bold text-slate-800">No uploads found</p>
                        <p className="text-xs text-slate-400">
                          Click &quot;Upload New Media&quot; above to publish your first lecture note, presentation, or question paper.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  resources.map((res: any) => {
                    const statusStr = (res.status || 'PENDING').toUpperCase();
                    const semNmbr = res.subject?.sem?.sem_nmbr || res.subject?.sem_id || '-';
                    return (
                      <tr key={res.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 sm:p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center shrink-0 border border-emerald-100">
                              <FileText size={20} />
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <p className="font-bold text-slate-900 text-sm truncate">{res.title}</p>
                              {res.file_size ? (
                                <p className="text-xs text-slate-400 mt-0.5">{formatFileSize(res.file_size)}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="p-4 sm:p-5 text-slate-700 font-semibold text-sm">
                          <div>
                            <span>{res.subject?.sub_name || res.subject_name || 'General'}</span>
                            {res.subject?.sub_code && (
                              <span className="text-xs font-normal text-slate-400 ml-1.5">
                                ({res.subject.sub_code})
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 sm:p-5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                            Sem {semNmbr}
                          </span>
                        </td>

                        <td className="p-4 sm:p-5">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                            {res.file_type || 'PDF'}
                          </span>
                        </td>

                        <td className="p-4 sm:p-5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            statusStr === 'APPROVED' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : statusStr === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {statusStr === 'APPROVED' && <CheckCircle2 size={12} className="text-emerald-600" />}
                            {statusStr === 'REJECTED' && <XCircle size={12} className="text-rose-600" />}
                            {statusStr === 'PENDING' && <Clock size={12} className="text-amber-600" />}
                            {statusStr === 'APPROVED' ? 'Approved' : statusStr === 'REJECTED' ? 'Rejected' : 'Pending'}
                          </span>
                        </td>

                        <td className="p-4 sm:p-5 text-slate-600 text-sm font-medium">
                          <div className="flex items-center gap-1">
                            <Eye size={15} className="text-slate-400" />
                            <span>{res.view_count ?? res.views ?? 0}</span>
                          </div>
                        </td>

                        <td className="p-4 sm:p-5 text-slate-500 text-xs font-medium whitespace-nowrap">
                          {timeAgo(res.created_at)}
                        </td>

                        <td className="p-4 sm:p-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              type="button"
                              onClick={async () => {
                                if (res.s3_url && !res.s3_url.includes('Expires=')) {
                                  window.open(res.s3_url, '_blank');
                                  return;
                                }
                                try {
                                  const toastId = toast.loading('Opening document...');
                                  const dlRes = await api.post(`/api/student/resources/${res.id}/download/`);
                                  toast.dismiss(toastId);
                                  if (dlRes.data?.url) {
                                    window.open(dlRes.data.url, '_blank');
                                  } else {
                                    toast.error('Download link unavailable');
                                  }
                                } catch (e) {
                                  toast.dismiss();
                                  toast.error('Failed to open file');
                                }
                              }}
                              className="p-2 rounded-xl text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all cursor-pointer"
                              title="Open / Download from S3"
                            >
                              <ExternalLink size={17} />
                            </button>
                            <button 
                              onClick={() => { 
                                if (confirm('Are you sure you want to delete this resource?')) {
                                  deleteMutation.mutate(res.id); 
                                }
                              }} 
                              className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all"
                              title="Delete Resource"
                            >
                              <Trash2 size={17} />
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

        {/* ── Modern White + Green Upload Modal ───────────────────── */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg p-6 sm:p-8 rounded-3xl relative border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center border border-emerald-100">
                  <FileUp size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Upload Course Resource
                  </h2>
                  <p className="text-xs text-slate-500">
                    Directly uploads to AWS S3 & indexes for AI Chat
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Resource Title *
                  </label>
                  <input 
                    required 
                    type="text" 
                    placeholder="e.g. Unit 2 Tree Algorithms & AVL Balancing Notes"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
                    value={uploadData.title} 
                    onChange={e => setUploadData({ ...uploadData, title: e.target.value })} 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Semester
                    </label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      File Type *
                    </label>
                    <select 
                      required 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Target Subject *
                  </label>
                  <select 
                    required 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Description (optional)
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="Brief description of chapters or topics covered"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
                    value={uploadData.description} 
                    onChange={e => setUploadData({ ...uploadData, description: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Choose File *
                  </label>
                  <input 
                    type="file" 
                    required 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer border border-slate-200 rounded-xl p-2 bg-slate-50" 
                  />
                  {file && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      <FileCheck size={16} className="text-emerald-600 shrink-0" />
                      <span className="truncate">
                        Selected: <strong>{file.name}</strong> ({formatFileSize(file.size)})
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={uploading}
                    className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-2xl py-3.5 font-bold transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Uploading to S3...
                      </>
                    ) : (
                      'Upload & Publish to Students'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
