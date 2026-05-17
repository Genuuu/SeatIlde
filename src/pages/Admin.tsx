import { useState, useEffect, FormEvent } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { Settings, Users, Calendar, Plus, Trash2, LogIn, Lock, Mail, Save } from 'lucide-react';
import { cn } from '../lib/utils';

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
  is_used: boolean;
  otp: string;
  userId?: string;
  createdAt?: string;
}

export function Admin() {
  const { user, loading } = useAuth();
  
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

  // Load and Persist
  useEffect(() => {
    if (!user) return;

    const savedStatus = localStorage.getItem('seatidle_status');
    const savedStaff = localStorage.getItem('seatidle_staff');
    const savedRes = localStorage.getItem('seatidle_reservations');
    const savedAnnouncements = localStorage.getItem('seatidle_announcements');

    if (savedStatus) {
      const parsed = JSON.parse(savedStatus);
      setStatus(parsed);
      setEditCapacity(parsed.capacity.toString());
      setEditOccupancy(parsed.occupancy.toString());
    }
    if (savedStaff) setStaffList(JSON.parse(savedStaff));
    if (savedRes) setReservations(JSON.parse(savedRes));
    if (savedAnnouncements) setAnnouncements(JSON.parse(savedAnnouncements));
  }, [user]);

  const saveToStorage = (type: 'status' | 'staff' | 'res' | 'announcements', data: any) => {
    localStorage.setItem(`seatidle_${type}`, JSON.stringify(data));
    // Trigger storage event for cross-tab sync if in the same browser
    window.dispatchEvent(new Event('storage'));
  };

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

  const updateStatus = () => {
    const newStatus = {
      ...status,
      capacity: parseInt(editCapacity) || 50,
      occupancy: parseInt(editOccupancy) || 0,
      last_updated: new Date().toISOString()
    };
    setStatus(newStatus);
    saveToStorage('status', newStatus);
    alert('Status updated successfully');
  };

  const toggleStaffPresence = (id: string, current: boolean) => {
    const updated = staffList.map(s => s.id === id ? { ...s, is_present: !current } : s);
    setStaffList(updated);
    saveToStorage('staff', updated);
  };

  const addStaff = () => {
    if (!newStaffName.trim()) return;
    const newStaff = {
      id: Date.now().toString(),
      name: newStaffName,
      is_present: false
    };
    const updated = [...staffList, newStaff];
    setStaffList(updated);
    saveToStorage('staff', updated);
    setNewStaffName('');
  };

  const deleteStaff = (id: string) => {
    if (confirm('Are you sure you want to remove this staff member?')) {
      const updated = staffList.filter(s => s.id !== id);
      setStaffList(updated);
      saveToStorage('staff', updated);
    }
  };

  const deleteReservation = (id: string) => {
    if (confirm('Are you sure you want to delete this reservation?')) {
      const updated = reservations.filter(r => r.id !== id);
      setReservations(updated);
      saveToStorage('res', updated);
    }
  };

  const markReservationUsed = (id: string) => {
    const updated = reservations.map(r => r.id === id ? { ...r, is_used: true } : r);
    setReservations(updated);
    saveToStorage('res', updated);
  };

  const addAnnouncement = () => {
    if (!announcementText.trim()) return;
    const newAnn: Announcement = {
      id: Date.now().toString(),
      text: announcementText,
      createdAt: new Date().toISOString()
    };
    const updated = [newAnn, ...announcements];
    setAnnouncements(updated);
    saveToStorage('announcements', updated);
    setAnnouncementText('');
  };

  const deleteAnnouncement = (id: string) => {
    const updated = announcements.filter(a => a.id !== id);
    setAnnouncements(updated);
    saveToStorage('announcements', updated);
  };

  const resetData = () => {
    if (confirm('DANGER: This will wipe all staff and reservations. Reset to factory defaults?')) {
      localStorage.removeItem('seatidle_status');
      localStorage.removeItem('seatidle_staff');
      localStorage.removeItem('seatidle_reservations');
      localStorage.removeItem('seatidle_announcements');
      window.location.reload();
    }
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden shadow-indigo-100 dark:shadow-none transition-colors"
        >
          <div className="bg-indigo-600 p-8 text-white">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Admin Portal</h2>
            <p className="text-indigo-100 text-sm mt-1 font-medium">Authorized personnel only</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-8 space-y-6">
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
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:focus:bg-slate-800 dark:text-slate-200 transition-all"
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
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:focus:bg-slate-800 dark:text-slate-200 transition-all"
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
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {isLoggingIn ? 'Verifying...' : 'Access Dashboard'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Seat Control */}
        <div className="lg:col-span-4 flex flex-col space-y-8 transition-colors">
          <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-8 flex items-center">
              <Settings className="w-4 h-4 mr-2 text-indigo-500" />
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
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center justify-center group"
              >
                <Save className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
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
              <Plus className="w-4 h-4 mr-2 text-indigo-500" />
              Register Staff
            </h3>
            <div className="flex gap-3">
              <input 
                type="text"
                placeholder="Full Name"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:text-slate-200 transition-all"
              />
              <button 
                onClick={addStaff}
                className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-4 rounded-2xl font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
              >
                ADD
              </button>
            </div>
          </section>

          {/* New Announcement Section */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-6 flex items-center">
              <Mail className="w-4 h-4 mr-2 text-indigo-500" />
              Post Announcement
            </h3>
            <div className="space-y-4">
              <textarea 
                rows={3}
                placeholder="Type important notice for students..."
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:text-slate-200 transition-all resize-none"
              />
              <button 
                onClick={addAnnouncement}
                className="w-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 py-3 rounded-2xl font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
              >
                POST NOTICE
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
                <Users className="w-4 h-4 mr-2 text-indigo-500" />
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
                          staff.is_present ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500"
                        )}>
                          {staff.is_present ? 'Present' : 'Away'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => toggleStaffPresence(staff.id, staff.is_present)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            staff.is_present ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10" : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
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
      </div>

      {/* Reservations Table */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-8 pb-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
            Active Reservations
          </h3>
        </div>
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">
              <tr>
                <th className="px-8 py-4">Student</th>
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
                  <td className="px-8 py-5 text-slate-500 dark:text-slate-500 text-xs font-medium">{res.time}</td>
                  <td className="px-8 py-5">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-base tracking-widest">{res.otp}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter",
                      res.is_used ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 line-through" : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                    )}>
                      {res.is_used ? 'Arrived' : 'Awaiting'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right space-x-2">
                    {!res.is_used && (
                      <button 
                        onClick={() => markReservationUsed(res.id)}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
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
    </div>
  );
}
