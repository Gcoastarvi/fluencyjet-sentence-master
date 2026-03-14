import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";

const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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
          {/* ✉️ Support Section */}
          <div className="mt-8 p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100/50">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                💬
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 leading-none">
                  Need Help?
                </h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                  We're here to support you
                </p>
              </div>
            </div>

            <a
              href="mailto:support@fluencyjet.com?subject=Support Request - FluencyJet MVP"
              className="mt-6 w-full py-3 bg-white text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-100 flex items-center justify-center hover:bg-indigo-100 transition-colors"
            >
              Contact Support Team
            </a>
          </div>
          {/* 🚪 Dangerous Area */}
          <div className="mt-12 pt-8 border-t border-slate-100">
            <button
              onClick={() => setIsLogoutModalOpen(true)}
              className="w-full py-4 bg-rose-50 text-rose-600 font-black rounded-2xl border border-rose-100 hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Logout Account
            </button>

            {/* 🏷️ Version Footer */}
            <div className="mt-6 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                FluencyJet{" "}
                <span className="text-indigo-400 ml-1">v1.0.0-MVP</span>
              </p>
              <p className="text-[8px] font-bold text-slate-300 uppercase mt-1">
                Build ID:{" "}
                {new Date().toISOString().split("T")[0].replace(/-/g, "")}-BETA
              </p>
            </div>
          </div>
          {/* 🛠️ Confirmation Modal Overlay */}
          {isLogoutModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300">
                <div className="text-5xl mb-6">👋</div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 leading-tight">
                  Wait, leaving?
                </h3>
                <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
                  Are you sure you want to log out? Your daily streak is waiting
                  for you!
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      localStorage.removeItem("token");
                      window.location.href = "/login";
                    }}
                    className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                  >
                    Yes, Log Me Out
                  </button>
                  <button
                    onClick={() => setIsLogoutModalOpen(false)}
                    className="w-full py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Keep Practicing
                  </button>
                </div>
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
