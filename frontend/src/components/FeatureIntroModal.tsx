'use client';
import { useState, useEffect } from 'react';
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
  SlidersHorizontal
} from 'lucide-react';

interface FeatureIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  userName?: string;
}

export default function FeatureIntroModal({
  isOpen,
  onClose,
  userRole = 'student',
  userName = 'Student',
}: FeatureIntroModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState<'slides' | 'grid'>('slides');

  const isStudent = userRole.toLowerCase() === 'student';

  // Mark tour as completed in localStorage on close
  const handleDismiss = () => {
    try {
      localStorage.setItem('campusflow_tour_completed', 'true');
      localStorage.removeItem('campusflow_show_welcome_tour');
    } catch (e) {}
    onClose();
  };

  const studentFeatures = [
    {
      id: 'materials',
      icon: BookOpen,
      tag: 'Study Materials',
      title: 'Course Notes & Lecture Slides',
      subtitle: 'Instant access to faculty study materials stored on AWS S3',
      description:
        'All your syllabus notes, lecture presentations, past exam papers, and question banks are organized by semester and subject. View document sizes, format tags (PDF, PPT, DOC), and download files with one click.',
      tips: [
        'Filter notes by semester tabs (Sem 1 to 8)',
        'Use the top search bar to find any topic instantly',
        'Official faculty verified badge on trusted materials'
      ],
      badgeColor: 'bg-emerald-50 text-[#059669] border-emerald-200',
    },
    {
      id: 'classroom',
      icon: MessageSquare,
      tag: 'Real-Time Channels',
      title: 'Semester Class Discussion Channels',
      subtitle: 'Live WebSocket group chats and one-click video meetings',
      description:
        'Connect directly with classmates and faculty in your enrolled semester. Clear doubts in real-time, collaborate on assignments, enhance questions using the AI polish button, or join scheduled Class Video Meets.',
      tips: [
        'Secure: Channels are strictly scoped to your semester',
        'AI Polish: Click the magic wand icon to rephrase messages professionally',
        'Video Meets: Launch Jitsi class meetings directly from the chat header'
      ],
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    {
      id: 'ai',
      icon: Bot,
      tag: 'CampusFlow AI',
      title: 'Dual-Mode Academic AI Assistant',
      subtitle: 'Syllabus Notes RAG + Online General Intelligence',
      description:
        'Meet your 24/7 study companion. Switch between Notes RAG Mode (answers questions strictly from your professors’ uploaded syllabus notes) and General AI Mode (explains complex concepts, code, and practice quizzes).',
      tips: [
        'Subject Notes RAG: Queries only verified course PDFs',
        'General AI: Deep conceptual explanations & quiz generation',
        'Saved History: Easily review past AI explanations anytime'
      ],
      badgeColor: 'bg-emerald-50 text-[#059669] border-emerald-200',
    },
    {
      id: 'notices',
      icon: Bell,
      tag: 'Notice Board',
      title: 'Official Circulars & Announcements',
      subtitle: 'Never miss important college deadlines or notifications',
      description:
        'Stay up to date with official college broadcasts, semester exam timetables, fee notifications, and holiday circulars. Filter between College-Wide announcements and specific semester updates.',
      tips: [
        'Filter by "My Semester" for relevant departmental circulars',
        'Mark announcements as read with the checkmark button',
        'Instant notifications when new circulars are published'
      ],
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    },
  ];

  const facultyFeatures = [
    {
      id: 'upload',
      icon: UploadCloud,
      tag: 'Media Manager',
      title: 'Direct S3 Course Resource Publishing',
      subtitle: 'Distribute syllabus notes, slides, and question papers',
      description:
        'Upload course materials directly to secure AWS S3 storage. Assign documents to specific semesters and subjects. Uploaded PDFs are automatically processed and indexed for students’ AI study queries.',
      tips: [
        'Supports PDF, PPT, Word DOC, and Diagram formats',
        'Direct S3 upload with automatic server fallback',
        'Real-time student download and view tracking'
      ],
      badgeColor: 'bg-emerald-50 text-[#059669] border-emerald-200',
    },
    {
      id: 'classroom',
      icon: MessageSquare,
      tag: 'Office Hours',
      title: 'Class Channels & Instant Mentorship',
      subtitle: 'Engage with students across all semester streams',
      description:
        'Join any semester discussion channel to answer doubts, share class reminders, and maintain academic dialogue. Launch audio/video sessions on demand using the built-in Class Video Meet.',
      tips: [
        'Filter channels by Semester 1 through 8',
        'Faculty badge highlights your answers for students',
        'One-click Jitsi video conference for office hours'
      ],
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    {
      id: 'broadcast',
      icon: Bell,
      tag: 'Broadcasts',
      title: 'Publish College & Department Notices',
      subtitle: 'Official announcements delivered instantly to students',
      description:
        'Publish official circulars, exam schedules, and submission deadlines. Target notifications to an individual semester or broadcast college-wide to all enrolled students.',
      tips: [
        'Target specific semester or broadcast to all students',
        'Edit or delete announcements anytime',
        'High visibility banner for urgent notices'
      ],
      badgeColor: 'bg-emerald-50 text-[#059669] border-emerald-200',
    },
    {
      id: 'analytics',
      icon: Layers,
      tag: 'Faculty Dashboard',
      title: 'Teaching Analytics & Resource Insights',
      subtitle: 'Track engagement across your published course notes',
      description:
        'Monitor active students, views today, and total downloads across your study materials. Quick navigation shortcuts help you manage your course content with zero friction.',
      tips: [
        'Real-time view counter on all course materials',
        'Manage and delete old resources in "My Uploads"',
        'Quick access to student classrooms from your navbar'
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
              Explore the key features designed to power your academic journey.
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            title="Skip Tour"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── View Mode Switcher (Slide by Slide vs All at a Glance) ── */}
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
              Step {currentStep + 1} of {totalSteps}
            </span>
          )}
        </div>

        {/* ── Modal Body: Slide Mode ───────────────────────────────── */}
        {viewMode === 'slides' ? (
          <div className="p-6 sm:p-7 space-y-6">
            {(() => {
              const feat = features[currentStep];
              const Icon = feat.icon;

              return (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                  {/* Feature Icon & Title */}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-[#059669] shrink-0 shadow-xs">
                      <Icon size={28} />
                    </div>
                    <div>
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${feat.badgeColor} mb-1`}>
                        {feat.tag}
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                        {feat.title}
                      </h3>
                      <p className="text-xs font-medium text-emerald-700 mt-0.5">
                        {feat.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Main Description */}
                  <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    {feat.description}
                  </p>

                  {/* Quick Tips List */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      💡 Pro Tips:
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
              {features.map((feat, i) => {
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
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
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
                  onClick={handleDismiss}
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
                    onClick={handleDismiss}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition"
                  >
                    <span>Get Started! 🚀</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end gap-3">
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition text-center"
              >
                Got It! Take Me to Dashboard 🚀
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
