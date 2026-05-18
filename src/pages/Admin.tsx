import { useState, useEffect, FormEvent } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { auth, database } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Users, Calendar, Plus, Trash2, LogIn, Lock, Mail, Save, AlertTriangle, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { cn } from '../lib/utils';
import { Loader } from '../components/ui/Loader';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Types
interface LibraryStatus {
  capacity: number;
  occupancy: number;
  system_online: boolean;
}

interface Staff {
  id: string;
  name: string;
  is_present: boolean;
}

interface Announcement {
  id: string;
  text: string;
  createdAt: string;
}

interface Reservation {
  id: string;
  name: string;
  time: string;
  date?: string;
  is_used: boolean;
  otp: string;
  userId?: string;
  createdAt?: string;
}

export function Admin() {
  const { user, loading } = useAuth();
  
  const ALLOWED_ADMINS = ['admin@seatidle.com', 'genukakisara@gmail.com'];
  const isAdmin = user && ALLOWED_ADMINS.includes(user.email || '');

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Database State (Empty Defaults)
  const [status, setStatus] = useState<LibraryStatus>({
    capacity: 0,
    occupancy: 0,
    system_online: true
  });
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Edit State
  const [editCapacity, setEditCapacity] = useState('0');
  const [editOccupancy, setEditOccupancy] = useState('0');
  const [newStaffName, setNewStaffName] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'management' | 'reports'>('management');

  // Loading States
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);

  // Database Listeners
  useEffect(() => {
    if (!user || !isAdmin) return;

    // 1. Library Status
    const statusRef = ref(database, 'library_status');
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatus(data);
        setEditCapacity(data.capacity.toString());
        setEditOccupancy(data.occupancy.toString());
      }
    });

    // 2. Staff Presence
    const staffRef = ref(database, 'staff_presence');
    const unsubscribeStaff = onValue(staffRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        setStaffList(list);
      } else {
        setStaffList([]);
      }
    });

    // 3. active_reservations
    const resRef = ref(database, 'active_reservations');
    const unsubscribeRes = onValue(resRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        setReservations(list);
      } else {
        setReservations([]);
      }
    });

    // 4. announcements
    const annRef = ref(database, 'announcements');
    const unsubscribeAnn = onValue(annRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAnnouncements(list);
      } else {
        setAnnouncements([]);
      }
    });

    // 5. history
    const historyRef = ref(database, 'occupancy_history');
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ 
          timestamp: new Date(val.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          fullDate: val.timestamp,
          occupancy: val.occupancy 
        })).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
        
        // Take last 24 entries for a "recent" trend
        setHistoryData(list.slice(-24));
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeStaff();
      unsubscribeRes();
      unsubscribeAnn();
      unsubscribeHistory();
    };
  }, [user, isAdmin]);

  // History Logger logic
  useEffect(() => {
    if (!isAdmin || !status.occupancy) return;
    
    // Auto-log history every 30 mins or on manual update
    const lastLogTime = localStorage.getItem('last_history_log');
    const now = Date.now();
    
    if (!lastLogTime || (now - parseInt(lastLogTime)) > 1000 * 60 * 30) {
      const historyRef = ref(database, 'occupancy_history');
      push(historyRef, {
        timestamp: new Date().toISOString(),
        occupancy: status.occupancy
      });
      localStorage.setItem('last_history_log', now.toString());
    }
  }, [status.occupancy, isAdmin]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);
    const targetEmail = email.toLowerCase() === 'admin' ? 'admin@seatidle.com' : email;
    try {
      await signInWithEmailAndPassword(auth, targetEmail, password);
    } catch (err: any) {
      // Auto-create Admin account if requested credentials are the standard Admin/admin123
      if (
        (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') && 
        targetEmail === 'admin@seatidle.com' && 
        password === 'admin123'
      ) {
        try {
          await createUserWithEmailAndPassword(auth, 'admin@seatidle.com', 'admin123');
          return;
        } catch (createErr: any) {
          setAuthError(createErr.message);
          return;
        }
      }
      setAuthError(err.message || 'Failed to login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Gatekeeper logic
      const ALLOWED_ADMINS = ['admin@seatidle.com', 'genukakisara@gmail.com'];
      if (!ALLOWED_ADMINS.includes(user.email || '')) {
        setAuthError('Access Denied: You do not have administrator privileges.');
        await auth.signOut();
      }
    } catch (err: any) {
      setAuthError(err.message || 'Google Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const updateStatus = async () => {
    setIsUpdatingStatus(true);
    try {
      const statusRef = ref(database, 'library_status');
      const timestamp = new Date().toISOString();
      const newStatus = {
        capacity: parseInt(editCapacity) || 50,
        occupancy: parseInt(editOccupancy) || 0,
        system_online: true,
        last_updated: timestamp
      };
      await set(statusRef, newStatus);
      
      // Also log to history immediately on manual change
      const historyRef = ref(database, 'occupancy_history');
      await push(historyRef, {
        timestamp,
        occupancy: newStatus.occupancy
      });
      localStorage.setItem('last_history_log', Date.now().toString());

      alert('Status updated and logged successfully');
    } catch (err) {
      console.error("Update error:", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const toggleStaffPresence = async (id: string, current: boolean) => {
    try {
      const staffMemberRef = ref(database, `staff_presence/${id}`);
      await update(staffMemberRef, { is_present: !current });
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const addStaff = async () => {
    if (!newStaffName.trim()) return;
    setIsAddingStaff(true);
    try {
      const staffRef = ref(database, 'staff_presence');
      await push(staffRef, {
        name: newStaffName,
        is_present: false
      });
      setNewStaffName('');
    } catch (err) {
      console.error("Add staff error:", err);
    } finally {
      setIsAddingStaff(false);
    }
  };

  const deleteStaff = async (id: string) => {
    if (confirm('Are you sure you want to remove this staff member?')) {
      try {
        await remove(ref(database, `staff_presence/${id}`));
      } catch (err) {
        console.error("Delete staff error:", err);
      }
    }
  };

  const deleteReservation = async (id: string) => {
    if (confirm('Are you sure you want to delete this reservation?')) {
      try {
        await remove(ref(database, `active_reservations/${id}`));
      } catch (err) {
        console.error("Delete reservation error:", err);
      }
    }
  };

  const markReservationUsed = async (id: string) => {
    try {
      const resRef = ref(database, `active_reservations/${id}`);
      await update(resRef, { is_used: true });
    } catch (err) {
      console.error("Update reservation error:", err);
    }
  };

  const addAnnouncement = async () => {
    if (!announcementText.trim()) return;
    setIsAddingAnnouncement(true);
    try {
      const annRef = ref(database, 'announcements');
      await push(annRef, {
        text: announcementText,
        createdAt: new Date().toISOString()
      });
      setAnnouncementText('');
    } catch (err) {
      console.error("Add announcement error:", err);
    } finally {
      setIsAddingAnnouncement(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      await remove(ref(database, `announcements/${id}`));
    } catch (err) {
      console.error("Delete announcement error:", err);
    }
  };

  const confirmReset = async () => {
    try {
      await remove(ref(database, '/'));
      window.location.reload();
    } catch (err) {
      console.error("Reset error:", err);
    }
  };

  const resetData = () => {
    setShowResetDialog(true);
  };

  if (loading) return null;

  if (!user || !isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden shadow-brand-blue/5 dark:shadow-none transition-colors"
        >
          <div className="bg-brand-blue p-8 text-white">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Admin Portal</h2>
            <p className="text-brand-green text-sm mt-1 font-medium italic">Authorized personnel only</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {!isAdmin && user && (
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 font-medium mb-4">
                Logged in as {user.email}, but you don't have admin access. Please use an admin account.
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 block mb-1.5 tracking-widest ml-1">Username / Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue dark:focus:bg-slate-800 dark:text-slate-200 transition-all"
                    placeholder="Admin or name@library.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 block mb-1.5 tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue dark:focus:bg-slate-800 dark:text-slate-200 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {authError && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs p-3 rounded-xl border border-red-100 dark:border-red-900/30 font-medium leading-relaxed">
                {authError}
              </div>
            )}

            <button 
              disabled={isLoggingIn}
              className="w-full bg-brand-blue text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-blue/10 dark:shadow-none hover:bg-brand-blue/90 active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {isLoggingIn ? 'Verifying...' : 'Access Dashboard'}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest bg-white dark:bg-slate-900 px-4">
                Or Continue With
              </div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full flex justify-center items-center gap-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-bold text-sm shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
      {/* Tab Navigation */}
      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl w-fit mx-auto md:mx-0">
        <button
          onClick={() => setActiveTab('management')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center",
            activeTab === 'management' 
              ? "bg-white dark:bg-slate-700 text-brand-blue shadow-lg shadow-brand-blue/5" 
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          )}
        >
          <Settings className="w-3.5 h-3.5 mr-2" />
          Management
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center",
            activeTab === 'reports' 
              ? "bg-white dark:bg-slate-700 text-brand-blue shadow-lg shadow-brand-blue/5" 
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          )}
        >
          <BarChart3 className="w-3.5 h-3.5 mr-2" />
          Usage Reports
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'management' ? (
          <motion.div 
            key="management"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Seat Control */}
            <div className="lg:col-span-4 flex flex-col space-y-8 transition-colors">
              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-8 flex items-center">
                  <Settings className="w-4 h-4 mr-2 text-brand-green" />
                  Library Capacity
                </h3>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 block mb-1.5 tracking-widest ml-1">Total Capacity</label>
                      <input 
                        type="number"
                        value={editCapacity}
                        onChange={(e) => setEditCapacity(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-bold text-slate-700 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 block mb-1.5 tracking-widest ml-1">Manual Occupancy</label>
                      <input 
                        type="number"
                        value={editOccupancy}
                        onChange={(e) => setEditOccupancy(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-bold text-slate-700 dark:text-slate-200"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={updateStatus}
                    disabled={isUpdatingStatus}
                    className="w-full bg-brand-blue text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-blue/10 dark:shadow-none hover:bg-brand-blue/90 transition-all flex items-center justify-center group disabled:opacity-50"
                  >
                    {isUpdatingStatus ? <Loader size="sm" light className="mr-2" /> : <Save className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" /> }
                    Update Real-time Feed
                  </button>
                  
                  <button 
                    onClick={resetData}
                    className="w-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold py-3 rounded-2xl border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all text-xs flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Reset System Defaults
                  </button>
                </div>
              </section>

              {/* Add Staff Section */}
              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-6 flex items-center">
                  <Plus className="w-4 h-4 mr-2 text-brand-green" />
                  Register Staff
                </h3>
                <div className="flex gap-3">
                  <input 
                    type="text"
                    placeholder="Full Name"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue dark:text-slate-200 transition-all"
                  />
                  <button 
                    onClick={addStaff}
                    disabled={isAddingStaff}
                    className="bg-brand-blue/5 dark:bg-brand-blue/30 text-brand-blue dark:text-brand-green px-4 rounded-2xl font-bold text-xs hover:bg-brand-blue hover:text-white transition-all disabled:opacity-50 min-w-[80px] flex items-center justify-center"
                  >
                    {isAddingStaff ? <Loader size="sm" /> : 'ADD'}
                  </button>
                </div>
              </section>

              {/* New Announcement Section */}
              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-6 flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-brand-green" />
                  Post Announcement
                </h3>
                <div className="space-y-4">
                  <textarea 
                    rows={3}
                    placeholder="Type important notice for students..."
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue dark:text-slate-200 transition-all resize-none"
                  />
                  <button 
                    onClick={addAnnouncement}
                    disabled={isAddingAnnouncement}
                    className="w-full bg-brand-blue/5 dark:bg-brand-blue/30 text-brand-blue dark:text-brand-green py-3 rounded-2xl font-bold text-xs hover:bg-brand-blue hover:text-white transition-all disabled:opacity-50 flex items-center justify-center"
                  >
                    {isAddingAnnouncement ? <Loader size="sm" /> : 'POST NOTICE'}
                  </button>
                </div>

                {announcements.length > 0 && (
                  <div className="mt-8 space-y-4">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Active Notices</p>
                    <div className="space-y-3">
                      {announcements.map(ann => (
                        <div key={ann.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 relative group">
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pr-6">{ann.text}</p>
                          <button 
                            onClick={() => deleteAnnouncement(ann.id)}
                            className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Staff Table */}
            <div className="lg:col-span-8">
              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col transition-colors">
                <div className="p-8 pb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center">
                    <Users className="w-4 h-4 mr-2 text-brand-green" />
                    Personnel Management
                  </h3>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">
                      <tr>
                        <th className="px-8 py-4">Name</th>
                        <th className="px-8 py-4">Status</th>
                        <th className="px-8 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {staffList.map(staff => (
                        <tr key={staff.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs">
                                {staff.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{staff.name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter",
                              staff.is_present ? "bg-brand-green/10 dark:bg-brand-green/20 text-brand-green dark:text-brand-green" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500"
                            )}>
                              {staff.is_present ? 'Present' : 'Away'}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right flex items-center justify-end space-x-2">
                            <button 
                              onClick={() => toggleStaffPresence(staff.id, staff.is_present)}
                              className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                                staff.is_present ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10" : "text-brand-green hover:bg-brand-green/5 dark:hover:bg-brand-green/10"
                              )}
                            >
                              {staff.is_present ? 'Set Away' : 'Set Present'}
                            </button>
                            <button 
                              onClick={() => deleteStaff(staff.id)}
                              className="p-2 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
                              title="Remove Staff"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {staffList.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-8 py-12 text-center text-slate-400 dark:text-slate-600 text-xs italic font-medium">
                            No staff members registered.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reports"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Peak Occupancy</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black text-slate-800 dark:text-white">
                    {Math.max(...historyData.map(h => h.occupancy), 0)}
                  </p>
                  <TrendingUp className="w-8 h-8 text-brand-green opacity-20" />
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Avg. Occupancy</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black text-slate-800 dark:text-white">
                    {historyData.length > 0 
                      ? Math.round(historyData.reduce((acc, curr) => acc + curr.occupancy, 0) / historyData.length)
                      : 0}
                  </p>
                  <BarChart3 className="w-8 h-8 text-brand-blue opacity-20" />
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Total Samples</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black text-slate-800 dark:text-white">{historyData.length}</p>
                  <PieChart className="w-8 h-8 text-brand-blue opacity-20" />
                </div>
              </div>
            </div>

            <section className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 p-10 shadow-sm overflow-hidden min-h-[500px]">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-12">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Occupancy Trends</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Real-time usage analysis for the last 24 recorded points</p>
                </div>
                <div className="mt-4 md:mt-0 flex gap-2">
                  <span className="px-3 py-1.5 bg-brand-blue/10 text-brand-blue text-[10px] font-black uppercase tracking-widest rounded-full border border-brand-blue/20">Daily View</span>
                  <span className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-100 dark:border-slate-800">Weekly</span>
                </div>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData}>
                    <defs>
                      <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2D60FF" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2D60FF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="timestamp" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                        backgroundColor: '#FFF'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="occupancy" 
                      stroke="#2D60FF" 
                      strokeWidth={4} 
                      fillOpacity={1} 
                      fill="url(#colorOcc)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reservations Table (Visible only in management) */}
      {activeTab === 'management' && (
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="p-8 pb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-brand-green" />
              Active Reservations
            </h3>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">
                <tr>
                  <th className="px-8 py-4">Student</th>
                  <th className="px-8 py-4">Booking Date</th>
                  <th className="px-8 py-4">Time Slot</th>
                  <th className="px-8 py-4">OTP</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors">
                {reservations.map(res => (
                  <tr key={res.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-8 py-5 font-semibold text-slate-700 dark:text-slate-300 text-sm">{res.name}</td>
                    <td className="px-8 py-5 text-brand-blue dark:text-brand-green text-xs font-black">{res.date || 'N/A'}</td>
                    <td className="px-8 py-5 text-slate-500 dark:text-slate-500 text-xs font-medium">{res.time}</td>
                    <td className="px-8 py-5">
                      <span className="font-mono font-bold text-brand-blue dark:text-brand-green text-base tracking-widest">{res.otp}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter",
                        res.is_used ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 line-through" : "bg-brand-blue/10 dark:bg-brand-green/20 text-brand-blue dark:text-brand-green"
                      )}>
                        {res.is_used ? 'Arrived' : 'Awaiting'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right space-x-2">
                      {!res.is_used && (
                        <button 
                          onClick={() => markReservationUsed(res.id)}
                          className="p-2 text-brand-blue dark:text-brand-green hover:bg-brand-blue/5 dark:hover:bg-brand-green/10 rounded-xl transition-all"
                          title="Mark as Used"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => deleteReservation(res.id)}
                        className="p-2 text-red-400 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                        title="Cancel Booking"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {reservations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-slate-400 dark:text-slate-600 text-xs italic font-medium">
                      No active reservations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showResetDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetDialog(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 md:p-10 max-w-md w-full shadow-2xl"
            >
              <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 rounded-3xl flex items-center justify-center mb-8 mx-auto rotate-12">
                <AlertTriangle className="w-10 h-10 text-red-500 -rotate-12" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 text-center mb-4 tracking-tight">Factory Reset System?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-10 leading-relaxed font-medium px-4">
                This will permanently delete all staff records, student reservations, and notices. <span className="text-red-500 font-bold">This operation cannot be reversed.</span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setShowResetDialog(false)}
                  className="px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-[0.98]"
                >
                  Keep Data
                </button>
                <button
                  onClick={confirmReset}
                  className="px-6 py-4 rounded-2xl bg-red-600 text-white font-bold text-sm shadow-xl shadow-red-200 dark:shadow-none hover:bg-red-700 transition-all active:scale-[0.98]"
                >
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
