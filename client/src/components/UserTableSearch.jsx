//client/src/components/UserTableSearch.jsx
import React from "react";

// 🎯 We now receive the filtered list and control tools from AdminDashboard
function UserTableSearch({ users, searchTerm, setSearchTerm }) {
  // 🛡️ Safety: Ensure 'users' is always an array to prevent .map() crashes
  const safeUsers = Array.isArray(users) ? users : [];

  return (
    <div>
      {/* 🔍 Search Input Field */}
      <div className="relative mb-6">
        <input
          type="text"
          value={searchTerm}
          placeholder="Search by username or email..."
          className="w-full p-5 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 pl-12 outline-none transition-all"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30">
          🔍
        </span>

        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-slate-200 text-slate-500 rounded-full text-[10px] font-black hover:bg-slate-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* 📜 Results List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
        {safeUsers.length > 0 ? (
          safeUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 transition-all shadow-sm"
            >
              <div className="flex items-center gap-4">
                {/* 👤 Avatar Initial */}
                <div className="h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-sm shadow-inner">
                  {user.username?.[0] || user.name?.[0] || "?"}
                </div>

                <div>
                  <p className="text-sm font-black text-slate-900 leading-none">
                    {user.username || user.name || "Anonymous Master"}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    {/* Preserve the status info we found in the audit */}
                    {user.league || "BRONZE"} LEAGUE • Streak:{" "}
                    {user.daily_streak || 0}
                  </p>
                </div>
              </div>

              {/* 🎁 Gift XP Button (Action preserved) */}
              <button
                onClick={() =>
                  alert(`Gifted 500 XP to ${user.username || user.email}!`)
                }
                className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                Gift 500 XP 🎁
              </button>
            </div>
          ))
        ) : (
          <div className="py-10 text-center">
            <p className="text-xs font-bold text-slate-300 italic">
              {searchTerm
                ? "No masters found matching that name..."
                : "Type above to find a student"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserTableSearch;
