'use client';
import { useState } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  MessageSquare, 
  Bot, 
  Bell, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  X, 
  UploadCloud, 
  Video, 
  GraduationCap, 
  ShieldCheck, 
  Layers, 
  FileText,
  HelpCircle,
  LayoutGrid,
  SlidersHorizontal,
  Wand2,
  Smartphone,
  Cpu
} from 'lucide-react';

interface FeatureIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  userName?: string;
  customActionText?: string;
  onActionClick?: () => void;
}

export default function FeatureIntroModal({
  isOpen,
  onClose,
  userRole = 'student',
  userName = 'Student',
  customActionText,
  onActionClick,
}: FeatureIntroModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState<'slides' | 'grid'>('slides');

  const isStudent = (userRole || 'student').toLowerCase() === 'student';

  const handleFinish = () => {
    try {
      localStorage.setItem('campusflow_tour_completed', 'true');
      localStorage.removeItem('campusflow_show_welcome_tour');
    } catch (e) {}
    if (onActionClick) {
      onActionClick();
    } else {
      onClose();
    }
  };

  const studentFeatures = [
    {
      id: 'rag_ai',
      icon: Bot,
      tag: 'AI RAG Chatbot',
      title: 'Syllabus RAG Chatbot (CampusFlow AI)',
      subtitle: 'Ask questions directly to your textbooks & faculty lecture notes!',
      badgeIcon: Cpu,
      description:
        'This is our intelligent RAG (Retrieval-Augmented Generation) Chatbot. Unlike standard chatbots that make up answers, our RAG Chatbot indexes every single lecture note and syllabus PDF uploaded by your professors. When you ask a question about your subject, it retrieves the exact sections from your course notes and generates verified, curriculum-accurate answers with zero hallucinations! You can also switch to General AI mode anytime for coding help, problem solving, and practice quizzes.',
      tips: [
        'Notes RAG Mode: Answers strictly from faculty-uploaded course materials and textbooks',
        'Subject Selection: Target your questions to your exact semester syllabus',
        'General AI Mode: Explains code, math solutions, and complex concepts online',
        'Saved History: Your past discussions and AI explanations are saved automatically'
      ],
      badgeColor: 'bg-emerald-50 text-[#059669] border-emerald-200',
    },
    {
      id: 'classroom_whatsapp',
      icon: MessageSquare,
      tag: 'WhatsApp-Style Chat',
      title: 'Classroom Channels (College "WhatsApp")',
      subtitle: 'Real-time group discussion channels for every semester & subject',
      badgeIcon: Smartphone,
      description:
        'Think of this as your official college WhatsApp, but organized cleanly for your academic coursework! Every semester and subject has a dedicated live discussion group. Students and professors chat in real-time using fast WebSockets. Clear doubts with your teachers, polish questions professionally using the AI Wand, and start or join Class Video Meetings with 1 click.',
      tips: [
        'WhatsApp Experience: Instant messaging, sender badges, and live WebSocket connection dot',
        'Semester Privacy: Channels are strictly restricted to students enrolled in that semester',
        'AI Message Polish: Click the magic wand icon to automatically rephrase questions professionally',
        '1-Click Class Video Meet: Launch Jitsi video meetings directly from the room header'
      ],
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    {
      id: 'materials_s3',
      icon: BookOpen,
      tag: 'Cloud Materials',
      title: 'Course Notes & Lecture Slides on AWS S3',
      subtitle: 'High-speed cloud downloads for syllabus notes, slides, and papers',
      badgeIcon: BookOpen,
      description:
        'All your course study materials are securely hosted on high-performance AWS S3 cloud storage. Browse notes organized by Semester 1 to 8, search by topic or professor, preview file types (PDF, PPT, DOC, IMG), and download files with one click.',
      tips: [
        'Semester Filter: Quickly switch between Semester 1 through 8',
        'Search Bar: Instant keyword search across all subjects and professors',
        'Verified Materials: Official checkmarks indicate faculty-approved resources'
      ],
      badgeColor: 'bg-emerald-50 text-[#059669] border-emerald-200',
    },
    {
      id: 'notices',
      icon: Bell,
      tag: 'Official Notices',
      title: 'Campus Announcements & Exam Timetables',
      subtitle: 'Verified broadcast notifications delivered directly to your feed',
      badgeIcon: Bell,
      description:
        'Never miss exam schedules, fee payment dates, holiday notices, or departmental announcements. Filter circulars by "My Semester" or view campus-wide updates.',
      tips: [
        'Filter by "My Semester" for announcements relevant only to your batch',
        'Mark notices as read or review circular history anytime'
      ],
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    },
  ];

  const facultyFeatures = [
    {
      id: 'rag_indexing',
      icon: UploadCloud,
      tag: 'RAG Knowledge Base',
      title: 'Course Material Uploads & RAG AI Indexing',
      subtitle: 'Upload lecture PDFs directly to AWS S3 & auto-feed the RAG Chatbot',
      badgeIcon: Cpu,
      description:
        'Upload course materials directly to secure AWS S3 storage. Assign documents to specific semesters and subjects. Uploaded PDFs are automatically chunked, embedded, and indexed into the RAG vector store so the CampusFlow AI Chatbot can accurately answer your students’ questions based on your exact syllabus!',
      tips: [
        'Auto RAG Indexing: PDFs are immediately searchable by student AI queries',
        'Supports PDF, PPT, Word DOC, and Diagram formats',
        'Direct S3 upload with automatic server fallback and view tracking'
      ],
      badgeColor: 'bg-emerald-50 text-[#059669] border-emerald-200',
    },
    {
      id: 'faculty_whatsapp',
      icon: MessageSquare,
      tag: 'WhatsApp-Style Channels',
      title: 'Class Channels & Instant Doubt Mentorship',
      subtitle: 'WhatsApp-like live discussion channels with verified faculty badge',
      badgeIcon: Smartphone,
      description:
        'Join any semester discussion channel to answer student doubts, post quick reminders, and hold academic discussions in real-time. Answers you send display a verified Faculty badge. Launch video office hours with 1 click.',
      tips: [
        'Filter channels by Semester 1 through 8',
        'Verified Professor Badge highlights your messages for students',
        'One-click Jitsi video conference for office hours'
      ],
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    {
      id: 'faculty_notices',
      icon: Bell,
      tag: 'Broadcasts',
      title: 'Publish College & Department Notices',
      subtitle: 'Official announcements delivered instantly to students',
      badgeIcon: Bell,
      description:
        'Publish official circulars, exam schedules, and submission deadlines. Target notifications to an individual semester or broadcast college-wide to all enrolled students.',
      tips: [
        'Target specific semester or broadcast to all students',
        'Edit or delete announcements anytime'
      ],
      badgeColor: 'bg-emerald-50 text-[#059669] border-emerald-200',
    },
    {
      id: 'faculty_analytics',
      icon: Layers,
      tag: 'Analytics',
      title: 'Teaching Analytics & Resource Insights',
      subtitle: 'Track engagement across your published course notes',
      badgeIcon: Layers,
      description:
        'Monitor active students, views today, and total downloads across your study materials. Quick navigation shortcuts help you manage your course content with zero friction.',
      tips: [
        'Real-time view counter on all course materials',
        'Manage and delete old resources in "My Uploads"'
      ],
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    },
  ];

  const features = isStudent ? studentFeatures : facultyFeatures;
  const totalSteps = features.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-2xl w-full max-w-2xl relative overflow-hidden my-6">
        {/* Top Emerald Gradient Accent Bar */}
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#059669] via-emerald-500 to-teal-400" />

        {/* ── Modal Header ─────────────────────────────────────────── */}
        <div className="p-6 sm:p-7 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[#059669] text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={13} className="text-[#059669]" />
              <span>CampusFlow Platform Guide</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-800">{isStudent ? 'Student Edition' : 'Faculty Edition'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Welcome, {userName}! 👋
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Here is how our <strong>Syllabus RAG Chatbot</strong>, <strong>WhatsApp-like Classrooms</strong>, and study tools work.
            </p>
          </div>

          <button
            onClick={handleFinish}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            title="Skip Tour"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── View Mode Switcher ───────────────────────────────────── */}
        <div className="px-6 sm:px-7 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setViewMode('slides')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'slides'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Step-by-Step</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={13} />
              <span>All Features</span>
            </button>
          </div>

          {viewMode === 'slides' && (
            <span className="text-xs font-bold text-slate-400">
              Feature {currentStep + 1} of {totalSteps}
            </span>
          )}
        </div>

        {/* ── Modal Body: Slide Mode ───────────────────────────────── */}
        {viewMode === 'slides' ? (
          <div className="p-6 sm:p-7 space-y-6">
            {(() => {
              const feat = features[currentStep];
              const Icon = feat.icon;
              const BadgeIcon = feat.badgeIcon || Icon;

              return (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                  {/* Feature Icon & Title */}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-[#059669] shrink-0 shadow-xs">
                      <Icon size={28} />
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${feat.badgeColor} mb-1`}>
                        <BadgeIcon size={12} />
                        <span>{feat.tag}</span>
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                        {feat.title}
                      </h3>
                      <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                        {feat.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Main Description */}
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    {feat.description}
                  </p>

                  {/* Quick Tips List */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      💡 How to use this feature:
                    </p>
                    <div className="space-y-1.5">
                      {feat.tips.map((tip, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                          <CheckCircle2 size={15} className="text-[#059669] shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Slide Progression Dots */}
            <div className="flex items-center justify-center gap-2 pt-2">
              {features.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentStep === i 
                      ? 'w-8 bg-[#059669]' 
                      : 'w-2 bg-slate-200 hover:bg-slate-300'
                  }`}
                  title={`Go to feature ${i + 1}`}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ── Modal Body: Grid Mode (All Features) ───────────────── */
          <div className="p-6 sm:p-7 max-h-[60vh] overflow-y-auto space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div 
                    key={feat.id} 
                    className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-emerald-200 hover:shadow-xs transition space-y-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center shrink-0 border border-emerald-100">
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase">
                          {feat.tag}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 truncate">
                          {feat.title}
                        </h4>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {feat.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Modal Footer Controls ────────────────────────────────── */}
        <div className="p-5 sm:p-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
          {viewMode === 'slides' ? (
            <>
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                disabled={currentStep === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowLeft size={14} />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
                >
                  Skip Tour
                </button>

                {currentStep < totalSteps - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => Math.min(totalSteps - 1, prev + 1))}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition"
                  >
                    <span>Next Feature</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinish}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition"
                  >
                    <span>{customActionText || 'Get Started! 🚀'}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end gap-3">
              <button
                type="button"
                onClick={handleFinish}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition text-center"
              >
                {customActionText || 'Got It! Take Me to Dashboard 🚀'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
