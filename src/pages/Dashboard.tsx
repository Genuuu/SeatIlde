import { useState, useEffect, FormEvent } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Calendar, CheckCircle2, AlertCircle, Lock, Mail, UserPlus, LogIn } from 'lucide-react';
import { cn } from '../lib/utils';

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
  
  // Local State (Mocking Database)
  const [status, setStatus] = useState<LibraryStatus>({
    capacity: 50,
    occupancy: 12,
    system_online: true
  });
  
  const [staffList, setStaffList] = useState<Staff[]>([
    { id: '1', name: 'Mr. Perera', is_present: true },
    { id: '2', name: 'Ms. Silva', is_present: false }
  ]);
  
  const [reservations, setReservations] = useState<Reservation[]>([]);
  
  // Booking Form State
  const [bookingName, setBookingName] = useState('');
  const [bookingSlot, setBookingSlot] = useState('08:00 - 10:00');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  // Student Auth State
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Load from LocalStorage
  useEffect(() => {
    const savedStatus = localStorage.getItem('seatidle_status');
    const savedStaff = localStorage.getItem('seatidle_staff');
    const savedRes = localStorage.getItem('seatidle_reservations');

    if (savedStatus) setStatus(JSON.parse(savedStatus));
    if (savedStaff) setStaffList(JSON.parse(savedStaff));
    if (savedRes) setReservations(JSON.parse(savedRes));

    // Listen for changes from Admin panel (Cross-tab sync for demo)
    const handleStorageChange = () => {
      const s = localStorage.getItem('seatidle_status');
      const st = localStorage.getItem('seatidle_staff');
      const rs = localStorage.getItem('seatidle_reservations');
      if (s) setStatus(JSON.parse(s));
      if (st) setStaffList(JSON.parse(st));
      if (rs) setReservations(JSON.parse(rs));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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
    try {
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const newRes: Reservation = {
        id: Date.now().toString(),
        name: bookingName,
        time: bookingSlot,
        is_used: false,
        otp,
        userId: user.uid,
        createdAt: new Date().toISOString()
      };
      
      const updated = [...reservations, newRes];
      setReservations(updated);
      localStorage.setItem('seatidle_reservations', JSON.stringify(updated));

      setBookingSuccess(otp);
      setBookingName(user.email?.split('@')[0] || '');
      setTimeout(() => setBookingSuccess(null), 10000);
    } catch (error) {
      console.error("Booking error:", error);
    } finally {
      setIsBooking(false);
    }
  };

  const handleStudentAuth = async (e: FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, studentEmail, studentPassword);
      } else {
        await createUserWithEmailAndPassword(auth, studentEmail, studentPassword);
      }
      setShowAuth(false);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const presentStaff = staffList.filter(s => s.is_present);

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
      {/* Left Panel: Live Availability Hero */}
      <section className="col-span-1 md:col-span-12 lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center relative overflow-hidden p-8 md:p-12 min-h-[450px] md:min-h-[500px] transition-colors">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-50 dark:bg-indigo-900/10 rounded-full opacity-50 blur-3xl"></div>
        
        <p className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-[0.2em] text-xs md:sm mb-6 z-10 transition-colors">Currently Available</p>
        
        <div className="flex items-baseline z-10">
          <motion.span 
            key={availableSeats}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-[120px] md:text-[180px] font-black leading-none text-indigo-600 dark:text-indigo-500 tracking-tighter transition-colors"
          >
            {availableSeats}
          </motion.span>
          <span className="text-2xl md:text-4xl font-bold text-slate-300 dark:text-slate-700 ml-4">
            / {status?.capacity || 0}
          </span>
        </div>

        <div className="w-full md:w-2/3 mt-10 md:mt-12 z-10 px-4 md:px-0">
          <div className="flex justify-between text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">
            <span>Occupancy</span>
            <span>{occupancyPercent}% Full</span>
          </div>
          <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${occupancyPercent}%` }}
              className={cn(
                "h-full rounded-full transition-all duration-500",
                occupancyPercent > 90 ? "bg-red-500" : occupancyPercent > 70 ? "bg-amber-500" : "bg-indigo-600"
              )}
            ></motion.div>
          </div>
        </div>

        <div className="mt-12 md:mt-16 grid grid-cols-3 gap-6 md:gap-12 text-center z-10">
          <div>
            <p className="text-slate-400 dark:text-slate-500 text-[9px] md:text-xs uppercase font-bold tracking-widest mb-1">Occupied</p>
            <p className="text-xl md:text-2xl font-bold text-slate-700 dark:text-slate-200">{status?.occupancy || 0}</p>
          </div>
          <div className="w-px h-10 bg-slate-200 dark:bg-slate-800 self-center"></div>
          <div>
            <p className="text-slate-400 dark:text-slate-500 text-[9px] md:text-xs uppercase font-bold tracking-widest mb-1">Reserved</p>
            <p className="text-xl md:text-2xl font-bold text-slate-700 dark:text-slate-200">{unusedResCount}</p>
          </div>
          <div className="w-px h-10 bg-slate-200 dark:bg-slate-800 self-center"></div>
          <div>
            <p className="text-slate-400 dark:text-slate-500 text-[9px] md:text-xs uppercase font-bold tracking-widest mb-1">Capacity</p>
            <p className="text-xl md:text-2xl font-bold text-slate-700 dark:text-slate-200">{status?.capacity || 0}</p>
          </div>
        </div>
      </section>

      {/* Right Panel: Info & Reservation */}
      <div className="col-span-1 md:col-span-12 lg:col-span-5 flex flex-col space-y-6 md:space-y-8">
        
        {/* Staff Section */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm flex-1 transition-colors">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-6 flex items-center">
            <Users className="w-4 h-4 mr-2 text-indigo-500" />
            Staff On Duty
          </h3>
          <div className="space-y-4">
            {presentStaff.length > 0 ? (
              presentStaff.map(staff => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={staff.id} 
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                      {staff.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{staff.name}</span>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-lg uppercase tracking-tighter">Present</span>
                </motion.div>
              ))
            ) : (
              <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 transition-colors">
                <p className="text-xs text-slate-400 dark:text-slate-600 font-medium tracking-tight">No staff currently on duty</p>
              </div>
            )}
          </div>
        </section>

        {/* Reservation Section */}
        <section className="bg-indigo-900 dark:bg-indigo-950 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden transition-colors">
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-white/5 rounded-full"></div>
          <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-indigo-400/10 rounded-full blur-xl"></div>
          
          <h3 className="text-sm font-bold uppercase tracking-wider mb-6 flex items-center text-indigo-200">
            <Calendar className="w-4 h-4 mr-2" />
            Quick Reservation
          </h3>

          <AnimatePresence mode="wait">
            {bookingSuccess ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center"
              >
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <h4 className="text-lg font-bold mb-1 uppercase tracking-tight">Booking Confirmed!</h4>
                <p className="text-indigo-200 text-xs mb-4">Show your OTP at the entrance</p>
                <div className="bg-white px-6 py-3 rounded-xl inline-block shadow-lg">
                  <span className="text-3xl font-mono font-black text-indigo-900 tracking-[0.4em]">{bookingSuccess}</span>
                </div>
              </motion.div>
            ) : !user || showAuth ? (
              <motion.div 
                key="auth"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-white/10 p-4 rounded-2xl border border-white/20 text-center">
                  <p className="text-xs font-medium text-indigo-200 mb-3">
                    Unlock reservations by creating a student account.
                  </p>
                  <div className="flex bg-white/10 rounded-xl p-1 mb-4">
                    <button 
                      onClick={() => setAuthMode('login')}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                        authMode === 'login' ? "bg-white text-indigo-900 shadow-sm" : "text-white/60 hover:text-white"
                      )}
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => setAuthMode('signup')}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                        authMode === 'signup' ? "bg-white text-indigo-900 shadow-sm" : "text-white/60 hover:text-white"
                      )}
                    >
                      Sign Up
                    </button>
                  </div>

                  <form onSubmit={handleStudentAuth} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                      <input 
                        type="email" 
                        required
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        placeholder="University Email"
                        className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-xs placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                      <input 
                        type="password" 
                        required
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-xs placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    {authError && <p className="text-red-400 text-[10px] font-medium">{authError}</p>}
                    <button 
                      disabled={isAuthenticating}
                      className="w-full bg-white text-indigo-900 font-bold py-3 rounded-xl text-xs transition-all hover:bg-indigo-50 active:scale-[0.98] flex items-center justify-center"
                    >
                      {authMode === 'login' ? <LogIn className="w-3.5 h-3.5 mr-2" /> : <UserPlus className="w-3.5 h-3.5 mr-2" />}
                      {isAuthenticating ? 'Working...' : authMode === 'login' ? 'Access Account' : 'Create Account'}
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
                className="space-y-5"
              >
                <div>
                  <label className="text-[10px] font-bold uppercase text-indigo-300 block mb-1.5 tracking-widest ml-1">Student Name</label>
                  <input 
                    type="text" 
                    required
                    value={bookingName}
                    onChange={(e) => setBookingName(e.target.value)}
                    placeholder="Enter full name" 
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3.5 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-indigo-300 block mb-1.5 tracking-widest ml-1">Time Slot</label>
                    <select 
                      value={bookingSlot}
                      onChange={(e) => setBookingSlot(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none cursor-pointer"
                    >
                      <option className="text-slate-800" value="08:00 - 10:00">08:00 - 10:00</option>
                      <option className="text-slate-800" value="10:00 - 12:00">10:00 - 12:00</option>
                      <option className="text-slate-800" value="12:00 - 14:00">12:00 - 14:00</option>
                      <option className="text-slate-800" value="14:00 - 16:00">14:00 - 16:00</option>
                      <option className="text-slate-800" value="16:00 - 18:00">16:00 - 18:00</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button 
                      disabled={isBooking}
                      className={cn(
                        "w-full bg-white text-indigo-900 font-bold py-3.5 rounded-2xl text-sm transition-all hover:shadow-lg hover:shadow-white/10 active:scale-[0.98] disabled:opacity-50",
                      )}
                    >
                      {isBooking ? 'Processing...' : 'Book Spot'}
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {user && !bookingSuccess && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 pt-8 border-t border-white/10"
            >
              <h4 className="text-[10px] font-bold uppercase text-indigo-300 mb-4 tracking-widest flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-2" />
                My Active Bookings
              </h4>
              <div className="space-y-3">
                {reservations.filter(r => r.userId === user.uid && !r.is_used).length > 0 ? (
                  reservations.filter(r => r.userId === user.uid && !r.is_used).map(res => (
                    <div key={res.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">{res.time}</p>
                        <p className="text-[10px] text-indigo-300 font-mono tracking-widest mt-1">OTP: {res.otp}</p>
                      </div>
                      <button 
                        onClick={() => {
                          if(confirm('Cancel this booking?')) {
                            const updated = reservations.filter((r) => r.id !== res.id);
                            setReservations(updated);
                            localStorage.setItem('seatidle_reservations', JSON.stringify(updated));
                            window.dispatchEvent(new Event('storage'));
                          }
                        }}
                        className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-tighter"
                      >
                        Cancel
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-indigo-400 italic">No active bookings found.</p>
                )}
              </div>
            </motion.div>
          )}

          {(!bookingSuccess && user) && (
             <div className="mt-8 flex items-start space-x-3 bg-white/5 p-4 rounded-2xl border border-white/5">
              <AlertCircle className="w-5 h-5 text-indigo-300 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-indigo-200 leading-relaxed font-medium">
                Note: Reservations are restricted to University members. Please ensure you are logged in correctly.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
