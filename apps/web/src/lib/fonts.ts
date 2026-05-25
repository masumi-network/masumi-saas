import { GeistMono } from "geist/font/mono";
import { Plus_Jakarta_Sans } from "next/font/google";

export const appSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-app-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const appMono = GeistMono;
