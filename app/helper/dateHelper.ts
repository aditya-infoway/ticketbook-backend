// Server ke local timezone ki date (YYYY-MM-DD)
export const getDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Hamesha IST ki date (YYYY-MM-DD), server timezone chahe jo ho
export const todayIST = (date: Date = new Date()): string =>
  date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });