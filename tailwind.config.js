/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213d",
        fern: "#2d6a4f",
        coral: "#d76f45",
        mist: "#edf6f9",
        rose: "#b24c63",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(20, 33, 61, 0.12)",
      },
    },
  },
  plugins: [],
};
