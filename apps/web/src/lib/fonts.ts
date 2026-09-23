import { GeistMono } from "geist/font/mono";
import { Inter } from "next/font/google";

export const appSans = Inter({
  subsets: ["latin"],
  variable: "--font-app-sans",
  display: "swap",
});

export const appMono = GeistMono;
