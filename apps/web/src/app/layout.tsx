import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  referrer: "no-referrer",
  title: "Anka WiFi | Fast. Secure. Simple.",
  description:
    "Choose your Wi-Fi package, pay securely with Paystack, and get your Anka WiFi access code.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} h-full scroll-smooth scroll-pt-6 antialiased motion-reduce:scroll-auto`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-white font-sans text-[15px] leading-relaxed text-navy [&_button]:cursor-pointer **:focus-visible:outline-3 **:focus-visible:outline-offset-4 **:focus-visible:outline-brand">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
