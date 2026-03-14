//client/src/components/UserTableSearch.jsx
import React, { useState } from "react";

function UserTableSearch() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);

  const handleSearch = async (e) => {
    setQuery(e.target.value);
    // 🎯 Logic: api.get(`/api/admin/users/search?q=${e.target.value}`).then(...)
  };

  const giftXP = (userId) => {
    // 🎯 Logic: api.post(`/api/admin/users/${userId}/gift-xp`, { amount: 500 })
    alert(`500 XP Gifted to User ${userId}! 🎁`);
  };

  return (
    <div>
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Search by username..."
          className="w-full p-5 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all pl-12"
          onChange={handleSearch}
        />
        <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30">
          🔍
        </span>
      </div>

      <div className="space-y-3">
        {/* Sample Result Row */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black">
              M
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 leading-none">
                MangoMaster
              </p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                Active • Bronze League
              </p>
            </div>
          </div>
          <button
            onClick={() => giftXP(123)}
            className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100"
          >
            Gift 500 XP 🎁
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserTableSearch;
