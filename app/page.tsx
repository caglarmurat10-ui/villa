// Bugünün tarihi (2026-07-24 baz alınır)
const todayStr = new Date().toISOString().split('T')[0];

// 1. Kategorizasyon
const completedReservations = reservations.filter(r => r.cout < todayStr);
const activeReservations = reservations.filter(r => r.cout >= todayStr);

// 2. Çıkış Tarihi Yaklaşanlar (Bugün veya Yarın çıkış yapacaklar)
const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

const tomorrowStr = getTomorrowStr();

const approachingCheckouts = activeReservations.filter(r => {
  return r.cout === todayStr || r.cout === tomorrowStr;
});
