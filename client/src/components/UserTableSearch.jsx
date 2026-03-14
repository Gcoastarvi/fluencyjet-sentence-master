//client/src/components/UserTableSearch.jsx
import React, { useState } from "react";
import api from "../api/apiClient";

function UserTableSearch() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    const val = e.target.value;
    setQuery(val);

    if (val.length < 2) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      // 🎯 This calls the backend route we just created
      const res = await api.get(`/api/admin/dashboard/search?q=${val}`);
      setUsers(res.data);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          placeholder="Search by username..."
          className="w-full p-5 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 pl-12"
          onChange={handleSearch}
        />
        <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30">
          🔍
        </span>
      </div>

      <div className="space-y-3">
        {loading && (
          <p className="text-center text-xs font-bold text-slate-400 animate-pulse">
            Searching...
          </p>
        )}

        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black">
                {user.username?.[0] || "?"}
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 leading-none">
                  {user.username}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  {user.league || "BRONZE"} • Streak: {user.daily_streak || 0}
                </p>
              </div>
            </div>
            <button
              onClick={() => alert(`Gifted 500 XP to ${user.username}!`)}
              className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              Gift 500 XP 🎁
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserTableSearch;
