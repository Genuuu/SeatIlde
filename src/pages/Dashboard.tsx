import { useState, useEffect, FormEvent } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { auth, database } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Calendar, CheckCircle2, AlertCircle, Lock, Mail, UserPlus, LogIn } from 'lucide-react';
import { cn } from '../lib/utils';
import { Loader } from '../components/ui/Loader';

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
  is_used: boolean;
  otp: string;
  userId: string;
  createdAt: string;
}

export function Dashboard() {
  const { user } = useAuth();
  
  // Firebase State
  const [status, setStatus] = useState<LibraryStatus>({
    capacity: 50,
    occupancy: 0,
    system_online: true
  });
  
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  // Booking Form State
  const [bookingName, setBookingName] = useState('');
  const [bookingSlot, setBookingSlot] = useState('08:00 - 10:00');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  // Student Auth State
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const ALLOWED_ADMINS = ['admin@seatidle.com', 'genukakisara@gmail.com'];
  const isAdmin = user && ALLOWED_ADMINS.includes(user.email || '');

  // Real-time Listeners
  useEffect(() => {
    // 1. Library Status (from ESP32 / Admin)
    const statusRef = ref(database, 'library_status');
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setStatus(data);
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

    return () => {
      unsubscribeStatus();
      unsubscribeStaff();
      unsubscribeRes();
      unsubscribeAnn();
    };
  }, []);

  useEffect(() => {
    if (user && user.email) {
      setBookingName(user.email.split('@')[0]);
    }
  }, [user]);

  // Filter active reservations locally
  const activeReservations = reservations.filter(r => !r.is_used);
  const unusedResCount = activeReservations.length;
  const availableSeats = Math.max(0, status.capacity - status.occupancy - unusedResCount);
  const occupancyPercent = Math.round((status.occupancy / status.capacity) * 100);

  const handleBooking = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (!bookingName.trim()) return;

    setIsBooking(true);
    
    // Safety timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 10000)
    );

    try {
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const resRef = ref(database, 'active_reservations');
      const newRes = {
        name: bookingName,
        time: bookingSlot,
        date: bookingDate,
        is_used: false,
        otp,
        userId: user.uid,
        createdAt: new Date().toISOString()
      };
      
      // Use Promise.race to handle potential hangs
      await Promise.race([
        push(resRef, newRes),
        timeoutPromise
      ]);

      setBookingSuccess(otp);
      setBookingName(user.email?.split('@')[0] || '');
    } catch (error: any) {
      console.error("Booking error:", error);
      if (error.message === 'TIMEOUT') {
        alert("Connection timeout. Please check your internet and try again.");
      } else {
        alert("Failed to secure spot: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsBooking(false);
    }
  };

  const handleStudentAuth = async (e: FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError(null);
    const email = studentEmail.toLowerCase() === 'admin' ? 'admin@seatidle.com' : studentEmail;
    try {
      if (authMode === 'login') {
        try {
          await signInWithEmailAndPassword(auth, email, studentPassword);
        } catch (err: any) {
          // Auto-create Admin if it's the special credentials and it's missing
          if (
            (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') && 
            email === 'admin@seatidle.com' && 
            studentPassword === 'admin123'
          ) {
            await createUserWithEmailAndPassword(auth, email, studentPassword);
          } else {
            throw err;
          }
        }
      } else {
        await createUserWithEmailAndPassword(auth, email, studentPassword);
      }
      setShowAuth(false);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setShowAuth(false);
    } catch (err: any) {
      setAuthError(err.message || 'Google Login failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const presentStaff = staffList.filter(s => s.is_present);

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-10 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10">
      {/* Left Panel: Live Availability Hero */}
      <section className="col-span-1 md:col-span-12 lg:col-span-7 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200/60 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col items-center justify-center relative overflow-hidden p-8 md:p-16 min-h-[450px] md:min-h-[550px] transition-all">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-blue"></div>
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-brand-blue/5 dark:bg-brand-blue/10 rounded-full opacity-50 blur-[100px]"></div>
        <div className="absolute -left-10 -top-10 w-64 h-64 bg-brand-green/15 dark:bg-brand-green/20 rounded-full opacity-30 blur-[80px]"></div>

        {isAdmin && (
          <motion.a
            href="/admin"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-6 right-6 bg-brand-blue text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-blue/20 flex items-center hover:scale-105 transition-all z-20"
          >
            <Lock className="w-3 h-3 mr-2" />
            Admin Panel
          </motion.a>
        )}
        
        <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.25em] text-[10px] md:text-xs mb-8 z-10 transition-colors bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-100 dark:border-slate-800">
          Currently Available
        </p>
        
        <div className="flex items-baseline z-10">
          <motion.span 
            key={availableSeats}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-[140px] md:text-[200px] font-black leading-none text-brand-blue dark:text-white tracking-tighter transition-colors"
          >
            {availableSeats}
          </motion.span>
          <span className="text-2xl md:text-5xl font-black text-slate-200 dark:text-slate-800 ml-4 mb-4 md:mb-8">
            / {status?.capacity || 0}
          </span>
        </div>

        <div className="w-full md:w-3/4 mt-12 md:mt-16 z-10 px-4 md:px-0">
          <div className="flex justify-between text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-widest">
            <span>Library Occupancy</span>
            <span className={cn(
              "font-mono",
              occupancyPercent > 90 ? "text-red-500" : occupancyPercent > 70 ? "text-amber-500" : "text-brand-green"
            )}>{occupancyPercent}%</span>
          </div>
          <div className="h-5 w-full bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden p-1 shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${occupancyPercent}%` }}
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out shadow-sm",
                occupancyPercent > 90 ? "bg-red-500" : occupancyPercent > 70 ? "bg-amber-500" : "bg-brand-green"
              )}
            ></motion.div>
          </div>
        </div>

        <div className="mt-12 md:mt-20 grid grid-cols-3 gap-8 md:gap-16 text-center z-10">
          <div className="group">
            <p className="text-slate-400 dark:text-slate-500 text-[10px] md:text-xs uppercase font-bold tracking-widest mb-2 transition-colors group-hover:text-brand-blue">Occupied</p>
            <p className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">{status?.occupancy || 0}</p>
          </div>
          <div className="w-px h-12 bg-slate-100 dark:bg-slate-800 self-center"></div>
          <div className="group">
            <p className="text-slate-400 dark:text-slate-500 text-[10px] md:text-xs uppercase font-bold tracking-widest mb-2 transition-colors group-hover:text-brand-blue">Reserved</p>
            <p className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">{unusedResCount}</p>
          </div>
          <div className="w-px h-12 bg-slate-100 dark:bg-slate-800 self-center"></div>
          <div className="group">
            <p className="text-slate-400 dark:text-slate-500 text-[10px] md:text-xs uppercase font-bold tracking-widest mb-2 transition-colors group-hover:text-brand-blue">Total</p>
            <p className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">{status?.capacity || 0}</p>
          </div>
        </div>
      </section>

      {/* Right Panel: Info & Reservation */}
      <div className="col-span-1 md:col-span-12 lg:col-span-5 flex flex-col space-y-6 md:space-y-10">
        
        {/* Announcements Section */}
        {announcements.length > 0 && (
          <section className="bg-amber-50/50 dark:bg-amber-950/10 rounded-[32px] border border-amber-100/50 dark:border-amber-900/20 p-6 md:p-10 shadow-sm transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <h3 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.25em] mb-8 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              Pulse: Latest Notices
            </h3>
            <div className="space-y-4">
              {announcements.slice(0, 2).map((ann, idx) => (
                <div key={ann.id} className={cn(
                  "p-5 rounded-3xl border transition-all",
                  idx === 0 ? "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800 shadow-[0_4px_20px_rgb(0,0,0,0.03)]" : "bg-transparent border-transparent"
                )}>
                  <p className={cn(
                    "text-sm leading-relaxed",
                    idx === 0 ? "text-slate-800 dark:text-slate-100 font-bold" : "text-slate-500 dark:text-slate-400 font-medium"
                  )}>
                    {ann.text}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 mt-3 uppercase tracking-widest">
                    {new Date(ann.createdAt).toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' })} • {new Date(ann.createdAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Staff Section */}
        <section className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/60 dark:border-slate-800 p-6 md:p-10 shadow-sm flex-1 transition-colors relative overflow-hidden">
          <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] mb-8 flex items-center">
            <div className="w-1.5 h-6 bg-brand-green mr-3 rounded-full"></div>
            Staff Presence
          </h3>
          <div className="space-y-4">
            {presentStaff.length > 0 ? (
              presentStaff.map(staff => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={staff.id} 
                  className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 transition-colors hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-blue text-white flex items-center justify-center font-black text-xs shadow-md shadow-brand-blue/10">
                      {staff.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{staff.name}</p>
                      <p className="text-[10px] text-brand-green font-bold uppercase tracking-widest mt-0.5">Online Helper</p>
                    </div>
                  </div>
                  <div className="w-2.5 h-2.5 bg-brand-green rounded-full shadow-[0_0_8px_var(--color-brand-green)]"></div>
                </motion.div>
              ))
            ) : (
              <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 transition-colors">
                <Users className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-400 dark:text-slate-600 font-bold tracking-tight">Personnel are currently mobile</p>
              </div>
            )}
          </div>
        </section>

        {/* Reservation Section */}
        <section className="bg-brand-blue dark:bg-[#0a3551] rounded-[40px] p-8 md:p-12 text-white shadow-2xl shadow-brand-blue/20 relative overflow-hidden transition-all group">
          <div className="absolute -right-16 -top-16 w-48 h-48 bg-white/5 rounded-full blur-3xl transition-all group-hover:scale-110"></div>
          <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-brand-green/10 rounded-full blur-2xl transition-all group-hover:scale-110"></div>
          
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-10 flex items-center text-brand-green">
            <div className="w-1.5 h-6 bg-brand-green mr-4 rounded-full"></div>
            Reserve Your Space
          </h3>

          <AnimatePresence mode="wait">
            {bookingSuccess ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[32px] p-10 text-center"
              >
                <div className="w-16 h-16 bg-brand-green rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-green/20 rotate-6">
                  <CheckCircle2 className="w-8 h-8 text-white -rotate-6" />
                </div>
                <h4 className="text-2xl font-black mb-2 uppercase tracking-tight">Access Granted</h4>
                <p className="text-brand-green/80 text-sm font-bold mb-8">Valid for your selected time-slot</p>
                <div className="bg-white px-10 py-5 rounded-3xl inline-block shadow-2xl">
                  <span className="text-4xl font-mono font-black text-brand-blue tracking-[0.5em]">{bookingSuccess}</span>
                </div>
                <button 
                  onClick={() => setBookingSuccess(null)}
                  className="w-full mt-8 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                >
                  Confirm & Close
                </button>
              </motion.div>
            ) : !user || showAuth ? (
              <motion.div 
                key="auth"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white/10 p-6 rounded-[32px] border border-white/20 text-center backdrop-blur-sm">
                  <p className="text-sm font-bold text-brand-green mb-6 px-4">
                    Sign in to manage your reservations and view exclusive library insights.
                  </p>
                  <div className="flex bg-white/10 rounded-2xl p-1.5 mb-6">
                    <button 
                      onClick={() => setAuthMode('login')}
                      className={cn(
                        "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                        authMode === 'login' ? "bg-white text-brand-blue shadow-lg" : "text-white/60 hover:text-white"
                      )}
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => setAuthMode('signup')}
                      className={cn(
                        "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                        authMode === 'signup' ? "bg-white text-brand-blue shadow-lg" : "text-white/60 hover:text-white"
                      )}
                    >
                      Sign Up
                    </button>
                  </div>

                  <form onSubmit={handleStudentAuth} className="space-y-4">
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input 
                        type="text" 
                        required
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        placeholder="Admin or University Email"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-green/50 transition-all font-medium"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input 
                        type="password" 
                        required
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-green/50 transition-all font-medium"
                      />
                    </div>
                    {authError && (
                      <motion.p 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-red-400 text-[10px] font-black uppercase tracking-widest bg-red-400/10 py-2 rounded-lg"
                      >
                        {authError}
                      </motion.p>
                    )}
                    <button 
                      disabled={isAuthenticating}
                      className="w-full bg-brand-green text-white font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] transition-all hover:bg-brand-green/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand-green/20 disabled:opacity-50 flex items-center justify-center"
                    >
                      {isAuthenticating ? <Loader size="sm" light className="mr-2" /> : null}
                      {authMode === 'login' ? 'Access Account' : 'Initialize Profile'}
                    </button>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10"></div>
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase font-black text-white/30 tracking-[0.4em]">
                        <span className="bg-brand-blue px-4">Cloud Auth</span>
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isAuthenticating}
                      className="w-full flex justify-center items-center gap-3 bg-white text-slate-800 rounded-2xl px-5 py-4 hover:bg-white/95 transition-all font-black text-xs shadow-xl active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest"
                    >
                      {isAuthenticating ? <Loader size="sm" className="mr-1" /> : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      Google Sync
                    </button>
                  </form>
                </div>
              </motion.div>
            ) : (
              <motion.form 
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleBooking} 
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-brand-green block mb-2 px-1 tracking-[0.2em]">Full Student Name</label>
                    <input 
                      type="text" 
                      required
                      value={bookingName}
                      onChange={(e) => setBookingName(e.target.value)}
                      placeholder="e.g. John Doe" 
                      className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4.5 text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-brand-green block mb-2 px-1 tracking-[0.2em]">Booking Date</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        required
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/40 cursor-pointer font-bold transition-all hover:bg-white/10 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-brand-green block mb-2 px-1 tracking-[0.2em]">Preferred Window</label>
                    <div className="relative">
                      <select 
                        value={bookingSlot}
                        onChange={(e) => setBookingSlot(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/40 appearance-none cursor-pointer font-bold transition-all hover:bg-white/10"
                      >
                        <option className="text-slate-800" value="08:00 - 10:00">Session A: 08:00 - 10:00</option>
                        <option className="text-slate-800" value="10:00 - 12:00">Session B: 10:00 - 12:00</option>
                        <option className="text-slate-800" value="12:00 - 14:00">Session C: 12:00 - 14:00</option>
                        <option className="text-slate-800" value="14:00 - 16:00">Session D: 14:00 - 16:00</option>
                        <option className="text-slate-800" value="16:00 - 18:00">Session E: 16:00 - 18:00</option>
                      </select>
                      <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                </div>
                
                <button 
                  disabled={isBooking}
                  className={cn(
                    "w-full bg-white text-brand-blue font-black py-5 rounded-[24px] text-xs uppercase tracking-[0.3em] transition-all hover:bg-brand-green hover:text-white hover:scale-[1.02] shadow-2xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center",
                  )}
                >
                  {isBooking ? <Loader size="sm" className="mr-2" /> : null}
                  {isBooking ? 'Securing Spot...' : 'Confirm Reservation'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {user && !bookingSuccess && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-12 pt-10 border-t border-white/10"
            >
              <h4 className="text-[10px] font-black uppercase text-brand-green mb-6 tracking-[0.3em] flex items-center">
                <div className="w-1 h-4 bg-brand-green mr-3 rounded-full"></div>
                Active Reservations
              </h4>
              <div className="space-y-4">
                {reservations.filter(r => r.userId === user.uid && !r.is_used).length > 0 ? (
                  reservations.filter(r => r.userId === user.uid && !r.is_used).map(res => (
                    <div key={res.id} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-3xl p-5 flex items-center justify-between transition-all hover:bg-white/15">
                      <div>
                        <p className="text-xs font-black text-white">{res.date} • {res.time}</p>
                        <p className="text-[10px] text-brand-green font-mono font-bold tracking-[0.2em] mt-1.5 bg-brand-green/10 inline-block px-2 py-0.5 rounded-lg border border-brand-green/20 uppercase">
                          OTP: {res.otp}
                        </p>
                      </div>
                      <button 
                        onClick={async () => {
                          if(confirm('Cancel this booking?')) {
                            try {
                              await remove(ref(database, `active_reservations/${res.id}`));
                            } catch (err) {
                              console.error("Delete error:", err);
                            }
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-[9px] font-black text-red-400 hover:bg-red-500 hover:text-white rounded-xl uppercase tracking-widest transition-all"
                      >
                        Revoke
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-white/30 italic font-medium tracking-tight">No active reservations found under your profile.</p>
                )}
              </div>
            </motion.div>
          )}

          {(!bookingSuccess && user) && (
             <div className="mt-10 flex items-start space-x-4 bg-white/5 p-5 rounded-3xl border border-white/10 backdrop-blur-sm">
              <AlertCircle className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-white/60 leading-relaxed font-bold tracking-tight">
                NOTICE: Seat Reservations are legally reserved for University Members. Misuse may result in profile suspension.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
