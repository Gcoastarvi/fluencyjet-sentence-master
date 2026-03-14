import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";

export default function Settings() {
  const { auth, updateProfile } = useAuth();
  const [lang, setLang] = useState(auth?.user?.nativeLanguage || "Tamil");

  const handleSave = async () => {
    try {
      // await api.put('/api/me', { nativeLanguage: lang });
      toast.success("Settings saved! 🚀");
    } catch (err) {
      toast.error("Failed to save.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tighter uppercase">
        Settings
      </h2>

      <div className="space-y-6">
        <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">
            Native Language
          </label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Tamil">Tamil (தமிழ்)</option>
            <option value="Hindi">Hindi (हिन्दी)</option>
            <option value="English">English</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
