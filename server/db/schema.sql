-- user_progress table
CREATE TABLE IF NOT EXISTS user_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_active DATE,
  badges TEXT[] DEFAULT '{}'
);
