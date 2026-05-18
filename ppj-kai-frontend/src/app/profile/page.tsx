'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/layout/BottomNav';
import api from '../../lib/api';

interface UserProfile {
  id: number;
  nipp: string;
  nama: string;
  role: string;
  foto: string | null;
  jabatan: string | null;
  division: string | null;
  workArea: string | null;
  phone: string | null;
  isActive: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit form state
  const [editNama, setEditNama] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFoto, setEditFoto] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      // If 401, the interceptor will handle token removal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const openEditModal = () => {
    if (user) {
      setEditNama(user.nama);
      setEditPhone(user.phone || '');
      setEditFoto(user.foto || '');
      setEditPassword('');
      setSaveError('');
      setSaveSuccess('');
    }
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const payload: any = {};
      if (editNama.trim()) payload.nama = editNama.trim();
      if (editPhone !== (user?.phone || '')) payload.phone = editPhone.trim();
      if (editFoto !== (user?.foto || '')) payload.foto = editFoto;
      if (editPassword) payload.password = editPassword;

      const res = await api.patch('/auth/profile', payload);

      if (res.data.success) {
        setUser(res.data.user);
        // Also update localStorage user data so other pages stay in sync
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          localStorage.setItem('user', JSON.stringify({ ...parsed, nama: res.data.user.nama, foto: res.data.user.foto }));
        }
        setSaveSuccess('Profil berhasil diperbarui');
        setTimeout(() => {
          setShowEditModal(false);
          setSaveSuccess('');
        }, 1200);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Gagal menyimpan profil';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 2MB
    if (file.size > 2 * 1024 * 1024) {
      setSaveError('Ukuran foto maksimal 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditFoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const userInitials = user?.nama?.substring(0, 2).toUpperCase() || 'KAI';

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-primary text-[40px] animate-spin">refresh</span>
          <p className="text-sm">Memuat profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background antialiased min-h-screen font-sans">
      {/* Top App Bar */}
      <header className="bg-surface/80 backdrop-blur-md shadow-sm sticky top-0 z-50 flex items-center justify-center w-full px-container-padding h-16">
        <h1 className="font-h2 text-h2 font-bold text-primary tracking-tight">Profil</h1>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 pb-32 max-w-4xl mx-auto flex flex-col gap-4">
        {/* Profile Header Glass Card */}
        <section className="bg-surface rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant p-6 flex flex-col items-center text-center relative overflow-hidden">
          {/* Decorative gradient */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent z-0"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full border-4 border-surface shadow-sm overflow-hidden mb-2 relative">
              {user?.foto ? (
                <img alt="Profile" className="w-full h-full object-cover" src={user.foto} />
              ) : (
                <div className="w-full h-full bg-primary-container flex items-center justify-center">
                  <span className="text-2xl font-bold text-on-primary-container">{userInitials}</span>
                </div>
              )}
            </div>
            <h2 className="font-bold text-2xl text-on-surface mb-1">{user?.nama || 'Pengguna'}</h2>
            <div className="flex items-center gap-2">
              <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-xs font-semibold border border-outline-variant">
                {user?.jabatan || user?.role || 'Petugas'}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border ${
                user?.isActive
                  ? 'bg-[#e8f5e9] text-[#1b5e20] border-[#c8e6c9]'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${user?.isActive ? 'bg-[#4caf50]' : 'bg-red-500'}`}></span>
                {user?.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </section>

        {/* Bento Grid Information */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Identification Card */}
          <div className="bg-surface rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-primary mb-2">
              <span className="material-symbols-outlined">badge</span>
              <h3 className="font-semibold text-lg">Identification</h3>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">NIPP</span>
              <span className="font-bold text-lg text-on-surface">{user?.nipp || '-'}</span>
            </div>
          </div>

          {/* Assignment Card */}
          <div className="bg-surface rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-primary mb-2">
              <span className="material-symbols-outlined">location_on</span>
              <h3 className="font-semibold text-lg">Assignment</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Division</span>
                <span className="text-base text-on-surface font-medium">{user?.division || '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Work Area</span>
                <span className="text-base text-on-surface font-medium">{user?.workArea || '-'}</span>
              </div>
            </div>
          </div>

          {/* Contact Card */}
          <div className="bg-surface rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant p-4 flex flex-col gap-2 md:col-span-2">
            <div className="flex items-center gap-2 text-primary mb-2">
              <span className="material-symbols-outlined">contact_phone</span>
              <h3 className="font-semibold text-lg">Contact Information</h3>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Primary Phone</span>
              <span className="font-bold text-lg text-on-surface">{user?.phone || '-'}</span>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="flex flex-col gap-2 mt-2">
          <button
            onClick={openEditModal}
            className="w-full h-12 bg-primary text-white font-semibold text-lg rounded-lg shadow-sm hover:bg-primary/90 transition-colors active:scale-[0.98] flex justify-center items-center gap-2"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>edit</span>
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            className="w-full h-12 bg-red-50 text-red-700 font-semibold text-lg rounded-lg border border-red-200 shadow-sm hover:bg-red-600 hover:text-white transition-colors active:scale-[0.98] flex justify-center items-center gap-2 mt-1"
          >
            <span className="material-symbols-outlined">logout</span>
            Logout
          </button>
        </section>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h2 className="font-semibold text-lg text-on-surface">Edit Profile</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 flex flex-col gap-4">
              {/* Foto */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full border-2 border-outline-variant overflow-hidden bg-surface-container-high">
                  {editFoto ? (
                    <img alt="Preview" className="w-full h-full object-cover" src={editFoto} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-[32px]">person</span>
                    </div>
                  )}
                </div>
                <label className="text-sm text-primary font-medium cursor-pointer hover:underline">
                  Ubah Foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFotoUpload}
                  />
                </label>
              </div>

              {/* NIPP (read-only) */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">NIPP</label>
                <input
                  type="text"
                  value={user?.nipp || ''}
                  disabled
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant rounded-xl text-on-surface-variant cursor-not-allowed text-sm"
                />
              </div>

              {/* Role (read-only) */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Role</label>
                <input
                  type="text"
                  value={user?.role || ''}
                  disabled
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant rounded-xl text-on-surface-variant cursor-not-allowed capitalize text-sm"
                />
              </div>

              {/* Nama */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nama</label>
                <input
                  type="text"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm text-on-surface"
                  placeholder="Masukkan nama lengkap"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nomor Telepon</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm text-on-surface"
                  placeholder="+62 xxx-xxxx-xxxx"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Password Baru <span className="text-gray-400 normal-case">(kosongkan jika tidak ingin mengubah)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm text-on-surface"
                  placeholder="Minimal 6 karakter"
                />
              </div>

              {/* Error / Success */}
              {saveError && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm">
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-2 text-sm">
                  {saveSuccess}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-outline-variant flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 h-11 bg-surface-container-high text-on-surface-variant font-semibold rounded-lg hover:bg-surface-container-highest transition-colors active:scale-[0.98] text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 h-11 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {saving ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                    Menyimpan...
                  </>
                ) : (
                  'Simpan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
